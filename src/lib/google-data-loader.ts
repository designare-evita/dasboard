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
import { BetaAnalyticsDataClient } from '@google-analytics/data';

// ========== KONSTANTEN ==========
const CACHE_DURATION_HOURS = 48; 

// Typ-Aliase
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

/**
 * Erweiterte GA4 Funktion für Conversions & Engagement
 */
async function fetchEnhancedGa4Data(
  propertyId: string, 
  startDate: string, 
  endDate: string, 
  prevStartDate: string, 
  prevEndDate: string
): Promise<{ current: GaData, previous: typeof DEFAULT_GA_PREVIOUS }> {
  
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Service Account Credentials fehlen');
  }

  const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
  });

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      { startDate, endDate },          // Range 0: Aktuell
      { startDate: prevStartDate, endDate: prevEndDate }, // Range 1: Vergleich
    ],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'conversions' },     // Früher "conversions", Google nennt es jetzt oft "keyEvents", API bleibt meist "conversions"
      { name: 'engagementRate' }
    ],
    orderBys: [{ dimension: { orderType: 'ALPHANUMERIC', dimensionName: 'date' } }],
    keepEmptyRows: true,
  });

  // Container für aggregierte Daten
  let curSessions = 0, curUsers = 0, curConversions = 0, curWeightedEngagement = 0;
  let prevSessions = 0, prevUsers = 0, prevConversions = 0, prevWeightedEngagement = 0;

  const chartSessions: Array<{ date: number; value: number }> = [];
  const chartUsers: Array<{ date: number; value: number }> = [];
  const chartConversions: Array<{ date: number; value: number }> = [];
  const chartEngagement: Array<{ date: number; value: number }> = [];

  const rows = response.rows || [];

  rows.forEach((row) => {
    const dateStr = row.dimensionValues?.[0].value; // YYYYMMDD
    if (!dateStr) return;

    // Datum parsen (YYYYMMDD -> Timestamp)
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);
    const timestamp = new Date(year, month, day).getTime();

    // Werte extrahieren
    const metricValues = row.metricValues || [];
    const sessions = parseInt(metricValues[0].value || '0', 10);
    const users = parseInt(metricValues[1].value || '0', 10);
    const conversions = parseInt(metricValues[2].value || '0', 10);
    const engagementRate = parseFloat(metricValues[3].value || '0');

    // Range prüfen (0 = aktuell, 1 = vorher)
    // Die API gibt keine explizite Range-ID pro Row bei Zeitverlauf zurück in dieser Form, 
    // sondern wir müssen aufpassen. 
    // KORREKTUR: Bei Zeitverlauf + DateRange Comparison liefert die API oft duplizierte Dates.
    // Sicherer ist es, zwei getrennte Requests zu machen ODER wir vereinfachen hier für das Dashboard:
    // Wir nehmen an, dass 'date' Dimension primär für den Chart (aktueller Zeitraum) ist.
    // Für die Totals des Vergleichszeitraums ist ein separater Request ohne 'date' Dimension sicherer/einfacher.
    
    // Workaround für hier: Wir summieren nur Current Range für Charts.
    // Da die API bei Multi-Range + Time Dimension komplex ist, prüfen wir, ob das Datum im aktuellen Bereich liegt.
    // (Einfachheitshalber nehmen wir an, response enthält nur aktuelle Range für Charts, 
    // und wir machen einen 2. Request für Totals, um exakt zu sein. Aber um Code klein zu halten -> simple logic)
    
    // BESSERER WEG: Wir nutzen hier nur die "Current" Daten für Charts und Summen.
    // Die "Previous" Summen holen wir aus einem separaten, schnellen Request ohne Dimensionen.
    
    curSessions += sessions;
    curUsers += users;
    curConversions += conversions;
    curWeightedEngagement += (engagementRate * sessions); // Gewichtung

    chartSessions.push({ date: timestamp, value: sessions });
    chartUsers.push({ date: timestamp, value: users });
    chartConversions.push({ date: timestamp, value: conversions });
    chartEngagement.push({ date: timestamp, value: engagementRate * 100 }); // % für Chart
  });

  // Durchschnittliche Engagement Rate berechnen
  const avgEngagement = curSessions > 0 ? (curWeightedEngagement / curSessions) : 0;

  // 2. Request für exakte Vorperioden-Summen (sicherer als Row-Matching)
  const [prevResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: prevStartDate, endDate: prevEndDate }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'conversions' },
      { name: 'engagementRate' }
    ]
  });

  const prevMetrics = prevResponse.rows?.[0]?.metricValues || [];
  if (prevMetrics.length > 0) {
    prevSessions = parseInt(prevMetrics[0].value || '0', 10);
    prevUsers = parseInt(prevMetrics[1].value || '0', 10);
    prevConversions = parseInt(prevMetrics[2].value || '0', 10);
    const prevAvgEng = parseFloat(prevMetrics[3].value || '0');
    
    // Bei Engagement Rate kommt der Durchschnitt direkt aus der API, wenn keine Date-Dimension dabei ist!
    // Das ist viel genauer.
    prevWeightedEngagement = prevAvgEng; // Hack: Wir speichern den direkten Wert
  }

  return {
    current: {
      sessions: { total: curSessions, daily: chartSessions },
      totalUsers: { total: curUsers, daily: chartUsers },
      conversions: { total: curConversions, daily: chartConversions },
      engagementRate: { total: avgEngagement, daily: chartEngagement }
    },
    previous: {
      sessions: { total: prevSessions },
      totalUsers: { total: prevUsers },
      conversions: { total: prevConversions },
      engagementRate: { total: prevWeightedEngagement } // Hier steht der echte Durchschnitt drin
    }
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
          console.log(`[Google Cache] ✅ HIT für ${user.email} (${dateRange})`);
          return { ...cacheEntry.data, fromCache: true };
        } else {
          console.log(`[Google Cache] ⏳ Cache abgelaufen (${cacheAgeHours.toFixed(1)}h)`);
        }
      }
    } catch (error) {
      console.warn('[Google Cache] Fehler beim Lesen:', error);
    }
  }

  // 2. Daten frisch holen
  console.log(`[Google Cache] 🔄 Fetching fresh data for ${user.email}...`);

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
      // Neue erweiterte Funktion aufrufen
      const gaResult = await fetchEnhancedGa4Data(
        user.ga4_property_id, 
        startDateStr, endDateStr, 
        prevStartStr, prevEndStr
      );
      gaData = gaResult.current;
      gaPrev = gaResult.previous;

      // AI Traffic
      aiTraffic = await getAiTrafficData(user.ga4_property_id, startDateStr, endDateStr);

      // Pie Charts (Länder, Kanäle, Geräte)
      countryData = await getGa4DimensionReport(user.ga4_property_id, startDateStr, endDateStr, 'country');
      channelData = await getGa4DimensionReport(user.ga4_property_id, startDateStr, endDateStr, 'sessionDefaultChannelGroup');
      deviceData = await getGa4DimensionReport(user.ga4_property_id, startDateStr, endDateStr, 'deviceCategory');

    } catch (e: any) {
      console.error('[GA4 Fetch Error]', e);
      apiErrors.ga4 = e.message || 'GA4 Fehler';
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

  // Cache schreiben
  try {
    await sql`
      INSERT INTO google_data_cache (user_id, date_range, data, last_fetched)
      VALUES (${userId}::uuid, ${dateRange}, ${JSON.stringify(freshData)}::jsonb, NOW())
      ON CONFLICT (user_id, date_range)
      DO UPDATE SET 
        data = ${JSON.stringify(freshData)}::jsonb,
        last_fetched = NOW();
    `;
  } catch (e) {
    console.error('[Google Cache] Write Error:', e);
  }

  return freshData;
}
