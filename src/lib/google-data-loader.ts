// src/lib/google-data-loader.ts
import { sql } from '@vercel/postgres';
import { type User } from '@/lib/schemas';
import {
  getSearchConsoleData,
  getAnalyticsData,
  getTopQueries,
  getAiTrafficData,
  getGa4DimensionReport,
  type AiTrafficData
} from '@/lib/google-api';
import { 
  ProjectDashboardData, 
  ChartEntry, 
  ApiErrorStatus,
  ZERO_KPI
} from '@/lib/dashboard-shared';
import type { TopQueryData, ChartPoint } from '@/types/dashboard';

// ========== KONSTANTEN ==========
const CACHE_DURATION_HOURS = 48; 

// Typ-Aliase - verwende ChartPoint direkt
type GscData = { clicks: { total: number, daily: ChartPoint[] }, impressions: { total: number, daily: ChartPoint[] } };
type GaData = { 
  sessions: { total: number, daily: ChartPoint[] }, 
  totalUsers: { total: number, daily: ChartPoint[] },
  conversions: { total: number, daily: ChartPoint[] },
  engagementRate: { total: number, daily: ChartPoint[] }
};

const DEFAULT_GSC_DATA: GscData = { clicks: { total: 0, daily: [] }, impressions: { total: 0, daily: [] } };
const DEFAULT_GSC_PREVIOUS = { clicks: { total: 0 }, impressions: { total: 0 } };

const DEFAULT_GA_DATA: GaData = { 
  sessions: { total: 0, daily: [] }, 
  totalUsers: { total: 0, daily: [] },
  conversions: { total: 0, daily: [] },
  engagementRate: { total: 0, daily: [] }
};
const DEFAULT_GA_PREVIOUS = { sessions: { total: 0 }, totalUsers: { total: 0 }, conversions: { total: 0 }, engagementRate: { total: 0 } };

// ========== HILFSFUNKTIONEN ==========

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Helper: Credentials aus DB-User parsen
function getCredentials(user: User) {
  if (!user.gsc_site_url) throw new Error('Keine GSC Property konfiguriert');
  
  // Da wir Service Account nutzen, brauchen wir hier keine User-spezifischen Credentials,
  // sondern nutzen die Env-Vars im Backend (via google-api.ts).
  // Wir geben nur die Property-ID zurück.
  return {
    siteUrl: user.gsc_site_url,
    ga4PropertyId: user.ga4_property_id
  };
}

// ========== HAUPTFUNKTION ==========

