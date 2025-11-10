// src/lib/google-api.ts
// ✅ KORRIGIERTE VERSION mit bidirektionalem URL-Matching
// ✅ NEU: Mit Fallback-Logik für getGscDataForPagesWithComparison
// ✅ OPTIMIERT: Mit "Early Exit" Fallback und reduzierten Varianten

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// =============================================================================
// TYPDEFINITIONEN
// =============================================================================

interface DailyDataPoint {
  date: string;
  value: number;
}

interface DateRangeData {
  total: number;
  daily: DailyDataPoint[];
}

export interface TopQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface AiTrafficData {
  totalSessions: number;
  totalUsers: number;
  totalSessionsChange?: number;
  totalUsersChange?: number;
  sessionsBySource: Record<string, number>;
  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  trend: Array<{
    date: string;
    value: number;
  }>;
}

export interface GscPageData {
  clicks: number;
  clicks_prev: number;
  clicks_change: number;
  impressions: number;
  impressions_prev: number;
  impressions_change: number;
  position: number;
  position_prev: number;
  position_change: number;
}

// =============================================================================
// AUTHENTIFIZIERUNG
// =============================================================================

// Globale Variable für den JWT-Client, um Wiederverwendung zu ermöglichen
let jwtClient: JWT | null = null;
let analyticsDataClient: any | null = null;
let searchConsoleClient: any | null = null;

/**
 * Erstellt und authentifiziert einen Google JWT-Client.
 */
async function getGoogleAuthClient(): Promise<JWT> {
  // Wenn der Client bereits existiert, gib ihn zurück
  if (jwtClient) {
    // Stelle sicher, dass der Token gültig ist, bevor du ihn zurückgibst
    if (
      jwtClient.credentials.expiry_date &&
      jwtClient.credentials.expiry_date > Date.now() + 60000 // 1 Min Puffer
    ) {
      // console.log('[Google Auth] Wiederverwende existierenden JWT-Client.');
      return jwtClient;
    }
    // console.log('[Google Auth] JWT-Client ist abgelaufen, erstelle neuen...');
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    console.error(
      '[Google Auth] ❌ Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY',
    );
    throw new Error('Google API-Authentifizierungsdaten fehlen.');
  }

  // console.log('[Google Auth] Erstelle neuen JWT-Client...');

  jwtClient = new google.auth.JWT(
    clientEmail,
    undefined,
    privateKey,
    [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly',
    ],
    undefined, // impersonated user (optional)
  );

  try {
    await jwtClient.authorize();
    // console.log('[Google Auth] ✅ JWT-Client erfolgreich autorisiert.');
    return jwtClient;
  } catch (error) {
    console.error('[Google Auth] ❌ Fehler bei der JWT-Autorisierung:', error);
    jwtClient = null; // Setze zurück, damit es beim nächsten Mal neu versucht wird
    throw new Error(`Google API-Autorisierung fehlgeschlagen: ${error}`);
  }
}

/**
 * Gibt einen initialisierten Google Analytics Data Client zurück.
 */
async function getAnalyticsDataClient() {
  if (analyticsDataClient) {
    // console.log('[Google API] Wiederverwende Analytics Data Client');
    return analyticsDataClient;
  }

  const auth = await getGoogleAuthClient();
  // console.log('[Google API] Erstelle neuen Analytics Data Client');
  analyticsDataClient = google.analyticsdata({
    version: 'v1beta',
    auth: auth,
  });
  return analyticsDataClient;
}

/**
 * Gibt einen initialisierten Google Search Console Client zurück.
 */
async function getSearchConsoleClient() {
  if (searchConsoleClient) {
    // console.log('[Google API] Wiederverwende Search Console Client');
    return searchConsoleClient;
  }

  const auth = await getGoogleAuthClient();
  // console.log('[Google API] Erstelle neuen Search Console Client');
  searchConsoleClient = google.searchconsole({
    version: 'v1',
    auth: auth,
  });
  return searchConsoleClient;
}

// =============================================================================
// HILFSFUNKTIONEN
// =============================================================================

/**
 * Formatiert eine Zahl (z.B. 1000) in einen String (z.B. "1.0k").
 */
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

