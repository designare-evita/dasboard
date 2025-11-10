// src/lib/google-data-loader.ts (NEU & KORRIGIERT MIT FALLBACK-LOGIK)

import { sql } from '@vercel/postgres';
import { User } from '@/types';
import {
  getSearchConsoleData,
  getAnalyticsData,
  getTopQueries,
  getAiTrafficData,
  type AiTrafficData
} from '@/lib/google-api';
import { ProjectDashboardData } from '@/lib/dashboard-shared';

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

// ========== DATENLADE-FUNKTION (MIT FALLBACK-LOGIK) ==========
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

  try {
    console.log(`[Google Cache FETCH] 🔄 Lade frische Google-Daten für ${user.email} (${dateRange})`);

    // ========== PROMISES VORBEREITEN ==========
    const gscPromises = [];
    const ga4Promises = [];

    let gscFallbackProperty: string | null = null;
    const standardProperty = user.gsc_site_url;

    if (standardProperty) {
      console.log(`[Google Cache FETCH] ✅ GSC konfiguriert (Standard): ${standardProperty}`);
      // 1. Standard-Promises (Indizes 0, 1, 2)
      gscPromises.push(
        getSearchConsoleData(standardProperty, sDateCurrent, eDateCurrent),
        getSearchConsoleData(standardProperty, sDatePrevious, eDatePrevious),
        getTopQueries(standardProperty, sDateCurrent, eDateCurrent)
      );

      // 2. Fallback-Property vorbereiten, wenn Standard eine URL ist
      if (standardProperty.startsWith('http://') || standardProperty.startsWith('https://')) {
        try {
          const urlObj = new URL(standardProperty);
          let host = urlObj.hostname.toLowerCase();
          if (host.startsWith('www.')) {
            host = host.substring(4);
          }
          const domainProperty = `sc-domain:${host}`;
          
          // Nur hinzufügen, wenn Fallback sich von Standard unterscheidet
          if (domainProperty !== standardProperty) {
            gscFallbackProperty = domainProperty;
            console.log(`[Google Cache FETCH] ↪️ Bereite Fallback GSC-Property vor: ${gscFallbackProperty}`);
            // Fallback-Promises (Indizes 3, 4, 5)
            gscPromises.push(
              getSearchConsoleData(gscFallbackProperty, sDateCurrent, eDateCurrent),
              getSearchConsoleData(gscFallbackProperty, sDatePrevious, eDatePrevious),
              getTopQueries(gscFallbackProperty, sDateCurrent, eDateCurrent)
            );
          }
        } catch (e) {
          console.warn(`[Google Cache FETCH] ⚠️ Konnte keine Fallback-Domain aus ${standardProperty} ableiten.`);
        }
      }
    } else {
      console.log(`[Google Cache FETCH] ⚠️ GSC nicht konfiguriert`);
    }

    if (user.ga4_property_id) {
      console.log(`[Google Cache FETCH] ✅ GA4 konfiguriert: ${user.ga4_property_id}`);
      ga4Promises.push(
        getAnalyticsData(user.ga4_property_id, sDateCurrent, eDateCurrent),
        getAnalyticsData(user.ga4_property_id, sDatePrevious, eDatePrevious),
        getAiTrafficData(user.ga4_property_id, sDateCurrent, eDateCurrent),
        getAiTrafficData(user.ga4_property_id, sDatePrevious, eDatePrevious)
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

    // ========== GSC ERGEBNISSE VERARBEITEN (MIT FALLBACK-LOGIK) ==========
    if (gscResults.length > 0) {
      
      // Standard-Ergebnisse extrahieren (Indizes 0, 1, 2)
      const gscCurrentResult = gscResults[0];
      const gscPreviousResult = gscResults[1];
      const topQueriesResult = gscResults[2];

      let gscCurrentData: GscData | null = null;
      let gscPreviousData: typeof gscPrevious | null = null;
      let topQueriesData: TopQueryData | null = null;

      if (gscCurrentResult.status === 'fulfilled') {
        gscCurrentData = gscCurrentResult.value as GscData;
      } else {
        console.error(`[Google Cache FETCH] ❌ GSC Current (Standard) failed:`, gscCurrentResult.reason);
      }
      
      if (gscPreviousResult.status === 'fulfilled') {
        gscPreviousData = gscPreviousResult.value as typeof gscPrevious;
      } else {
        console.error(`[Google Cache FETCH] ❌ GSC Previous (Standard) failed:`, gscPreviousResult.reason);
      }
      
      if (topQueriesResult.status === 'fulfilled') {
        topQueriesData = topQueriesResult.value as TopQueryData;
      } else {
        console.error(`[Google Cache FETCH] ❌ Top Queries (Standard) failed:`, topQueriesResult.reason);
      }

      // Prüfen, ob Fallback genutzt werden soll
      const standardIsEmpty = (gscCurrentData?.clicks.total ?? 0) === 0;
      const fallbackExists = gscFallbackProperty && gscResults.length > 3;

      if (standardIsEmpty && fallbackExists) {
        console.log(`[Google Cache FETCH] ↪️ Standard-Abfrage (Index 0) ist leer. Prüfe Fallback (Index 3)...`);
        
        const fallbackCurrentResult = gscResults[3];
        
        if (fallbackCurrentResult.status === 'fulfilled') {
          const fallbackCurrentData = fallbackCurrentResult.value as GscData;
          
          // Wenn Fallback Daten liefert, überschreibe die Standard-Variablen
          if ((fallbackCurrentData?.clicks.total ?? 0) > 0) {
            console.log(`[Google Cache FETCH] ✅ Fallback erfolgreich! Nutze Daten von ${gscFallbackProperty}`);
            gscCurrentData = fallbackCurrentData;
            
            // Auch Previous und TopQueries vom Fallback nehmen
            const fallbackPreviousResult = gscResults[4];
            const fallbackTopQueriesResult = gscResults[5];
            
            if (fallbackPreviousResult.status === 'fulfilled') {
              gscPreviousData = fallbackPreviousResult.value as typeof gscPrevious;
            } else {
              console.error(`[Google Cache FETCH] ❌ GSC Previous (Fallback) failed:`, fallbackPreviousResult.reason);
            }

            if (fallbackTopQueriesResult.status === 'fulfilled') {
              topQueriesData = fallbackTopQueriesResult.value as TopQueryData;
            } else {
              console.error(`[Google Cache FETCH] ❌ Top Queries (Fallback) failed:`, fallbackTopQueriesResult.reason);
            }
          } else {
             console.log(`[Google Cache FETCH] ⚠️ Fallback (Index 3) ist ebenfalls leer. Nutze Standard-Ergebnisse.`);
          }
        } else {
          console.error(`[Google Cache FETCH] ❌ Fallback-Abfrage (Index 3) fehlgeschlagen:`, fallbackCurrentResult.reason);
        }
      }

      // Finale Zuweisung
      gscCurrent = gscCurrentData ?? DEFAULT_GSC_DATA;
      gscPrevious = gscPreviousData ?? DEFAULT_GSC_PREVIOUS;
      topQueries = topQueriesData ?? DEFAULT_TOP_QUERIES;

      console.log(`[Google Cache FETCH] ✅ GSC Current (final): ${gscCurrent.clicks.total} Klicks`);
      console.log(`[Google Cache FETCH] ✅ Top Queries (final): ${topQueries.length} Einträge`);
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
    const result = {
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
