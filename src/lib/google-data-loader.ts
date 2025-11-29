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

// ========== KONSTANTEN ==========
const CACHE_DURATION_HOURS = 48; 

type GscData = { clicks: { total: number, daily: ChartPoint[] }, impressions: { total: number, daily: ChartPoint[] } };

type GaData = { 
  sessions: { total: number, daily: ChartPoint[] }, 
  totalUsers: { total: number, daily: ChartPoint[] },
  conversions: { total: number, daily: ChartPoint[] },
  engagementRate: { total: number, daily: ChartPoint[] },
  bounceRate: { total: number, daily: ChartPoint[] },
  newUsers: { total: number, daily: ChartPoint[] },
  avgEngagementTime: { total: number, daily: ChartPoint[] }
};

const DEFAULT_GSC_DATA: GscData = { clicks: { total: 0, daily: [] }, impressions: { total: 0, daily: [] } };
const DEFAULT_GSC_PREVIOUS = { clicks: { total: 0 }, impressions: { total: 0 } };

const DEFAULT_GA_DATA: GaData = { 
  sessions: { total: 0, daily: [] }, 
  totalUsers: { total: 0, daily: [] },
  conversions: { total: 0, daily: [] },
  engagementRate: { total: 0, daily: [] },
  bounceRate: { total: 0, daily: [] },
  newUsers: { total: 0, daily: [] },
  avgEngagementTime: { total: 0, daily: [] }
};

const DEFAULT_GA_PREVIOUS = { 
  sessions: { total: 0 }, 
  totalUsers: { total: 0 }, 
  conversions: { total: 0 }, 
  engagementRate: { total: 0 },
  bounceRate: { total: 0 },
  newUsers: { total: 0 },
  avgEngagementTime: { total: 0 }
};