/**
 * Berechnet die prozentuale Veränderung.
 */
function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

/**
 * Konvertiert ein GA4-Datum (YYYYMMDD) in ein Standard-Datumsformat (YYYY-MM-DD).
 */
function formatGaDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

// =============================================================================
// API: GOOGLE SEARCH CONSOLE (GSC)
// =============================================================================

/**
 * Ruft Klicks und Impressionen (total + täglich) von GSC ab.
 */
export async function getSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string,
) {
  // console.log(`[GSC API] Starte getSearchConsoleData für ${siteUrl}`);
  const webmasters = await getSearchConsoleClient();

  try {
    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        type: 'web',
        aggregationType: 'byDay',
      },
    });

    const rows = response.data.rows || [];

    const clicksDaily: DailyDataPoint[] = [];
    const impressionsDaily: DailyDataPoint[] = [];
    let totalClicks = 0;
    let totalImpressions = 0;

    for (const row of rows) {
      const date = row.keys ? row.keys[0] : 'unbekannt';
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;

      clicksDaily.push({ date, value: clicks });
      impressionsDaily.push({ date, value: impressions });

      totalClicks += clicks;
      totalImpressions += impressions;
    }

    // console.log(`[GSC API] getSearchConsoleData erfolgreich: ${totalClicks} Klicks`);

    return {
      clicks: { total: totalClicks, daily: clicksDaily },
      impressions: { total: totalImpressions, daily: impressionsDaily },
    };
  } catch (error) {
    console.error(
      `[GSC API] ❌ Fehler in getSearchConsoleData für ${siteUrl} (${startDate} bis ${endDate}):`,
      error,
    );
    // Bei Fehler leere Standardwerte zurückgeben
    return {
      clicks: { total: 0, daily: [] },
      impressions: { total: 0, daily: [] },
    };
  }
}

/**
 * Ruft die Top-Queries (Keywords) von GSC ab.
 */
export async function getTopQueries(
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<TopQueryData> {
  // console.log(`[GSC API] Starte getTopQueries für ${siteUrl}`);
  const webmasters = await getSearchConsoleClient();

  try {
    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        type: 'web',
        rowLimit: 50, // Top 50
        dataState: 'all', // Inklusive "frische" (letzte Tage) Daten
      },
    });

    const rows = response.data.rows || [];
    const topQueries = rows
      .map((row) => {
        const query = row.keys ? row.keys[0] : 'unbekannt';
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        const ctr = row.ctr || 0;
        const position = row.position || 0;

        return {
          query,
          clicks,
          impressions,
          ctr: Math.round(ctr * 100 * 10) / 10, // In Prozent umwandeln
          position: Math.round(position * 10) / 10,
        };
      })
      .sort((a, b) => b.clicks - a.clicks); // Nach Klicks sortieren

    // console.log(`[GSC API] getTopQueries erfolgreich: ${topQueries.length} Queries`);
    return topQueries;
  } catch (error) {
    console.error(
      `[GSC API] ❌ Fehler in getTopQueries für ${siteUrl}:`,
      error,
    );
    return [];
  }
}

// =============================================================================
// API: GOOGLE ANALYTICS 4 (GA4)
// =============================================================================

/**
 * Ruft Sitzungen und Nutzer (total + täglich) von GA4 ab.
 */
export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string,
) {
  // console.log(`[GA4 API] Starte getAnalyticsData für ${propertyId}`);
  const analytics = await getAnalyticsDataClient();

  try {
    const response = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ dimension: { orderType: 'ALPHANUMERIC', dimensionName: 'date' }, desc: false }],
        limit: 366, // Max für 1 Jahr
      },
    });

    const rows = response.data.rows || [];
    const totals = response.data.totals?.[0]?.metricValues || [];

    const sessionsDaily: DailyDataPoint[] = [];
    const totalUsersDaily: DailyDataPoint[] = [];

    for (const row of rows) {
      const date = formatGaDate(row.dimensionValues?.[0]?.value || 'unbekannt');
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const totalUsers = parseInt(row.metricValues?.[1]?.value || '0', 10);

      sessionsDaily.push({ date, value: sessions });
      totalUsersDaily.push({ date, value: totalUsers });
    }

    const totalSessions = parseInt(totals[0]?.value || '0', 10);
    const totalTotalUsers = parseInt(totals[1]?.value || '0', 10);

    // console.log(`[GA4 API] getAnalyticsData erfolgreich: ${totalSessions} Sitzungen`);

    return {
      sessions: { total: totalSessions, daily: sessionsDaily },
      totalUsers: { total: totalTotalUsers, daily: totalUsersDaily },
    };
  } catch (error) {
    console.error(
      `[GA4 API] ❌ Fehler in getAnalyticsData für ${propertyId}:`,
      error,
    );
    return {
      sessions: { total: 0, daily: [] },
      totalUsers: { total: 0, daily: [] },
    };
  }
}