export async function getOrFetchGoogleData(
  user: User,
  dateRange: string,
  forceRefresh = false
): Promise<ProjectDashboardData | null> {
  if (!user.id) return null;

  const userId = user.id;

  // 1. Cache prüfen
  if (!forceRefresh) {
    try {
      const { rows } = await sql`
        SELECT data, last_fetched 
        FROM google_data_cache 
        WHERE user_id = ${userId}::uuid AND date_range = ${dateRange}
        LIMIT 1
      `;

      if (rows.length > 0) {
        const cacheEntry = rows[0];
        const lastFetched = new Date(cacheEntry.last_fetched).getTime();
        const now = Date.now();
        const cacheAgeHours = (now - lastFetched) / (1000 * 60 * 60);

        if (cacheAgeHours < CACHE_DURATION_HOURS) {
          console.log(`[Google Cache] ✅ HIT für ${user.email} (${dateRange}) - Age: ${cacheAgeHours.toFixed(1)}h`);
          console.log(`[Google Cache] Cache enthält GA4: ${!!cacheEntry.data?.kpis?.sessions}, GSC: ${!!cacheEntry.data?.kpis?.clicks}`);
          return { ...cacheEntry.data, fromCache: true };
        } else {
          console.log(`[Google Cache] ⏳ Cache abgelaufen (${cacheAgeHours.toFixed(1)}h) - Hole neue Daten`);
        }
      } else {
        console.log(`[Google Cache] ❌ Kein Cache gefunden für ${user.email} (${dateRange})`);
      }
    } catch (error) {
      console.warn('[Google Cache] Fehler beim Lesen:', error);
    }
  } else {
    console.log(`[Google Cache] 🔄 Force Refresh aktiviert für ${user.email}`);
  }

  // 2. Daten frisch holen
  console.log(`[Google Cache] 🔄 Fetching fresh data for ${user.email}...`);
  console.log(`[Google Config] GSC Site: ${user.gsc_site_url || 'NICHT KONFIGURIERT'}`);
  console.log(`[Google Config] GA4 Property: ${user.ga4_property_id || 'NICHT KONFIGURIERT'}`);
  console.log(`[Google Config] Date Range: ${dateRange}`);

  // Datum berechnen
  const end = new Date();
  const start = new Date();
  let days = 30;
  
  if (dateRange === '7d') days = 7;
  if (dateRange === '30d') days = 30;
  if (dateRange === '3m') days = 90;
  
  start.setDate(end.getDate() - days);
  const startDateStr = start.toISOString().split('T')[0];
  const endDateStr = end.toISOString().split('T')[0];

  // Vergleichszeitraum
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - days);
  const prevStartStr = prevStart.toISOString().split('T')[0];
  const prevEndStr = prevEnd.toISOString().split('T')[0];

  let gscData: GscData = DEFAULT_GSC_DATA;
  let gscPrev = DEFAULT_GSC_PREVIOUS;
  let gaData: GaData = DEFAULT_GA_DATA;
  let gaPrev = DEFAULT_GA_PREVIOUS;
  
  let topQueries: TopQueryData[] = [];
  let aiTraffic: AiTrafficData | undefined;
  let countryData: ChartEntry[] = [];
  let channelData: ChartEntry[] = [];
  let deviceData: ChartEntry[] = [];
  
  let apiErrors: ApiErrorStatus = {};

  // --- FETCH: GSC ---
  if (user.gsc_site_url) {
    try {
      const gscRaw = await getSearchConsoleData(user.gsc_site_url, startDateStr, endDateStr);
      gscData = {
        clicks: { total: gscRaw.clicks.total, daily: gscRaw.clicks.daily },
        impressions: { total: gscRaw.impressions.total, daily: gscRaw.impressions.daily }
      };
      
      // Vorperiode GSC
      const gscPrevRaw = await getSearchConsoleData(user.gsc_site_url, prevStartStr, prevEndStr);
      gscPrev = {
        clicks: { total: gscPrevRaw.clicks.total },
        impressions: { total: gscPrevRaw.impressions.total }
      };

      // Top Queries
      topQueries = await getTopQueries(user.gsc_site_url, startDateStr, endDateStr);

    } catch (e: any) {
      console.error('[GSC Fetch Error]', e);
      apiErrors.gsc = e.message || 'GSC Fehler';
    }
  }

  // --- FETCH: GA4 (Erweitert) ---
  if (user.ga4_property_id) {
    try {
      // Property ID trimmen (Leerzeichen entfernen)
      const propertyId = user.ga4_property_id.trim();

      console.log(`[GA4] Fetching data for property: ${propertyId}`);

      // Neue erweiterte getAnalyticsData Funktion nutzen
      const gaCurrent = await getAnalyticsData(propertyId, startDateStr, endDateStr);
      const gaPrevious = await getAnalyticsData(propertyId, prevStartStr, prevEndStr);
      
      gaData = {
        sessions: gaCurrent.sessions,
        totalUsers: gaCurrent.totalUsers,
        conversions: gaCurrent.conversions,
        engagementRate: gaCurrent.engagementRate
      };
      
      gaPrev = {
        sessions: { total: gaPrevious.sessions.total },
        totalUsers: { total: gaPrevious.totalUsers.total },
        conversions: { total: gaPrevious.conversions.total },
        engagementRate: { total: gaPrevious.engagementRate.total }
      };

      console.log(`[GA4] ✅ Base metrics fetched successfully`);

      // AI Traffic (Optional - Fehler nicht kritisch)
      try {
        aiTraffic = await getAiTrafficData(propertyId, startDateStr, endDateStr);
        console.log(`[GA4] ✅ AI Traffic data fetched`);
      } catch (aiError: any) {
        console.warn('[GA4] AI Traffic fetch failed (non-critical):', aiError.message);
      }

      // Pie Charts (Länder, Kanäle, Geräte) - Optional
      try {
        const rawCountryData = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'country');
        const rawChannelData = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'sessionDefaultChannelGroup');
        const rawDeviceData = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'deviceCategory');
        
        // ChartEntry-Objekte mit 'fill'-Property erstellen
        countryData = rawCountryData.map((item, index) => ({
          ...item,
          fill: `hsl(var(--chart-${(index % 5) + 1}))`
        }));
        channelData = rawChannelData.map((item, index) => ({
          ...item,
          fill: `hsl(var(--chart-${(index % 5) + 1}))`
        }));
        deviceData = rawDeviceData.map((item, index) => ({
          ...item,
          fill: `hsl(var(--chart-${(index % 5) + 1}))`
        }));
        
        console.log(`[GA4] ✅ Dimension reports fetched`);
      } catch (dimError: any) {
        console.warn('[GA4] Dimension reports fetch failed (non-critical):', dimError.message);
      }

    } catch (e: any) {
      console.error('[GA4 Fetch Error]', e);
      
      // Detailliertere Fehlermeldung
      let errorMessage = 'GA4 Fehler';
      if (e.message) {
        if (e.message.includes('credentials') || e.message.includes('authentication')) {
          errorMessage = 'GA4 Authentifizierung fehlgeschlagen - Service Account prüfen';
        } else if (e.message.includes('permission') || e.message.includes('access')) {
          errorMessage = 'GA4 Zugriff verweigert - Property-Berechtigungen prüfen';
        } else if (e.message.includes('property') || e.message.includes('not found')) {
          errorMessage = 'GA4 Property nicht gefunden - Property ID prüfen';
        } else {
          errorMessage = `GA4: ${e.message}`;
        }
      }
      
      apiErrors.ga4 = errorMessage;
    }
  }

  // Daten zusammenbauen
  const freshData: ProjectDashboardData = {
    kpis: {
      clicks: { value: gscData.clicks.total, change: calculateChange(gscData.clicks.total, gscPrev.clicks.total) },
      impressions: { value: gscData.impressions.total, change: calculateChange(gscData.impressions.total, gscPrev.impressions.total) },
      sessions: { value: gaData.sessions.total, change: calculateChange(gaData.sessions.total, gaPrev.sessions.total) },
      totalUsers: { value: gaData.totalUsers.total, change: calculateChange(gaData.totalUsers.total, gaPrev.totalUsers.total) },
      // ✅ NEU
      conversions: { value: gaData.conversions.total, change: calculateChange(gaData.conversions.total, gaPrev.conversions.total) },
      engagementRate: { 
        value: parseFloat((gaData.engagementRate.total * 100).toFixed(2)), 
        change: calculateChange(gaData.engagementRate.total, gaPrev.engagementRate.total) 
      },
    },
    charts: {
      clicks: gscData.clicks.daily,
      impressions: gscData.impressions.daily,
      sessions: gaData.sessions.daily,
      totalUsers: gaData.totalUsers.daily,
      // ✅ NEU
      conversions: gaData.conversions.daily,
      engagementRate: gaData.engagementRate.daily,
    },
    topQueries,
    aiTraffic,
    countryData,
    channelData,
    deviceData,
    apiErrors: Object.keys(apiErrors).length > 0 ? apiErrors : undefined
  };

  // Debug Log: Zusammenfassung der geholten Daten
  console.log(`[Google Data] Zusammenfassung für ${user.email}:`);
  console.log(`  - GSC Clicks: ${freshData.kpis?.clicks?.value ?? 0}`);
  console.log(`  - GSC Impressions: ${freshData.kpis?.impressions?.value ?? 0}`);
  console.log(`  - GA4 Sessions: ${freshData.kpis?.sessions?.value ?? 0}`);
  console.log(`  - GA4 Users: ${freshData.kpis?.totalUsers?.value ?? 0}`);
  console.log(`  - GA4 Conversions: ${freshData.kpis?.conversions?.value ?? 0}`);
  console.log(`  - Top Queries: ${topQueries.length}`);
  console.log(`  - API Errors: ${Object.keys(apiErrors).join(', ') || 'Keine'}`);
  console.log(`  - Country Data: ${countryData.length} Einträge`);
  console.log(`  - Channel Data: ${channelData.length} Einträge`);
  console.log(`  - Device Data: ${deviceData.length} Einträge`);

  // Cache schreiben
  try {
    console.log(`[Google Cache] 💾 Schreibe Cache für ${user.email} (${dateRange})`);
    await sql`
      INSERT INTO google_data_cache (user_id, date_range, data, last_fetched)
      VALUES (${userId}::uuid, ${dateRange}, ${JSON.stringify(freshData)}::jsonb, NOW())
      ON CONFLICT (user_id, date_range)
      DO UPDATE SET 
        data = ${JSON.stringify(freshData)}::jsonb,
        last_fetched = NOW();
    `;
    console.log(`[Google Cache] ✅ Cache erfolgreich geschrieben`);
  } catch (e) {
    console.error('[Google Cache] ❌ Write Error:', e);
  }

  return freshData;
}
