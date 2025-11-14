// src/lib/google-data-loader.ts (VERBESSERT + KREISDIAGRAMME)

import { sql } from '@vercel/postgres';
import { User } from '@/types';
import {
  getSearchConsoleData,
  getAnalyticsData,
  getTopQueries,
  getAiTrafficData,
  getGa4DimensionReport, // ✅ NEU: Für Kreisdiagramm-Daten
  type AiTrafficData
} from '@/lib/google-api';
import { ProjectDashboardData, ChartEntry } from '@/lib/dashboard-shared'; // ✅ NEU: ChartEntry importieren

// ========== KONSTANTEN ==========
const CACHE_DURATION_HOURS = 48; // 48-Stunden-Cache

interface DailyDataPoint { date: string; value: number; }
type GscData = { clicks: { total: number, daily: DailyDataPoint[] }, impressions: { total: number, daily: DailyDataPoint[] } };
type GaData = { sessions: { total: number, daily: DailyDataPoint[] }, totalUsers: { total: number, daily: DailyDataPoint[] } };
type TopQueryData = Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number; }>;

const DEFAULT_GSC_DATA: GscData = { clicks: { total: 0, daily: [] }, impressions: { total: 0, daily: [] } };
const DEFAULT_GSC_PREVIOUS = { clicks: { total: 0 }, impressions: { total: 0 } };
const DEFAULT_GA_DATA: GaData = { sessions: { total: 0, daily: [] }, totalUsers: { total: 0, daily: [] } };
const DEFAULT_GA_PREVIOUS = { sessions: { total: 0 }, totalUsers: { total: 0 } };
const DEFAULT_TOP_QUERIES: TopQueryData = [];
const DEFAULT_AI_TRAFFIC: AiTrafficData = {
  totalSessions: 0, totalUsers: 0, sessionsBySource: {}, topAiSources: [], trend: [],
  totalSessionsChange: 0, totalUsersChange: 0,
};

// ========== HILFSFUNKTIONEN ==========
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const currentNum = typeof current === 'number' && !isNaN(current) ? current : 0;
  const previousNum = typeof previous === 'number' && !isNaN(previous) ? previous : 0;
  if (previousNum === 0) return currentNum > 0 ? 100 : 0;
  const change = ((currentNum - previousNum) / previousNum) * 100;
  return Math.round(change * 10) / 10;
}

// ========== KREISDIAGRAMM-HILFSFUNKTIONEN ==========
// ✅ NEU: Farbpaletten für die Diagramme
const PIE_COLORS_CHANNELS = [
  '#2563eb', // Organic Search
  '#f59e0b', // Paid Search
  '#10b981', // Direct
  '#6366f1', // Referral
  '#ec4899', // Social
  '#6b7280', // Sonstige
];

const PIE_COLORS_DEVICES = [
  '#3b82f6', // desktop
  '#16a34a', // mobile
  '#f97316', // tablet
  '#6b7280', // Sonstige
];

const PIE_COLORS_COUNTRIES = [
  '#3b82f6', '#60a5fa', '#93c5fd', // Blau-Töne
  '#10b981', '#34d399', '#6ee7b7', // Grün-Töne
  '#f59e0b', '#fcd34d', '#fef08a', // Gelb-Töne
  '#6b7280', // Sonstige
];

// ✅ NEU: Helper zum Formatieren der Daten für Kuchendiagramme
function formatPieData(
  data: Array<{ name: string; value: number }>, 
  colorPalette: string[]
): ChartEntry[] {
  // Übersetzungen für häufige Werte
  const translations: Record<string, string> = {
    'Organic Search': 'Organisch',
    'Paid Search': 'Bezahlt',
    'Direct': 'Direkt',
    'Referral': 'Verweise',
    'Organic Social': 'Social Media',
    'desktop': 'Desktop',
    'mobile': 'Smartphone',
    'tablet': 'Tablet',
    '(not set)': 'Unbekannt',
  };

  return data.map((item, index) => ({
    ...item,
    name: translations[item.name] || item.name,
    fill: colorPalette[index % colorPalette.length],
  }));
}

