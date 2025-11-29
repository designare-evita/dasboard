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
} from '@/lib/dashboard-shared';
import type { TopQueryData, ChartPoint } from '@/types/dashboard';

const CACHE_DURATION_HOURS = 48; 

// Hilfsfunktion: Berechnet Veränderung sicher
function calculateChange(current: number, previous: number): number {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Hilfsfunktion: Channels mit Engagement Rate
async function getChannelDataWithEngagement(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ChartEntry[]> {
  try {
    const channelSessions = await getGa4DimensionReport(propertyId, startDate, endDate, 'sessionDefaultChannelGroup');
    
    // Server-Side Import um Build-Fehler zu vermeiden
    const { BetaAnalyticsDataClient } = require('@google-analytics/data');
    const analyticsDataClient = new BetaAnalyticsDataClient();
    
    const [engagementResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'engagementRate' }],
    });

    const engagementMap = new Map<string, number>();
    if (engagementResponse?.rows) {
      for (const row of engagementResponse.rows) {
        const channelName = row.dimensionValues?.[0]?.value || 'Unknown';
        const engagementRate = parseFloat(row.metricValues?.[0]?.value || '0');
        engagementMap.set(channelName, engagementRate * 100);
      }
    }

    return channelSessions.map((item, index) => ({
      ...item,
      fill: `hsl(var(--chart-${(index % 5) + 1}))`,
      subValue: engagementMap.has(item.name) ? `${engagementMap.get(item.name)!.toFixed(1)}%` : undefined,
      subLabel: 'Engagement'
    }));
  } catch (error) {
    console.error('[Channel Engagement] Fallback:', error);
    const fallback = await getGa4DimensionReport(propertyId, startDate, endDate, 'sessionDefaultChannelGroup');
    return fallback.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
  }
}

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
        if ((now - lastFetched) / (1000 * 60 * 60) < CACHE_DURATION_HOURS) {
          console.log(`[Google Cache] ✅ HIT für ${user.email}`);
          return { ...cacheEntry.data, fromCache: true };
        }
      }
    } catch (error) {
      console.warn('[Google Cache] Lesefehler:', error);
    }
  }

  // 2. Daten frisch holen
  console.log(`[Google Cache] 🔄 Lade frische Daten für ${user.email}...`);

  const end = new Date();
  const start = new Date();
  let days = 30;
  if (dateRange === '7d') days = 7;
  if (dateRange === '3m') days = 90;
  if (dateRange === '6m') days = 180;
  if (dateRange === '12m') days = 365;
  start.setDate(end.getDate() - days);
  
  const startDateStr = start.toISOString().split('T')[0];
  const endDateStr = end.toISOString().split('T')[0];

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - days);
  const prevStartStr = prevStart.toISOString().split('T')[0];
  const prevEndStr = prevEnd.toISOString().split('T')[0];

  // Default-Werte um Abstürze zu vermeiden
  let gscData: any = { clicks: { total: 0, daily: [] }, impressions: { total: 0, daily: [] } };
  let gscPrev: any = { clicks: { total: 0 }, impressions: { total: 0 } };
  
  let gaData: any = {
    sessions: { total: 0, daily: [] },
    totalUsers: { total: 0, daily: [] },
    conversions: { total: 0, daily: [] },
    engagementRate: { total: 0, daily: [] },
    bounceRate: { total: 0, daily: [] },
    newUsers: { total: 0, daily: [] },
    avgEngagementTime: { total: 0, daily: [] }
  };
  let gaPrev: any = { ...gaData }; // Copy structure

  let topQueries: TopQueryData[] = [];
  let aiTraffic: AiTrafficData | undefined;
  let countryData: ChartEntry[] = [];
  let channelData: ChartEntry[] = [];
  let deviceData: ChartEntry[] = [];
  let apiErrors: ApiErrorStatus = {};

  // --- GSC FETCH ---
  if (user.gsc_site_url) {
    try {
      const gscRaw = await getSearchConsoleData(user.gsc_site_url, startDateStr, endDateStr);
      // Sicherstellen, dass daily arrays existieren
      gscData = {
        clicks: { total: gscRaw.clicks?.total || 0, daily: gscRaw.clicks?.daily || [] },
        impressions: { total: gscRaw.impressions?.total || 0, daily: gscRaw.impressions?.daily || [] }
      };
      
      const gscPrevRaw = await getSearchConsoleData(user.gsc_site_url, prevStartStr, prevEndStr);
      gscPrev = {
        clicks: { total: gscPrevRaw.clicks?.total || 0 },
        impressions: { total: gscPrevRaw.impressions?.total || 0 }
      };
      topQueries = await getTopQueries(user.gsc_site_url, startDateStr, endDateStr);
    } catch (e: any) {
      console.error('[GSC Error]', e);
      apiErrors.gsc = e.message || 'GSC Fehler';
    }
  }

  // --- GA4 FETCH ---
  if (user.ga4_property_id) {
    try {
      const propertyId = user.ga4_property_id.trim();
      const gaCurrent = await getAnalyticsData(propertyId, startDateStr, endDateStr);
      const gaPrevious = await getAnalyticsData(propertyId, prevStartStr, prevEndStr);
      
      // Übernehme Daten sicher (Fallback auf Default falls API was vergisst)
      gaData = { ...gaData, ...gaCurrent };
      gaPrev = { ...gaPrev, ...gaPrevious };

      try { aiTraffic = await getAiTrafficData(propertyId, startDateStr, endDateStr); } catch (e) {}
      
      try {
        const rawCountry = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'country');
        countryData = rawCountry.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
        
        channelData = await getChannelDataWithEngagement(propertyId, startDateStr, endDateStr);
        
        const rawDevice = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'deviceCategory');
        deviceData = rawDevice.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
      } catch (e) { console.error('[GA4 Dimensions Error]', e); }

    } catch (e: any) {
      console.error('[GA4 Error]', e);
      apiErrors.ga4 = e.message || 'GA4 Fehler';
    }
  }

  // AI Anteil berechnen
  const aiTrafficPercentage = (aiTraffic && gaData.sessions.total > 0)
    ? (aiTraffic.totalSessions / gaData.sessions.total) * 100
    : 0;

  // --- DATEN ZUSAMMENBAUEN ---
  const freshData: ProjectDashboardData = {
    kpis: {
      // GSC
      clicks: { value: gscData.clicks.total, change: calculateChange(gscData.clicks.total, gscPrev.clicks.total) },
      impressions: { value: gscData.impressions.total, change: calculateChange(gscData.impressions.total, gscPrev.impressions.total) },
      
      // GA4
      sessions: { 
        value: gaData.sessions.total, 
        change: calculateChange(gaData.sessions.total, gaPrev.sessions.total),
        aiTraffic: aiTraffic ? { value: aiTraffic.totalSessions, percentage: aiTrafficPercentage } : undefined
      },
      totalUsers: { value: gaData.totalUsers.total, change: calculateChange(gaData.totalUsers.total, gaPrev.totalUsers.total) },
      conversions: { value: gaData.conversions.total, change: calculateChange(gaData.conversions.total, gaPrev.conversions.total) },
      engagementRate: { value: parseFloat((gaData.engagementRate.total * 100).toFixed(2)), change: calculateChange(gaData.engagementRate.total, gaPrev.engagementRate.total) },
      bounceRate: { value: parseFloat((gaData.bounceRate.total * 100).toFixed(2)), change: calculateChange(gaData.bounceRate.total, gaPrev.bounceRate.total) },
      newUsers: { value: gaData.newUsers.total, change: calculateChange(gaData.newUsers.total, gaPrev.newUsers.total) },
      avgEngagementTime: { value: gaData.avgEngagementTime.total, change: calculateChange(gaData.avgEngagementTime.total, gaPrev.avgEngagementTime.total) }
    },
    
    // ✅ CRITICAL FIX: Hier verwenden wir ?. und || [], damit NIEMALS undefined übergeben wird
    charts: {
      clicks: gscData.clicks?.daily || [],
      impressions: gscData.impressions?.daily || [],
      sessions: gaData.sessions?.daily || [],
      totalUsers: gaData.totalUsers?.daily || [],
      conversions: gaData.conversions?.daily || [],
      engagementRate: gaData.engagementRate?.daily || [],
      bounceRate: gaData.bounceRate?.daily || [],
      newUsers: gaData.newUsers?.daily || [],
      avgEngagementTime: gaData.avgEngagementTime?.daily || []
    },
    topQueries,
    aiTraffic,
    countryData,
    channelData,
    deviceData,
    apiErrors: Object.keys(apiErrors).length > 0 ? apiErrors : undefined
  };

  // Cache speichern (auch wenn Daten unvollständig sind, besser als Absturz)
  try {
    await sql`
      INSERT INTO google_data_cache (user_id, date_range, data, last_fetched)
      VALUES (${userId}::uuid, ${dateRange}, ${JSON.stringify(freshData)}::jsonb, NOW())
      ON CONFLICT (user_id, date_range)
      DO UPDATE SET data = ${JSON.stringify(freshData)}::jsonb, last_fetched = NOW();
    `;
  } catch (e) { console.error('[Cache Write Error]', e); }

  return freshData;
}
