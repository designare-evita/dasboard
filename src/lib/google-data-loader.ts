// src/lib/google-data-loader.ts

import { sql } from '@vercel/postgres';
import { type User } from '@/lib/schemas';
import {
  getSearchConsoleData,
  getAnalyticsData,
  getTopQueries,
  getAiTrafficData,
  getGa4DimensionReport,
  getTopConvertingPages, 
  type AiTrafficData
} from '@/lib/google-api';
import { 
  ProjectDashboardData, 
  ChartEntry, 
  ApiErrorStatus,
  ConvertingPageData 
} from '@/lib/dashboard-shared';
import { getBingData } from '@/lib/bing-api'; // ✅ NEU: Bing API Import
import type { TopQueryData, ChartPoint } from '@/types/dashboard';

const CACHE_DURATION_HOURS = 48; 

// Interface für interne Datenhaltung
interface RawApiData {
  clicks: { total: number; daily: ChartPoint[] };
  impressions: { total: number; daily: ChartPoint[] };
  sessions: { total: number; daily: ChartPoint[] };
  totalUsers: { total: number; daily: ChartPoint[] };
  conversions: { total: number; daily: ChartPoint[] };
  engagementRate: { total: number; daily: ChartPoint[] };
  bounceRate: { total: number; daily: ChartPoint[] };
  newUsers: { total: number; daily: ChartPoint[] };
  avgEngagementTime: { total: number; daily: ChartPoint[] };
}