// ========== DATENLADE-FUNKTION ==========
async function fetchFreshGoogleData(user: Partial<User>, dateRange: string = '30d') {
  
  // Prüfe, ob überhaupt Datenquellen konfiguriert sind
  if (!user.gsc_site_url && !user.ga4_property_id) {
    console.warn(`[Google Cache FETCH] ⚠️ Benutzer ${user.email} hat WEDER GSC noch GA4 konfiguriert`);
    return null;
  }

  // ========== ZEITBEREICHS-BERECHNUNG ==========
  const today = new Date();
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 1); 
  
  const startDateCurrent = new Date(endDateCurrent);
  let daysBack: number;
  
  switch (dateRange) {
    case '3m': daysBack = 90; break;
    case '6m': daysBack = 180; break;
    case '12m': daysBack = 365; break;
    case '30d': default: daysBack = 29; break;
  }
  
  startDateCurrent.setDate(startDateCurrent.getDate() - daysBack);
  
  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - daysBack);
  
  const sDateCurrent = formatDate(startDateCurrent);
  const eDateCurrent = formatDate(endDateCurrent);
  const sDatePrevious = formatDate(startDatePrevious);
  const eDatePrevious = formatDate(endDatePrevious);

  console.log(`[Google Cache FETCH] 📅 Zeitraum Aktuell: ${sDateCurrent} bis ${eDateCurrent}`);
  console.log(`[Google Cache FETCH] 📅 Zeitraum Vorher: ${sDatePrevious} bis ${eDatePrevious}`);

  // ========== DATEN-INITIALISIERUNG ==========
  let gscCurrent: GscData = DEFAULT_GSC_DATA;
  let gscPrevious: { clicks: { total: number }, impressions: { total: number } } = DEFAULT_GSC_PREVIOUS;
  let topQueries: TopQueryData = DEFAULT_TOP_QUERIES;
  let gaCurrent: GaData = DEFAULT_GA_DATA;
  let gaPrevious: { sessions: { total: number }, totalUsers: { total: number } } = DEFAULT_GA_PREVIOUS;
  let aiTrafficCurrent: AiTrafficData = DEFAULT_AI_TRAFFIC;
  let aiTrafficPrevious: AiTrafficData = DEFAULT_AI_TRAFFIC;
  // ✅ NEU: Initialisierung für Kreisdiagramm-Daten
  let countryData: ChartEntry[] = [];
  let channelData: ChartEntry[] = [];
  let deviceData: ChartEntry[] = [];

  try {
    console.log(`[Google Cache FETCH] 🔄 Lade frische Google-Daten für ${user.email} (${dateRange})`);

    // ========== PROMISES VORBEREITEN ==========
    const gscPromises = [];
    const ga4Promises = [];

    if (user.gsc_site_url) {
      console.log(`[Google Cache FETCH] ✅ GSC konfiguriert: ${user.gsc_site_url}`);
      gscPromises.push(
        getSearchConsoleData(user.gsc_site_url, sDateCurrent, eDateCurrent),
        getSearchConsoleData(user.gsc_site_url, sDatePrevious, eDatePrevious),
        getTopQueries(user.gsc_site_url, sDateCurrent, eDateCurrent)
      );
    } else {
      console.log(`[Google Cache FETCH] ⚠️ GSC nicht konfiguriert`);
    }

    if (user.ga4_property_id) {
      console.log(`[Google Cache FETCH] ✅ GA4 konfiguriert: ${user.ga4_property_id}`);
      ga4Promises.push(
        getAnalyticsData(user.ga4_property_id, sDateCurrent, eDateCurrent),
        getAnalyticsData(user.ga4_property_id, sDatePrevious, eDatePrevious),
        getAiTrafficData(user.ga4_property_id, sDateCurrent, eDateCurrent),
        getAiTrafficData(user.ga4_property_id, sDatePrevious, eDatePrevious),
        // ✅ NEU: Drei neue Abfragen für die Kreisdiagramme
        getGa4DimensionReport(user.ga4_property_id, sDateCurrent, eDateCurrent, 'country'),
        getGa4DimensionReport(user.ga4_property_id, sDateCurrent, eDateCurrent, 'sessionDefaultChannelGroup'),
        getGa4DimensionReport(user.ga4_property_id, sDateCurrent, eDateCurrent, 'deviceCategory')
      );
    } else {
      console.log(`[Google Cache FETCH] ⚠️ GA4 nicht konfiguriert`);
    }

    // ========== PARALLEL FETCHING ==========
    console.log(`[Google Cache FETCH] 🚀 Starte parallele API-Abfragen...`);
    const startTime = Date.now();
    
    const [gscResults, ga4Results] = await Promise.all([
      Promise.allSettled(gscPromises),
      Promise.allSettled(ga4Promises)
    ]);
    
    const fetchDuration = Date.now() - startTime;
    console.log(`[Google Cache FETCH] ⏱️ API-Abfragen abgeschlossen in ${fetchDuration}ms`);

    // ========== GSC ERGEBNISSE VERARBEITEN ==========
    if (gscResults.length > 0) {
      if (gscResults[0].status === 'fulfilled') {
        gscCurrent = gscResults[0].value as GscData;
        console.log(`[Google Cache FETCH] ✅ GSC Current: ${gscCurrent.clicks.total} Klicks`);
      } else {
        console.error(`[Google Cache FETCH] ❌ GSC Current failed:`, gscResults[0].reason);
      }
      
      if (gscResults[1].status === 'fulfilled') {
        gscPrevious = gscResults[1].value as typeof gscPrevious;
        console.log(`[Google Cache FETCH] ✅ GSC Previous: ${gscPrevious.clicks.total} Klicks`);
      } else {
        console.error(`[Google Cache FETCH] ❌ GSC Previous failed:`, gscResults[1].reason);
      }
      
      if (gscResults[2].status === 'fulfilled') {
        topQueries = gscResults[2].value as TopQueryData;
        console.log(`[Google Cache FETCH] ✅ Top Queries: ${topQueries.length} Einträge`);
      } else {
        console.error(`[Google Cache FETCH] ❌ Top Queries failed:`, gscResults[2].reason);
      }
    }

    // ========== GA4 ERGEBNISSE VERARBEITEN ==========
    if (ga4Results.length > 0) {
      if (ga4Results[0].status === 'fulfilled') {
        gaCurrent = ga4Results[0].value as GaData;
        console.log(`[Google Cache FETCH] ✅ GA4 Current: ${gaCurrent.sessions.total} Sitzungen`);
      } else {
        console.error(`[Google Cache FETCH] ❌ GA4 Current failed:`, ga4Results[0].reason);
      }
      
      if (ga4Results[1].status === 'fulfilled') {
        gaPrevious = ga4Results[1].value as typeof gaPrevious;
        console.log(`[Google Cache FETCH] ✅ GA4 Previous: ${gaPrevious.sessions.total} Sitzungen`);
      } else {
        console.error(`[Google Cache FETCH] ❌ GA4 Previous failed:`, ga4Results[1].reason);
      }
      
      if (ga4Results[2].status === 'fulfilled') {
        aiTrafficCurrent = ga4Results[2].value as AiTrafficData;
        console.log(`[Google Cache FETCH] ✅ AI Traffic Current: ${aiTrafficCurrent.totalSessions} Sitzungen`);
      } else {
        console.error(`[Google Cache FETCH] ❌ AI Traffic Current failed:`, ga4Results[2].reason);
      }
      
      if (ga4Results[3].status === 'fulfilled') {
        aiTrafficPrevious = ga4Results[3].value as AiTrafficData;
        console.log(`[Google Cache FETCH] ✅ AI Traffic Previous: ${aiTrafficPrevious.totalSessions} Sitzungen`);
      } else {
        console.error(`[Google Cache FETCH] ❌ AI Traffic Previous failed:`, ga4Results[3].reason);
      }
      
      // ✅ NEU: Verarbeitung der Kreisdiagramm-Daten
      if (ga4Results[4]?.status === 'fulfilled') {
        const rawData = ga4Results[4].value as Array<{ name: string; value: number }>;
        countryData = formatPieData(rawData, PIE_COLORS_COUNTRIES);
        console.log(`[Google Cache FETCH] ✅ Länder-Daten: ${countryData.length} Segmente`);
      } else {
        console.error(`[Google Cache FETCH] ❌ Länder-Daten failed:`, ga4Results[4]?.reason);
      }
      
      if (ga4Results[5]?.status === 'fulfilled') {
        const rawData = ga4Results[5].value as Array<{ name: string; value: number }>;
        channelData = formatPieData(rawData, PIE_COLORS_CHANNELS);
        console.log(`[Google Cache FETCH] ✅ Channel-Daten: ${channelData.length} Segmente`);
      } else {
        console.error(`[Google Cache FETCH] ❌ Channel-Daten failed:`, ga4Results[5]?.reason);
      }
      
      if (ga4Results[6]?.status === 'fulfilled') {
        const rawData = ga4Results[6].value as Array<{ name: string; value: number }>;
        deviceData = formatPieData(rawData, PIE_COLORS_DEVICES);
        console.log(`[Google Cache FETCH] ✅ Geräte-Daten: ${deviceData.length} Segmente`);
      } else {
        console.error(`[Google Cache FETCH] ❌ Geräte-Daten failed:`, ga4Results[6]?.reason);
      }
    }

    // ========== DATEN AUFBEREITEN ==========
    console.log(`[Google Cache FETCH] 📊 Bereite Dashboard-Daten auf...`);
    
    aiTrafficCurrent.totalSessionsChange = calculateChange(
      aiTrafficCurrent.totalSessions,
      aiTrafficPrevious.totalSessions
    );
    aiTrafficCurrent.totalUsersChange = calculateChange(
      aiTrafficCurrent.totalUsers,
      aiTrafficPrevious.totalUsers
    );
    
    const totalSessions = gaCurrent.sessions.total ?? 0;
    const aiSessionsPercentage = totalSessions > 0
      ? (aiTrafficCurrent.totalSessions / totalSessions) * 100
      : 0;

    // ========== RÜCKGABEOBJEKT ERSTELLEN ==========
    const result: ProjectDashboardData = { // ✅ NEU: Expliziter Typ
      kpis: {
        clicks: {
          value: gscCurrent.clicks.total ?? 0,
          change: calculateChange(gscCurrent.clicks.total ?? 0, gscPrevious.clicks.total ?? 0)
        },
        impressions: {
          value: gscCurrent.impressions.total ?? 0,
          change: calculateChange(gscCurrent.impressions.total ?? 0, gscPrevious.impressions.total ?? 0)
        },
        sessions: {
          value: gaCurrent.sessions.total ?? 0,
          change: calculateChange(gaCurrent.sessions.total ?? 0, gaPrevious.sessions.total ?? 0),
          aiTraffic: {
            value: aiTrafficCurrent.totalSessions,
            percentage: aiSessionsPercentage,
            change: aiTrafficCurrent.totalSessionsChange
          }
        },
        totalUsers: {
          value: gaCurrent.totalUsers.total ?? 0,
          change: calculateChange(gaCurrent.totalUsers.total ?? 0, gaPrevious.totalUsers.total ?? 0)
        },
      },
      charts: {
        clicks: gscCurrent.clicks.daily ?? [],
        impressions: gscCurrent.impressions.daily ?? [],
        sessions: gaCurrent.sessions.daily ?? [],
        totalUsers: gaCurrent.totalUsers.daily ?? [],
      },
      topQueries,
      aiTraffic: aiTrafficCurrent,
      // ✅ NEU: Hinzufügen der Kreisdiagramm-Daten
      countryData,
      channelData,
      deviceData,
    };

    console.log(`[Google Cache FETCH] ✅ Dashboard-Daten erfolgreich aufbereitet`);
    return result;

  } catch (error) {
    console.error('[Google Cache FETCH] ❌ Schwerwiegender Fehler beim Abrufen der Google-Daten:', error);
    throw error;
  }
}