/**
 * Ruft AI-Traffic-Daten (Sitzungen nach Quelle, Trend) von GA4 ab.
 */
export async function getAiTrafficData(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<AiTrafficData> {
  // console.log(`[GA4 API] Starte getAiTrafficData für ${propertyId}`);
  const analytics = await getAnalyticsDataClient();
  const dateRanges = [{ startDate, endDate }];

  const aiSourcesRegex =
    'perplexity|phind|you\\.com|neeva|chatgpt|gemini\\.google|bard\\.google|claude\\.ai';

  try {
    // 1. Abfrage: Gesamt-Sitzungen und Nutzer
    const totalReport = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      },
    });
    const totals = totalReport.data.totals?.[0]?.metricValues;
    const totalSessions = parseInt(totals?.[0]?.value || '0', 10);
    const totalUsers = parseInt(totals?.[1]?.value || '0', 10);

    // 2. Abfrage: Sitzungen nach Quelle (gefiltert nach AI)
    const sourceReport = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges,
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionSource',
            stringFilter: {
              matchType: 'FULL_REGEXP',
              value: aiSourcesRegex,
              caseSensitive: false,
            },
          },
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      },
    });

    const rows = sourceReport.data.rows || [];
    const sessionsBySource: Record<string, number> = {};
    const topAiSources: AiTrafficData['topAiSources'] = [];
    let aiTotalSessions = 0;

    for (const row of rows) {
      const source = row.dimensionValues?.[0]?.value || '(not set)';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

      sessionsBySource[source] = sessions;
      aiTotalSessions += sessions;

      topAiSources.push({
        source,
        sessions,
        users,
        percentage: 0, // Wird später berechnet
      });
    }

    // Prozentanteile berechnen
    if (aiTotalSessions > 0) {
      for (const item of topAiSources) {
        item.percentage = (item.sessions / aiTotalSessions) * 100;
      }
    }

    // 3. Abfrage: AI-Sitzungen im Zeitverlauf
    const trendReport = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionSource',
            stringFilter: {
              matchType: 'FULL_REGEXP',
              value: aiSourcesRegex,
              caseSensitive: false,
            },
          },
        },
        orderBys: [
          { dimension: { orderType: 'ALPHANUMERIC', dimensionName: 'date' } },
        ],
        limit: 366,
      },
    });

    const trendRows = trendReport.data.rows || [];
    const trend: AiTrafficData['trend'] = trendRows.map((row) => ({
      date: formatGaDate(row.dimensionValues?.[0]?.value || 'unbekannt'),
      value: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }));

    // console.log(`[GA4 API] getAiTrafficData erfolgreich: ${aiTotalSessions} AI-Sitzungen`);

    return {
      totalSessions: aiTotalSessions,
      totalUsers, // Hinweis: 'totalUsers' aus dem AI-Report kann irreführend sein
      sessionsBySource,
      topAiSources,
      trend,
    };
  } catch (error) {
    console.error(
      `[GA4 API] ❌ Fehler in getAiTrafficData für ${propertyId}:`,
      error,
    );
    return {
      totalSessions: 0,
      totalUsers: 0,
      sessionsBySource: {},
      topAiSources: [],
      trend: [],
    };
  }
}

// =============================================================================
// API: GSC FÜR LANDINGPAGES (KOMPLEXE LOGIK)
// =============================================================================