// Hilfsfunktion: Berechnet prozentuale Veränderung sicher
function calculateChange(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Hilfsfunktion: Leeres Datenobjekt erstellen
function createEmptyRawData(): RawApiData {
  return {
    clicks: { total: 0, daily: [] },
    impressions: { total: 0, daily: [] },
    sessions: { total: 0, daily: [] },
    totalUsers: { total: 0, daily: [] },
    conversions: { total: 0, daily: [] },
    engagementRate: { total: 0, daily: [] },
    bounceRate: { total: 0, daily: [] },
    newUsers: { total: 0, daily: [] },
    avgEngagementTime: { total: 0, daily: [] }
  };
}

export async function getOrFetchGoogleData(
  user: User, 
  dateRange: string, 
  forceRefresh: boolean = false
): Promise<ProjectDashboardData> {

  // 1. Cache prüfen (wenn nicht erzwungen)
  if (!forceRefresh) {
    try {
      const { rows } = await sql`
        SELECT data, last_fetched 
        FROM google_data_cache 
        WHERE user_id = ${user.id} AND date_range = ${dateRange}
      `;

      if (rows.length > 0) {
        const cache = rows[0];
        const lastFetched = new Date(cache.last_fetched).getTime();
        const now = Date.now();
        const hoursDiff = (now - lastFetched) / (1000 * 60 * 60);

        if (hoursDiff < CACHE_DURATION_HOURS) {
          // Cache ist noch gültig -> return
          return { ...cache.data, fromCache: true } as ProjectDashboardData;
        }
      }
    } catch (error) {
      console.error('Cache Read Error:', error);
      // Bei Fehler einfach weitermachen und neu fetchen
    }
  }

  // 2. Frische Daten holen
  const apiErrors: ApiErrorStatus = {};
  
  // Initialisiere leere Container für "Aktuell" und "Vergleichszeitraum"
  let currentData = createEmptyRawData();
  let prevData = createEmptyRawData();

  // --- A) Google Search Console (GSC) ---
  if (user.gsc_site_url) {
    try {
      // Parallel: Aktueller Zeitraum & Vorheriger Zeitraum
      const [gscCurrent, gscPrev] = await Promise.all([
        getSearchConsoleData(user.gsc_site_url, user.refresh_token, dateRange, 'current'),
        getSearchConsoleData(user.gsc_site_url, user.refresh_token, dateRange, 'previous')
      ]);

      currentData.clicks = gscCurrent.clicks;
      currentData.impressions = gscCurrent.impressions;
      
      prevData.clicks = gscPrev.clicks;
      prevData.impressions = gscPrev.impressions;

    } catch (e: any) {
      console.error('GSC Fetch Error:', e);
      apiErrors.gsc = e.message || 'Fehler beim GSC Abruf';
    }
  }

  // --- B) Google Analytics 4 (GA4) ---
  if (user.ga4_property_id) {
    try {
      const [ga4Current, ga4Prev] = await Promise.all([
        getAnalyticsData(user.ga4_property_id, user.refresh_token, dateRange, 'current'),
        getAnalyticsData(user.ga4_property_id, user.refresh_token, dateRange, 'previous')
      ]);

      // Merge GA4 Data into main object
      currentData = { ...currentData, ...ga4Current }; // Überschreibt sessions, users etc.
      // Clicks/Impressions bleiben erhalten, da GA4 diese Keys nicht liefert (außer wir hätten Namenskonflikte)
      // Safety: getAnalyticsData liefert exakt die Keys aus RawApiData (sessions, totalUsers...)
      
      // Merge Prev Data manuell, um sicherzugehen
      prevData.sessions = ga4Prev.sessions;
      prevData.totalUsers = ga4Prev.totalUsers;
      prevData.conversions = ga4Prev.conversions;
      prevData.engagementRate = ga4Prev.engagementRate;
      prevData.bounceRate = ga4Prev.bounceRate;
      prevData.newUsers = ga4Prev.newUsers;
      prevData.avgEngagementTime = ga4Prev.avgEngagementTime;

    } catch (e: any) {
       console.error('GA4 Fetch Error:', e);
       apiErrors.ga4 = e.message || 'Fehler beim GA4 Abruf';
    }
  }

  // --- C) Zusatz-Daten (Top Queries, AI, Dimensionen) ---
  // Diese Daten holen wir meist nur für den aktuellen Zeitraum
  let topQueries: TopQueryData[] = [];
  let aiTraffic: AiTrafficData | undefined;
  let countryData: ChartEntry[] = [];
  let channelData: ChartEntry[] = [];
  let deviceData: ChartEntry[] = [];
  let topConvertingPages: ConvertingPageData[] = [];

  // GSC Extras
  if (user.gsc_site_url && !apiErrors.gsc) {
    try {
      const [queries, ai] = await Promise.all([
        getTopQueries(user.gsc_site_url, user.refresh_token, dateRange),
        getAiTrafficData(user.gsc_site_url, user.refresh_token, dateRange)
      ]);
      topQueries = queries;
      aiTraffic = ai;
    } catch (e) {
      console.warn('GSC Extras Error:', e);
    }
  }

  // GA4 Extras
  if (user.ga4_property_id && !apiErrors.ga4) {
    try {
       const [countries, channels, devices, pages] = await Promise.all([
         getGa4DimensionReport(user.ga4_property_id, user.refresh_token, dateRange, 'country'),
         getGa4DimensionReport(user.ga4_property_id, user.refresh_token, dateRange, 'sessionDefaultChannelGroup'),
         getGa4DimensionReport(user.ga4_property_id, user.refresh_token, dateRange, 'deviceCategory'),
         getTopConvertingPages(user.ga4_property_id, user.refresh_token, dateRange)
       ]);
       countryData = countries;
       channelData = channels;
       deviceData = devices;
       topConvertingPages = pages;
    } catch (e) {
      console.warn('GA4 Extras Error:', e);
    }
  }

  // --- D) ✅ NEU: BING DATEN FETCH ---
  let bingData: any[] = [];
  // Wir versuchen Bing Daten zu holen, wenn eine GSC URL existiert.
  // Der Bing-Fetcher nutzt den serverseitigen Agency-Key (Env Var).
  if (user.gsc_site_url) {
    try {
      bingData = await getBingData(user.gsc_site_url);
    } catch (e) {
      console.warn('Bing Fetch skipped/failed (non-critical):', e);
      // Kein apiError setzen, da Bing optional ist
    }
  }

  // 3. Finales Objekt zusammenbauen
  const freshData: ProjectDashboardData = {
    kpis: {
      clicks: { value: currentData.clicks.total, change: calculateChange(currentData.clicks.total, prevData.clicks.total) },
      impressions: { value: currentData.impressions.total, change: calculateChange(currentData.impressions.total, prevData.impressions.total) },
      sessions: { value: currentData.sessions.total, change: calculateChange(currentData.sessions.total, prevData.sessions.total) },
      totalUsers: { value: currentData.totalUsers.total, change: calculateChange(currentData.totalUsers.total, prevData.totalUsers.total) },
      conversions: { value: currentData.conversions.total, change: calculateChange(currentData.conversions.total, prevData.conversions.total) },
      engagementRate: { value: currentData.engagementRate.total, change: calculateChange(currentData.engagementRate.total, prevData.engagementRate.total) },
      bounceRate: { value: currentData.bounceRate.total, change: calculateChange(currentData.bounceRate.total, prevData.bounceRate.total) },
      newUsers: { value: currentData.newUsers.total, change: calculateChange(currentData.newUsers.total, prevData.newUsers.total) },
      avgEngagementTime: { value: currentData.avgEngagementTime.total, change: calculateChange(currentData.avgEngagementTime.total, prevData.avgEngagementTime.total) }
    },
    
    charts: {
      clicks: currentData.clicks.daily || [],
      impressions: currentData.impressions.daily || [],
      sessions: currentData.sessions.daily || [],
      totalUsers: currentData.totalUsers.daily || [],
      conversions: currentData.conversions.daily || [],
      engagementRate: currentData.engagementRate.daily || [],
      bounceRate: currentData.bounceRate.daily || [],
      newUsers: currentData.newUsers.daily || [],
      avgEngagementTime: currentData.avgEngagementTime.daily || [],
      aiTraffic: aiTraffic?.history || [] // Historie für das AI-Chart
    },

    topQueries,
    topConvertingPages,
    aiTraffic,
    bingData, // ✅ Bing Daten integriert
    countryData,
    channelData,
    deviceData,
    
    apiErrors: Object.keys(apiErrors).length > 0 ? apiErrors : undefined,
    fromCache: false
  };

  // 4. Cache schreiben (Upsert)
  try {
    await sql`
      INSERT INTO google_data_cache (user_id, date_range, data, last_fetched)
      VALUES (${user.id}, ${dateRange}, ${JSON.stringify(freshData)}::jsonb, NOW())
      ON CONFLICT (user_id, date_range)
      DO UPDATE SET 
        data = ${JSON.stringify(freshData)}::jsonb,
        last_fetched = NOW();
    `;
  } catch (e) {
    console.error('Cache Write Error:', e);
  }

  return freshData;
}
