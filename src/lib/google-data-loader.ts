// src/lib/google-data-loader.ts

import { sql } from '@vercel/postgres';
import { User } from '@/types';
import {
  getSearchConsoleData,
  getAnalyticsData,
  getTopQueries,
  getAiTrafficData,
  type AiTrafficData
} from '@/lib/google-api';
import { ProjectDashboardData } from '@/lib/dashboard-shared'; // Importiere den Haupt-Typ

// --- KONSTANTEN & TYPEN (Verschoben von api/data/route.ts) ---
const CACHE_DURATION_HOURS = 48; // Unser 48-Stunden-Cache

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

// --- HILFSFUNKTIONEN (Verschoben von api/data/route.ts) ---
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

// --- DATENLADE-FUNKTION (Verschoben von api/data/route.ts) ---
// Umbenannt in 'fetchFreshGoogleData'
async function fetchFreshGoogleData(user: Partial<User>, dateRange: string = '30d') {
  
  if (!user.gsc_site_url && !user.ga4_property_id) {
    console.warn(`[Cache FETCH] Benutzer ${user.email} hat WEDER GSC noch GA4-Daten konfiguriert.`);
    return null;
  }

  // (Datumsberechnungen)
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

  // (Daten-Initialisierung)
  let gscCurrent: GscData = DEFAULT_GSC_DATA;
  let gscPrevious: { clicks: { total: number }, impressions: { total: number } } = DEFAULT_GSC_PREVIOUS;
  let topQueries: TopQueryData = DEFAULT_TOP_QUERIES;
  let gaCurrent: GaData = DEFAULT_GA_DATA;
  let gaPrevious: { sessions: { total: number }, totalUsers: { total: number } } = DEFAULT_GA_PREVIOUS;
  let aiTrafficCurrent: AiTrafficData = DEFAULT_AI_TRAFFIC;
  let aiTrafficPrevious: AiTrafficData = DEFAULT_AI_TRAFFIC;

  try {
    console.log(`[Cache FETCH] Lade frische Google-Daten für ${user.email} (${dateRange})`);

    const gscPromises = [];
    const ga4Promises = [];

    if (user.gsc_site_url) {
      gscPromises.push(getSearchConsoleData(user.gsc_site_url, sDateCurrent, eDateCurrent));
      gscPromises.push(getSearchConsoleData(user.gsc_site_url, sDatePrevious, eDatePrevious));
      gscPromises.push(getTopQueries(user.gsc_site_url, sDateCurrent, eDateCurrent));
    }

    if (user.ga4_property_id) {
      ga4Promises.push(getAnalyticsData(user.ga4_property_id, sDateCurrent, eDateCurrent));
      ga4Promises.push(getAnalyticsData(user.ga4_property_id, sDatePrevious, eDatePrevious));
      ga4Promises.push(getAiTrafficData(user.ga4_property_id, sDateCurrent, eDateCurrent));
      ga4Promises.push(getAiTrafficData(user.ga4_property_id, sDatePrevious, eDatePrevious));
    }

    const [gscResults, ga4Results] = await Promise.all([
      Promise.allSettled(gscPromises), // allSettled, damit GSC-Fehler GA4 nicht stoppen
      Promise.allSettled(ga4Promises)  // allSettled, damit GA4-Fehler GSC nicht stoppen
    ]);

    // GSC-Ergebnisse zuweisen
    if (gscResults.length > 0) {
      if (gscResults[0].status === 'fulfilled') gscCurrent = gscResults[0].value as GscData;
      if (gscResults[1].status === 'fulfilled') gscPrevious = gscResults[1].value as typeof gscPrevious;
      if (gscResults[2].status === 'fulfilled') topQueries = gscResults[2].value as TopQueryData;
    }
    // GA4-Ergebnisse zuweisen
    if (ga4Results.length > 0) {
      if (ga4Results[0].status === 'fulfilled') gaCurrent = ga4Results[0].value as GaData;
      if (ga4Results[1].status === 'fulfilled') gaPrevious = ga4Results[1].value as typeof gaPrevious;
      if (ga4Results[2].status === 'fulfilled') aiTrafficCurrent = ga4Results[2].value as AiTrafficData;
      if (ga4Results[3].status === 'fulfilled') aiTrafficPrevious = ga4Results[3].value as AiTrafficData;
    }

    console.log(`[Cache FETCH] ✅ Daten erfolgreich geladen`);

    // (Aufbereitung)
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

    // (Rückgabeobjekt)
    return {
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
      aiTraffic: aiTrafficCurrent 
    };
  } catch (error) {
    console.error('[Cache FETCH] Fehler beim Abrufen der Google-Daten:', error);
    throw error;
  }
}


// --- NEUE CACHING-WRAPPER-FUNKTION ---
// Dies ist die Hauptfunktion, die unsere API-Route aufrufen wird.

// Definiere den Typ für die Rückgabe von fetchFreshGoogleData
type GoogleCacheData = Awaited<ReturnType<typeof fetchFreshGoogleData>>;

export async function getOrFetchGoogleData(user: Partial<User>, dateRange: string = '30d') {
  const userId = user.id;
  if (!userId) {
      throw new Error("User ID ist für Caching erforderlich.");
  }
  
  // 1. Cache prüfen
  try {
      const { rows } = await sql`
          SELECT data, last_fetched 
          FROM google_data_cache
          WHERE user_id = ${userId} AND date_range = ${dateRange}
      `;

      if (rows.length > 0) {
          const cache = rows[0];
          const lastFetched = new Date(cache.last_fetched);
          const now = new Date();
          const ageInHours = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60);

          if (ageInHours < CACHE_DURATION_HOURS) {
              console.log(`[Cache HIT] Google-Daten für ${user.email} (${dateRange})`);
              // Füge 'fromCache: true' für Debugging hinzu
              return { ...(cache.data as GoogleCacheData), fromCache: true };
          }
          console.log(`[Cache STALE] Google-Daten für ${user.email} (${dateRange}). Alter: ${ageInHours.toFixed(2)}h`);
      } else {
          console.log(`[Cache MISS] Google-Daten für ${user.email} (${dateRange})`);
      }

  } catch (e) {
      console.error("[Cache Read Error] Fehler beim Lesen aus google_data_cache:", e);
      // Bei Fehler (z.B. Tabelle nicht gefunden), weiter zum Live-Fetch
  }
  
  // 2. Live-Fetch (Cache Miss oder Stale)
  console.log(`[Cache FETCH] Lade frische Google-Daten für ${user.email} (${dateRange})`);
  const freshData = await fetchFreshGoogleData(user, dateRange);

  if (!freshData) {
      // Das passiert, wenn User weder GSC noch GA4 hat. Nicht cachen.
      return null; 
  }

  // 3. Cache schreiben (Asynchron, muss nicht blockieren, aber wir warten hier)
  try {
      await sql`
          INSERT INTO google_data_cache (user_id, date_range, data, last_fetched)
          VALUES (${userId}, ${dateRange}, ${JSON.stringify(freshData)}::jsonb, NOW())
          ON CONFLICT (user_id, date_range)
          DO UPDATE SET 
              data = ${JSON.stringify(freshData)}::jsonb,
              last_fetched = NOW();
      `;
      console.log(`[Cache WRITE] Google-Daten für ${user.email} (${dateRange}) gespeichert.`);
  } catch (e) {
      console.error("[Cache Write Error] Fehler beim Schreiben in google_data_cache:", e);
      // Fehler ist nicht-blockierend, User bekommt trotzdem die frischen Daten
  }
  
  // Füge 'fromCache: false' für Debugging hinzu
  return { ...freshData, fromCache: false };
}