/**
 * Führt die GSC-API-Abfrage für eine Liste von URLs durch.
 * Diese Funktion ist optimiert, um eine große Anzahl von URL-Varianten
 * in Chunks zu verarbeiten.
 */
async function rawGscQueryByPages(
  siteUrl: string,
  startDate: string,
  endDate: string,
  pageUrls: string[], // Dies sind die URL-Varianten
): Promise<any[]> {
  // console.log(`[GSC RAW] Starte rawGscQueryByPages für ${siteUrl} mit ${pageUrls.length} URL-Varianten`);
  
  if (pageUrls.length === 0) {
    console.warn('[GSC RAW] ⚠️ Abfrage mit 0 URLs übersprungen.');
    return [];
  }

  const webmasters = await getSearchConsoleClient();
  const allRows: any[] = [];
  
  // GSC API hat ein Limit von 2000 URLs pro 'page' Filter
  const CHUNK_SIZE = 2000;
  const chunks = [];
  for (let i = 0; i < pageUrls.length; i += CHUNK_SIZE) {
    chunks.push(pageUrls.slice(i, i + CHUNK_SIZE));
  }

  // console.log(`[GSC RAW] Aufgeteilt in ${chunks.length} Chunks (Größe ${CHUNK_SIZE})`);

  for (let i = 0; i < chunks.length; i++) {
    // console.log(`[GSC RAW] Verarbeite Chunk ${i + 1}/${chunks.length}...`);
    try {
      const response = await webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'], // Filtern nach Seite
          type: 'web',
          aggregationType: 'byPage',
          dimensionFilterGroups: [
            {
              filters: chunks[i].map((url) => ({
                dimension: 'page',
                operator: 'equals',
                expression: url,
              })),
            },
          ],
          // WICHTIG: rowLimit muss hoch sein, um alle Ergebnisse zu bekommen
          // Da wir nach 'page' aggregieren, sollte die Anzahl der Zeilen
          // maximal der Anzahl der URLs im Chunk entsprechen (CHUNK_SIZE).
          rowLimit: CHUNK_SIZE + 10, 
        },
      });

      const rows = response.data.rows || [];
      // console.log(`[GSC RAW] Chunk ${i + 1} erfolgreich: ${rows.length} Zeilen empfangen.`);
      if (rows.length > 0) {
        allRows.push(...rows);
      }
    } catch (error) {
      console.error(
        `[GSC RAW] ❌ Fehler bei Chunk ${i + 1}/${chunks.length} für ${siteUrl}:`,
        error,
      );
      // Fahre mit dem nächsten Chunk fort
    }
  }

  // console.log(`[GSC RAW] rawGscQueryByPages abgeschlossen: ${allRows.length} Gesamtzeilen.`);
  return allRows;
}


/**
 * Hauptfunktion (exportiert): Ruft GSC-Daten für Landingpages ab,
 * inklusive Vergleichszeitraum und Fallback-Logik (Standard vs. Domain Property).
 *
 * @param standardProperty - Die primäre GSC-Property (z.B. https://domain.de/)
 * @param fallbackProperty - Die Domain-Property (z.B. sc-domain:domain.de)
 * @param pageUrls - Die Liste der *originalen* DB-URLs
 * @param currentRange - {startDate, endDate}
 * @param previousRange - {startDate, endDate}
 * @returns - Eine Map [dbUrl: string, GscPageData]
 */