// ========== HILFSFUNKTIONEN ==========

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
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
          console.log(`[Google Cache] ✅ HIT für ${user.email}`);
          return { ...cacheEntry.data, fromCache: true };
        }
      }
    } catch (error) {
      console.warn('[Google Cache] Fehler beim Lesen:', error);
    }
  }

  // 2. Daten frisch holen
  console.log(`[Google Cache] 🔄 Fetching fresh data for ${user.email}...`);

  const end = new Date();
  const start = new Date();
  let days = 30;
  if (dateRange === '7d') days = 7;
  if (dateRange === '30d') days = 30;
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
      const gscPrevRaw = await getSearchConsoleData(user.gsc_site_url, prevStartStr, prevEndStr);
      gscPrev = {
        clicks: { total: gscPrevRaw.clicks.total },
        impressions: { total: gscPrevRaw.impressions.total }
      };
      topQueries = await getTopQueries(user.gsc_site_url, startDateStr, endDateStr);
    } catch (e: any) {
      apiErrors.gsc = e.message || 'GSC Fehler';
    }
  }

  // --- FETCH: GA4 ---
  if (user.ga4_property_id) {
    try {
      const propertyId = user.ga4_property_id.trim();

      const gaCurrent = await getAnalyticsData(propertyId, startDateStr, endDateStr);
      const gaPrevious = await getAnalyticsData(propertyId, prevStartStr, prevEndStr);
      
      gaData = {
        sessions: gaCurrent.sessions,
        totalUsers: gaCurrent.totalUsers,
        conversions: gaCurrent.conversions,
        engagementRate: gaCurrent.engagementRate,
        bounceRate: gaCurrent.bounceRate,
        newUsers: gaCurrent.newUsers,
        avgEngagementTime: gaCurrent.avgEngagementTime
      };
      
      gaPrev = {
        sessions: { total: gaPrevious.sessions.total },
        totalUsers: { total: gaPrevious.totalUsers.total },
        conversions: { total: gaPrevious.conversions.total },
        engagementRate: { total: gaPrevious.engagementRate.total },
        bounceRate: { total: gaPrevious.bounceRate.total },
        newUsers: { total: gaPrevious.newUsers.total },
        avgEngagementTime: { total: gaPrevious.avgEngagementTime.total }
      };

      try { aiTraffic = await getAiTrafficData(propertyId, startDateStr, endDateStr); } catch (e) {}
      try {
        const rawCountryData = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'country');
        const rawChannelData = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'sessionDefaultChannelGroup');
        const rawDeviceData = await getGa4DimensionReport(propertyId, startDateStr, endDateStr, 'deviceCategory');
        
        countryData = rawCountryData.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
        channelData = rawChannelData.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
        deviceData = rawDeviceData.map((item, index) => ({ ...item, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));
      } catch (e) {}

    } catch (e: any) {
      apiErrors.ga4 = e.message || 'GA4 Fehler';
    }
  }

  // ✅ BERECHNUNG DES AI ANTEILS
  let aiTrafficPercentage = 0;
  if (aiTraffic && gaData.sessions.total > 0) {
    aiTrafficPercentage = (aiTraffic.totalSessions / gaData.sessions.total) * 100;
  }

  // Daten zusammenbauen
  const freshData: ProjectDashboardData = {
    kpis: {
      clicks: { value: gscData.clicks.total, change: calculateChange(gscData.clicks.total, gscPrev.clicks.total) },
      impressions: { value: gscData.impressions.total, change: calculateChange(gscData.impressions.total, gscPrev.impressions.total) },
      
      // ✅ HIER: AI Traffic Info hinzufügen, damit sie im Frontend ankommt
      sessions: { 
        value: gaData.sessions.total, 
        change: calculateChange(gaData.sessions.total, gaPrev.sessions.total),
        aiTraffic: aiTraffic ? {
          value: aiTraffic.totalSessions,
          percentage: aiTrafficPercentage
        } : undefined
      },
      
      totalUsers: { value: gaData.totalUsers.total, change: calculateChange(gaData.totalUsers.total, gaPrev.totalUsers.total) },
      conversions: { value: gaData.conversions.total, change: calculateChange(gaData.conversions.total, gaPrev.conversions.total) },
      engagementRate: { 
        value: parseFloat((gaData.engagementRate.total * 100).toFixed(2)), 
        change: calculateChange(gaData.engagementRate.total, gaPrev.engagementRate.total) 
      },
      bounceRate: {
        value: parseFloat((gaData.bounceRate.total * 100).toFixed(2)),
        change: calculateChange(gaData.bounceRate.total, gaPrev.bounceRate.total)
      },
      newUsers: {
        value: gaData.newUsers.total,
        change: calculateChange(gaData.newUsers.total, gaPrev.newUsers.total)
      },
      avgEngagementTime: {
        value: gaData.avgEngagementTime.total,
        change: calculateChange(gaData.avgEngagementTime.total, gaPrev.avgEngagementTime.total)
      }
    },
    charts: {
      clicks: gscData.clicks.daily,
      impressions: gscData.impressions.daily,
      sessions: gaData.sessions.daily,
      totalUsers: gaData.totalUsers.daily,
      conversions: gaData.conversions.daily,
      engagementRate: gaData.engagementRate.daily,
      bounceRate: gaData.bounceRate.daily,
      newUsers: gaData.newUsers.daily,
      avgEngagementTime: gaData.avgEngagementTime.daily
    },
    topQueries,
    aiTraffic,
    countryData,
    channelData,
    deviceData,
    apiErrors: Object.keys(apiErrors).length > 0 ? apiErrors : undefined
  };

  try {
    await sql`
      INSERT INTO google_data_cache (user_id, date_range, data, last_fetched)
      VALUES (${userId}::uuid, ${dateRange}, ${JSON.stringify(freshData)}::jsonb, NOW())
      ON CONFLICT (user_id, date_range)
      DO UPDATE SET data = ${JSON.stringify(freshData)}::jsonb, last_fetched = NOW();
    `;
  } catch (e) { console.error(e); }

  return freshData;
}