// ========== CACHING-WRAPPER-FUNKTION ==========
type GoogleCacheData = Awaited<ReturnType<typeof fetchFreshGoogleData>>;

export async function getOrFetchGoogleData(user: Partial<User>, dateRange: string = '30d') {
  const userId = user.id;
  
  if (!userId) {
    throw new Error("User ID ist für Caching erforderlich.");
  }
  
  console.log(`\n========== GOOGLE CACHE START ==========`);
  console.log(`[Google Cache] User: ${user.email}`);
  console.log(`[Google Cache] Date Range: ${dateRange}`);
  
  // ========== 1. CACHE PRÜFEN ==========
  try {
    console.log(`[Google Cache] 🔍 Prüfe Cache...`);
    
    const { rows } = await sql`
      SELECT data, last_fetched 
      FROM google_data_cache
      WHERE user_id::text = ${userId} AND date_range = ${dateRange}
    `;

    if (rows.length > 0) {
      const cache = rows[0];
      const lastFetched = new Date(cache.last_fetched);
      const now = new Date();
      const ageInHours = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60);

      console.log(`[Google Cache] 📦 Cache gefunden. Alter: ${ageInHours.toFixed(2)} Stunden`);
      console.log(`[Google Cache] 📦 Cache-Zeitstempel: ${lastFetched.toISOString()}`);
      console.log(`[Google Cache] 📦 Cache-Gültigkeit: ${CACHE_DURATION_HOURS} Stunden`);

      if (ageInHours < CACHE_DURATION_HOURS) {
        console.log(`[Google Cache] ✅ CACHE HIT - Nutze gecachte Daten`);
        console.log(`========== GOOGLE CACHE END ==========\n`);
        return { ...(cache.data as GoogleCacheData), fromCache: true };
      }
      
      console.log(`[Google Cache] ⏰ CACHE STALE - Cache ist veraltet (${ageInHours.toFixed(2)}h > ${CACHE_DURATION_HOURS}h)`);
    } else {
      console.log(`[Google Cache] ❌ CACHE MISS - Kein Cache-Eintrag gefunden`);
    }

  } catch (cacheReadError) {
    console.error("[Google Cache] ❌ Fehler beim Lesen aus google_data_cache:", cacheReadError);
    console.log(`[Google Cache] ➡️ Fahre mit Live-Fetch fort...`);
  }
  
  // ========== 2. LIVE-FETCH ==========
  console.log(`[Google Cache] 🔄 CACHE MISS/STALE - Lade frische Daten...`);
  
  let freshData: GoogleCacheData;
  
  try {
    freshData = await fetchFreshGoogleData(user, dateRange);
  } catch (fetchError) {
    console.error('[Google Cache] ❌ Fehler beim Fetchen der Daten:', fetchError);
    console.log(`========== GOOGLE CACHE END ==========\n`);
    throw fetchError;
  }

  if (!freshData) {
    console.log(`[Google Cache] ⚠️ Keine Daten verfügbar (User hat weder GSC noch GA4)`);
    console.log(`========== GOOGLE CACHE END ==========\n`);
    return null; 
  }

  // ========== 3. CACHE SCHREIBEN ==========
  try {
    console.log(`[Google Cache] 💾 Schreibe Daten in Cache...`);
    
    await sql`
      INSERT INTO google_data_cache (user_id, date_range, data, last_fetched)
      VALUES (${userId}::uuid, ${dateRange}, ${JSON.stringify(freshData)}::jsonb, NOW())
      ON CONFLICT (user_id, date_range)
      DO UPDATE SET 
        data = ${JSON.stringify(freshData)}::jsonb,
        last_fetched = NOW();
    `;
    
    console.log(`[Google Cache] ✅ Cache erfolgreich geschrieben`);
  } catch (cacheWriteError) {
    console.error("[Google Cache] ⚠️ Fehler beim Schreiben in google_data_cache:", cacheWriteError);
    console.log("[Google Cache] ➡️ User erhält trotzdem die frischen Daten");
  }
  
  console.log(`[Google Cache] ✅ Rückgabe: Frische Daten (fromCache: false)`);
  console.log(`========== GOOGLE CACHE END ==========\n`);
  
  return { ...freshData, fromCache: false };
}