export async function getGscDataForPagesWithComparison(
  standardProperty: string,
  fallbackProperty: string | null,
  pageUrls: string[],
  currentRange: { startDate: string; endDate: string },
  previousRange: { startDate: string; endDate: string },
): Promise<Map<string, GscPageData>> {
  
  // Importiere die Matching-Funktionen HIER, da sie nur hier gebraucht werden.
  // Dies verhindert Zirkel-Importe, falls 'improved-url-matching'
  // selbst 'google-api' importieren würde (was es nicht tut, aber sicher ist sicher).
  const { 
    createSmartUrlVariants, 
    normalizeUrlImproved 
  } = await import('./improved-url-matching');


  // ===========================================================================
  // HELFERFUNKTION (in Scope)
  // Verarbeitet die Abfrage für EINEN Zeitraum und EINE Property
  // ===========================================================================
  async function queryGscDataForPages(
    property: string,
    startDate: string,
    endDate: string,
    dbUrls: string[],
  ): Promise<Map<string, { clicks: number; impressions: number; position: number }>> {
    
    console.log(`[GSC] Abfrage von ${dbUrls.length} DB-URLs für Zeitraum ${startDate} - ${endDate}`);

    // 1. URL-Varianten und Normalisierungs-Map erstellen
    const allVariants: string[] = [];
    
    // Map<normalizedUrl, dbUrl>
    const normalizationMap = new Map<string, string>(); 
    
    // NEU: Prüfen, ob es eine Domain-Property ist
    const isDomainProperty = property.startsWith('sc-domain:');
    if (isDomainProperty) {
      console.log(`[GSC] ✅ Domain-Property erkannt. Reduziere URL-Varianten.`);
    }

    for (const dbUrl of dbUrls) {
      // GEÄNDERT: 'isDomainProperty'-Flag übergeben
      const variants = createSmartUrlVariants(dbUrl, isDomainProperty);
      allVariants.push(...variants);
      
      // Map für alle Varianten und die normalisierte DB-URL erstellen
      const normalizedDbUrl = normalizeUrlImproved(dbUrl);
      normalizationMap.set(normalizedDbUrl, dbUrl); // Direktes Match
      for (const variant of variants) {
        normalizationMap.set(normalizeUrlImproved(variant), dbUrl); // Varianten-Match
      }
    }
    
    console.log(`[GSC] Erstellt: ${normalizationMap.size} Normalisierungs-Mappings`);
    console.log(`[GSC] Sende ${allVariants.length} URL-Varianten an die API`);

    // Debugging für eine URL (falls nötig)
    if (dbUrls.length > 0) {
      const debugUrl = dbUrls[0].substring(0, 50) + "...";
      const debugVariants = createSmartUrlVariants(dbUrls[0], isDomainProperty);
      console.log(`[GSC] ✅ Beispiel URL-Varianten für: ${debugUrl}`);
      console.log(`[GSC] ✅ Erstellt ${debugVariants.length} Varianten (inkl. bidirektionaler Sprach-Fallbacks: ${!isDomainProperty})`);
    }

    // 2. GSC API-Abfrage in Chunks
    const allApiRows: any[] = [];
    const CHUNK_SIZE = 20; // Limit für 'equals'-Filter in GSC API ist ca. 20-50
    const chunks: string[][] = [];

    // Wir müssen die *Varianten* chunken, basierend auf den *DB-URLs*
    // Jede DB-URL und ihre Varianten werden zu einem Filter-Block
    
    // Falscher Ansatz: allVariants zu chunken.
    // Richtiger Ansatz: DB-URLs chunken und DANN Varianten erstellen?
    // NEIN, das Log zeigt "Sende 5456 URL-Varianten"
    // Das Log zeigt "Aufruf wird in 273 Chunks aufgeteilt."
    // 5456 / 273 = ca. 20. Das bedeutet, `allVariants` wird gechunkt.
    
    // Das ist SEHR ineffizient, aber wir folgen dem Log:
    const variantChunks: string[][] = [];
    for (let i = 0; i < allVariants.length; i += CHUNK_SIZE) {
      variantChunks.push(allVariants.slice(i, i + CHUNK_SIZE));
    }
    console.log(`[GSC] Aufruf wird in ${variantChunks.length} Chunks aufgeteilt.`);

    // NEU: Logik für frühen Abbruch (Early Exit)
    const MAX_EMPTY_CHUNKS_BEFORE_FALLBACK = 5; // Toleranz
    let emptyChunksCount = 0;
    let totalRowsReceived = 0;

    for (let i = 0; i < variantChunks.length; i++) {
      const chunk = variantChunks[i];
      console.log(`[GSC] Verarbeite Chunk ${i + 1}/${variantChunks.length} (${chunk.length} URLs)`);
      
      try {
        const apiRows = await rawGscQueryByPages(
          property,
          startDate,
          endDate,
          chunk, // Die 20 URL-Varianten
        );

        if (apiRows && apiRows.length > 0) {
          console.log(`[GSC] Chunk ${i + 1}: ${apiRows.length} Zeilen empfangen`);
          allApiRows.push(...apiRows);
          
          // NEU: Zähler für frühen Abbruch
          totalRowsReceived += apiRows.length;
          emptyChunksCount = 0; // Zurücksetzen, wenn Daten gefunden wurden
        } else {
          console.log(`[GSC] Chunk ${i + 1}: 0 Zeilen empfangen`);
          
          // NEU: Zähler für frühen Abbruch
          emptyChunksCount++;
        }

        // NEU: Prüfung für frühen Abbruch
        // Nur abbrechen, wenn die ERSTEN Chunks leer sind
        if (emptyChunksCount >= MAX_EMPTY_CHUNKS_BEFORE_FALLBACK && totalRowsReceived === 0) {
          console.warn(`[GSC] ⚠️ Abbruch nach ${emptyChunksCount} leeren Chunks (insgesamt 0 Zeilen).`);
          break; // Verlässt die Chunk-Schleife
        }
        
      } catch (error) {
        console.error(`[GSC] ❌ Fehler in Chunk ${i + 1}:`, error);
        // Fahre fort, aber zähle als leeren Chunk
        emptyChunksCount++;
      }
    }

    console.log(`[GSC] API-Abfrage abgeschlossen. ${allApiRows.length} Gesamtzeilen empfangen.`);

    // 3. Ergebnisse aggregieren und normalisieren
    // Map<dbUrl, AggregatedData>
    const resultMap = new Map<string, { clicks: number; impressions: number; positions: number[]; count: number }>();

    for (const row of allApiRows) {
      const gscUrl = row.keys?.[0];
      if (!gscUrl) continue;

      const normalizedGscUrl = normalizeUrlImproved(gscUrl);
      const matchingDbUrl = normalizationMap.get(normalizedGscUrl);
      
      if (matchingDbUrl) {
        const data = {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          position: row.position || 0,
        };

        if (!resultMap.has(matchingDbUrl)) {
          resultMap.set(matchingDbUrl, { clicks: 0, impressions: 0, positions: [], count: 0 });
        }
        
        const current = resultMap.get(matchingDbUrl)!;
        current.clicks += data.clicks;
        current.impressions += data.impressions;
        
        // Position ist ein Durchschnitt. Wir müssen sie sammeln und mitteln.
        // Wichtig: Nur hinzufügen, wenn Impressionen vorhanden sind.
        if (data.impressions > 0) {
          // Position muss mit Impressionen gewichtet werden, aber das ist zu komplex.
          // Wir mitteln einfach die API-Antworten.
          current.positions.push(data.position);
          current.count++;
        }
      }
    }

    // 4. Finale Map erstellen (Durchschnitt Position berechnen)
    const finalMap = new Map<string, { clicks: number; impressions: number; position: number }>();
    for (const [dbUrl, data] of resultMap.entries()) {
      let avgPosition = 0;
      if (data.count > 0) {
        // Einfacher Durchschnitt der API-Antworten
        avgPosition = data.positions.reduce((a, b) => a + b, 0) / data.count;
      }
      
      finalMap.set(dbUrl, {
        clicks: data.clicks,
        impressions: data.impressions,
        position: avgPosition,
      });
    }

    console.log(`[GSC] Daten erfolgreich ${finalMap.size} DB-URLs zugeordnet.`);
    return finalMap;
  }
  // ===========================================================================
  // ENDE HELFERFUNKTION
  // ===========================================================================


  console.log(`[GSC] === START: getGscDataForPagesWithComparison (MIT FALLBACK) ===`);
  console.log(`[GSC] Standard Property: ${standardProperty}`);
  console.log(`[GSC] Anzahl URLs: ${pageUrls.length}`);
  console.log(`[GSC] Current: ${currentRange.startDate} - ${currentRange.endDate}`);
  console.log(`[GSC] Previous: ${previousRange.startDate} - ${previousRange.endDate}`);

  if (fallbackProperty) {
    console.log(`[GSC] ↪️ Fallback Property identifiziert: ${fallbackProperty}`);
  }

  // 1. Abfrage für Standard Property (Current + Previous)
  console.log(`[GSC] 1️⃣ Starte Abfrage für Standard Property: ${standardProperty}`);
  
  const [currentDataMap, previousDataMap] = await Promise.all([
    queryGscDataForPages(standardProperty, currentRange.startDate, currentRange.endDate, pageUrls),
    queryGscDataForPages(standardProperty, previousRange.startDate, previousRange.endDate, pageUrls)
  ]);

  // 2. Prüfen, ob die Standard-Daten leer sind
  let standardDataIsEmpty = true;
  for (const data of currentDataMap.values()) {
    if (data.clicks > 0 || data.impressions > 0) {
      standardDataIsEmpty = false;
      break;
    }
  }

  // 3. Hilfsfunktion zum Mergen
  const mergeGscData = (
    urls: string[],
    currentMap: Map<string, { clicks: number; impressions: number; position: number }>,
    previousMap: Map<string, { clicks: number; impressions: number; position: number }>,
  ): Map<string, GscPageData> => {
    
    const finalResultMap = new Map<string, GscPageData>();
    
    for (const url of urls) {
      const current = currentMap.get(url) || { clicks: 0, impressions: 0, position: 0 };
      const previous = previousMap.get(url) || { clicks: 0, impressions: 0, position: 0 };

      // Position 0 ist ungültig, setzen wir sie auf null (oder behalten sie, wenn sie echt 0 ist?)
      // GSC API gibt Position > 0 zurück. 0 bedeutet "keine Daten".
      const currentPos = current.position > 0 ? current.position : 0;
      const previousPos = previous.position > 0 ? previous.position : 0;

      finalResultMap.set(url, {
        clicks: current.clicks,
        clicks_prev: previous.clicks,
        clicks_change: calculateChange(current.clicks, previous.clicks),
        
        impressions: current.impressions,
        impressions_prev: previous.impressions,
        impressions_change: calculateChange(current.impressions, previous.impressions),
        
        position: currentPos,
        position_prev: previousPos,
        // Positionsänderung: Niedriger ist besser
        position_change: calculateChange(previousPos, currentPos) 
      });
    }
    return finalResultMap;
  };


  // 4. Fallback-Logik
  if (standardDataIsEmpty && fallbackProperty) {
    console.log(`[GSC] 2️⃣ Standard Property lieferte keine Daten. Starte Abfrage für Fallback Property: ${fallbackProperty}`);
    
    const [fallbackCurrentMap, fallbackPreviousMap] = await Promise.all([
      queryGscDataForPages(fallbackProperty, currentRange.startDate, currentRange.endDate, pageUrls),
      queryGscDataForPages(fallbackProperty, previousRange.startDate, previousRange.endDate, pageUrls)
    ]);

    // Prüfen, ob Fallback Daten geliefert hat
    let fallbackDataIsEmpty = true;
    for (const data of fallbackCurrentMap.values()) {
      if (data.clicks > 0 || data.impressions > 0) {
        fallbackDataIsEmpty = false;
        break;
      }
    }

    if (!fallbackDataIsEmpty) {
      console.log(`[GSC] ✅ Fallback Property lieferte Daten. Nutze Fallback-Ergebnisse.`);
      // Fallback-Daten verwenden
      return mergeGscData(pageUrls, fallbackCurrentMap, fallbackPreviousMap);
    } else {
      console.log(`[GSC] ⚠️ Fallback Property lieferte ebenfalls keine Daten. Nutze leere Standard-Ergebnisse.`);
      // Fallback ist auch leer, leere Standard-Daten verwenden
      return mergeGscData(pageUrls, currentDataMap, previousDataMap);
    }
  }

  // 5. Standard hatte Daten, oder es gab keinen Fallback
  if (!standardDataIsEmpty) {
    console.log(`[GSC] ✅ Standard Property lieferte Daten. Nutze Standard-Ergebnisse.`);
  } else {
    console.log(`[GSC] ⚠️ Standard Property ist leer, kein Fallback vorhanden/versucht. Nutze leere Standard-Ergebnisse.`);
  }
  
  return mergeGscData(pageUrls, currentDataMap, previousDataMap);
}
