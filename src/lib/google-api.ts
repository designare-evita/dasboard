// src/lib/google-api.ts (FINAL KORRIGIERT - Mit robustem URL-Matching & Chunking)

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// --- Typdefinitionen ---

interface DailyDataPoint {
  date: string;
  value: number;
}

interface DateRangeData {
  total: number;
  daily: DailyDataPoint[];
}

interface TopQueryData {
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
  
  sessionsBySource: {
    : number;
  };
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

// --- Authentifizierung ---
function createAuth(): JWT {
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      return new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          'https://www.googleapis.com/auth/webmasters.readonly',
          'https://www.googleapis.com/auth/analytics.readonly',
        ],
      });
    } catch (e) {
      console.error("Fehler beim Parsen von GOOGLE_CREDENTIALS:", e);
    }
  }

  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKeyBase64 || !clientEmail) {
    throw new Error(
      'Google API Credentials fehlen. Setze entweder GOOGLE_CREDENTIALS oder GOOGLE_PRIVATE_KEY_BASE64 + GOOGLE_SERVICE_ACCOUNT_EMAIL'
    );
  }

  try {
    const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
    return new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/analytics.readonly',
      ],
    });
  } catch (error) {
    console.error("Fehler beim Erstellen der JWT-Auth:", error);
    throw new Error("Fehler beim Initialisieren der Google API Authentifizierung.");
  }
}

// --- Hilfsfunktionen ---

function formatDateForChart(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const day = dateStr.substring(6, 8);
  const month = dateStr.substring(4, 6);
  return `${day}.${month}`;
}

function formatDateToISO(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * ✅ KORREKTUR: Normalisiert URLs für einen robusten Abgleich.
 * Entfernt Protokoll, www. und trailing slashes.
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    // 1. URL parsen (Fallback für URLs ohne Protokoll)
    let parsedUrl: URL;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Füge ein Dummy-Protokoll hinzu, um das Parsen zu ermöglichen
      parsedUrl = new URL(`https://dummy-protocol.com${url.startsWith('/') ? '' : '/'}${url}`);
      
      // Wenn wir nur einen Pfad hatten, ist der Hostname 'dummy-protocol.com'
      if (parsedUrl.hostname === 'dummy-protocol.com') {
         let path = parsedUrl.pathname.toLowerCase();
         // Trailing slash entfernen
         if (path !== '/' && path.endsWith('/')) {
           path = path.slice(0, -1);
         }
         return path + parsedUrl.search; // Nur Pfad + Query zurückgeben
      }
    } else {
      parsedUrl = new URL(url);
    }

    // 2. Hostname normalisieren (Kleinschreibung, www. entfernen)
    let host = parsedUrl.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }

    // 3. Pfad normalisieren (Kleinschreibung, trailing slash entfernen)
    let path = parsedUrl.pathname.toLowerCase();
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // 4. Query-Parameter normalisieren (Sortieren)
    const params = Array.from(parsedUrl.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    const search = new URLSearchParams(params).toString();

    // 5. Zusammensetzen (ohne Protokoll, ohne Fragment)
    return `${host}${path}${search ? '?' + search : ''}`;

  } catch (error) {
    console.warn(`[normalizeUrl] Fallback für URL: ${url}`, error);
    // Fallback: Einfache Normalisierung
    return url
      .replace(/^https?:\/\//, '') // Protokoll entfernen
      .replace(/^www\./, '')      // www. entfernen
      .toLowerCase()
      .replace(/\/$/, '')       // Trailing slash entfernen
      .split('#')[0];           // Fragment entfernen
  }
}

/**
 * ✅ KORREKTUR: Erstellt alle 8 Varianten (http/s, www/non-www, mit/ohne /)
 */
function createUrlVariants(url: string): string[] {
  const variants: Set<string> = new Set();
  
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname; // Groß/Kleinschreibung beibehalten
    const search = urlObj.search; // Query-Parameter beibehalten
    
    // 1. Host-Varianten (www und non-www)
    const hosts: string[] = [];
    if (host.startsWith('www.')) {
      hosts.push(host);
      hosts.push(host.substring(4));
    } else {
      hosts.push(host);
      hosts.push(`www.${host}`);
    }

    // 2. Pfad-Varianten (mit und ohne trailing slash)
    const paths: string[] = [];
    paths.push(path);
    if (path !== '/' && path.endsWith('/')) {
      paths.push(path.slice(0, -1));
    } else if (path !== '/') {
      paths.push(path + '/');
    }

    // 3. Protokoll-Varianten (http und https)
    const protocols = ['https://', 'http://'];

    // 4. Alle 8 Kombinationen erstellen
    for (const p of protocols) {
      for (const h of hosts) {
        for (const pa of paths) {
          variants.add(`${p}${h}${pa}${search}`);
        }
      }
    }
  } catch (error) {
    // Fallback für ungültige URLs (z.B. relative Pfade)
    variants.add(url);
  }
  
  return Array.from(variants);
}


/**
 * Prüft, ob eine Quelle ein bekannter KI-Bot ist
 */
function isAiSource(source: string): boolean {
  if (!source) return false;
  
  const aiPatterns = [
    'chatgpt', 'gpt', 'openai', 'claude', 'anthropic', 'bard', 'gemini',
    'perplexity', 'bing chat', 'copilot', 'gptbot', 'claudebot',
    'google-extended', 'cohere-ai', 'ai2bot', 'you.com', 'neeva',
    'phind', 'metaphor', 'notion ai', 'jasper', 'copy.ai', 'writesonic',
  ];

  const sourceLower = source.toLowerCase();
  return aiPatterns.some(pattern => sourceLower.includes(pattern));
}

/**
 * Bereinigt und kategorisiert KI-Quellen
 */
function cleanAiSourceName(source: string): string {
  if (!source) return 'Unbekannt';
  const sourceLower = source.toLowerCase();
  
  if (sourceLower.includes('chatgpt') || sourceLower.includes('gptbot')) return 'ChatGPT';
  if (sourceLower.includes('claude')) return 'Claude AI';
  if (sourceLower.includes('bard') || sourceLower.includes('gemini')) return 'Google Gemini';
  if (sourceLower.includes('perplexity')) return 'Perplexity';
  if (sourceLower.includes('bing') || sourceLower.includes('copilot')) return 'Bing Copilot';
  if (sourceLower.includes('you.com')) return 'You.com';
  
  const parts = source.split('/')[0].split('?')[0];
  return parts.length > 30 ? parts.substring(0, 27) + '...' : parts;
}

// --- API-Funktionen ---

// (getSearchConsoleData, getTopQueries, getAnalyticsData, getAiTrafficData bleiben unverändert)
// ... (Code für getSearchConsoleData) ...
export async function getSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{ clicks: DateRangeData; impressions: DateRangeData }> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        type: 'web',
        aggregationType: 'byProperty',
      },
    });

    const rows = response.data.rows || [];
    const clicksDaily: DailyDataPoint[] = [];
    const impressionsDaily: DailyDataPoint[] = [];
    let totalClicks = 0;
    let totalImpressions = 0;

    for (const row of rows) {
      const date = row.keys?.[0];
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;

      if (date) {
        clicksDaily.push({ date, value: clicks });
        impressionsDaily.push({ date, value: impressions });
        totalClicks += clicks;
        totalImpressions += impressions;
      }
    }

    return {
      clicks: {
        total: totalClicks,
        daily: clicksDaily.sort((a, b) => a.date.localeCompare(b.date)),
      },
      impressions: {
        total: totalImpressions,
        daily: impressionsDaily.sort((a, b) => a.date.localeCompare(b.date)),
      },
    };
  } catch (error: unknown) {
    console.error('[GSC] Fehler beim Abrufen der Daten:', error);
    console.error('[GSC] Request Details:', { siteUrl, startDate, endDate });
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter API-Fehler';
    throw new Error(`Fehler bei Google Search Console API: ${errorMessage}`);
  }
}

// ... (Code für getTopQueries) ...
export async function getTopQueries(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<TopQueryData[]> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query"],
        type: "web",
        rowLimit: 100,
        dataState: "all",
        aggregationType: "byProperty",
      },
    });

    const allQueries = res.data.rows?.map((row) => ({
      query: row.keys?.[0] || "N/A",
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })) || [];

    return allQueries
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 100);

  } catch (error: unknown) {
    console.error("[GSC] Fehler beim Abrufen der Top Queries:", error);
    console.error("[GSC] Request Details:", { siteUrl, startDate, endDate });
    return [];
  }
}

// ... (Code für getAnalyticsData) ...
export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{ sessions: DateRangeData; totalUsers: DateRangeData }> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    const response = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{
          dimension: { dimensionName: 'date' },
          desc: false,
        }],
      },
    });

    const rows = response.data.rows || [];
    const sessionsDaily: DailyDataPoint[] = [];
    const usersDaily: DailyDataPoint[] = [];
    let totalSessions = 0;
    let totalUsers = 0;

    for (const row of rows) {
      const rawDate = row.dimensionValues?.[0]?.value;
      const date = rawDate?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') ?? '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

      if (date) {
        sessionsDaily.push({ date, value: sessions });
        usersDaily.push({ date, value: users });
        totalSessions += sessions;
        totalUsers += users;
      }
    }

    return {
      sessions: {
        total: totalSessions,
        daily: sessionsDaily,
      },
      totalUsers: {
        total: totalUsers,
        daily: usersDaily,
      },
    };
  } catch (error: unknown) {
    console.error('[GA4] Fehler beim Abrufen der Daten:', error);
    console.error('[GA4] Request Details:', { propertyId: formattedPropertyId, startDate, endDate });
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter API-Fehler';
    throw new Error(`Fehler bei Google Analytics API: ${errorMessage}`);
  }
}

// ... (Code für getAiTrafficData) ...
export async function getAiTrafficData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AiTrafficData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    console.log('[AI-Traffic] Starte Abruf für Property:', formattedPropertyId);

    // Query 1: Traffic nach Quelle/Medium gruppiert
    const sourceResponse = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
        ],
        orderBys: [{ 
          metric: { metricName: 'sessions' }, 
          desc: true 
        }],
        limit: '1000',
      },
    });

    // Query 2: Täglicher KI-Traffic-Trend
    const trendResponse = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'date' },
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        metrics: [
          { name: 'sessions' },
        ],
        orderBys: [{ 
          dimension: { dimensionName: 'date' }, 
          desc: false 
        }],
        limit: '10000',
      },
    });

    const sourceRows = sourceResponse.data.rows || [];
    const trendRows = trendResponse.data.rows || [];

    console.log('[AI-Traffic] Quellen-Zeilen:', sourceRows.length);
    console.log('[AI-Traffic] Trend-Zeilen:', trendRows.length);

    // Verarbeite Quellen-Daten
    let totalSessions = 0;
    let totalUsers = 0;
    const sessionsBySource: { [key: string]: number } = {};
    const usersBySource: { [key: string]: number } = {};

    for (const row of sourceRows) {
      const source = row.dimensionValues?.[0]?.value || 'Unknown';
      const medium = row.dimensionValues?.[1]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

      const fullSource = `${source}${medium ? `/${medium}` : ''}`;
      
      if (isAiSource(fullSource) || isAiSource(source)) {
        const cleanName = cleanAiSourceName(source);
        
        totalSessions += sessions;
        totalUsers += users;
        
        sessionsBySource[cleanName] = (sessionsBySource[cleanName] || 0) + sessions;
        usersBySource[cleanName] = (usersBySource[cleanName] || 0) + users;
      }
    }

    console.log('[AI-Traffic] Gesamt KI-Sitzungen:', totalSessions);

    // Verarbeite Trend-Daten
    const trendMap: { [date: string]: number } = {};

    for (const row of trendRows) {
      const rawDate = row.dimensionValues?.[0]?.value || '';
      const source = row.dimensionValues?.[1]?.value || '';
      const medium = row.dimensionValues?.[2]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const fullSource = `${source}${medium ? `/${medium}` : ''}`;

      if (isAiSource(fullSource) || isAiSource(source)) {
        const date = formatDateToISO(rawDate);
        trendMap[date] = (trendMap[date] || 0) + sessions;
      }
    }

    // Top AI Sources erstellen
    const topAiSources = Object.entries(sessionsBySource)
      .map(([source, sessions]) => ({
        source,
        sessions,
        users: usersBySource[source] || 0,
        percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    console.log('[AI-Traffic] Top AI Sources:', topAiSources);

    // Trend-Daten formatieren
    const trend = Object.entries(trendMap)
      .map(([date, sessions]) => ({
        date: date,
        value: sessions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    console.log('[AI-Traffic] Trend-Datenpunkte:', trend.length);

    return {
      totalSessions,
      totalUsers,
      sessionsBySource,
      topAiSources,
      trend,
    };

  } catch (error: unknown) {
    console.error('[AI-Traffic] Fehler beim Abrufen:', error);
    console.error('[AI-Traffic] Request Details:', { 
      propertyId: formattedPropertyId, 
      startDate, 
      endDate 
    });

    return {
      totalSessions: 0,
      totalUsers: 0,
      sessionsBySource: {},
      topAiSources: [],
      trend: [],
    };
  }
}

// ==================================================================
// --- KORRIGIERTER CODE FÜR LANDINGPAGE-DATEN ---
// ==================================================================

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

/**
 * ✅ KORRIGIERT: Interne Hilfsfunktion mit Chunking und robustem Matching
 */
async function queryGscDataForPages(
  siteUrl: string,
  startDate: string,
  endDate: string,
  pageUrls: string[] // Original-URLs aus der DB
): Promise<Map<string, { clicks: number; impressions: number; position: number }>> {
  
  if (pageUrls.length === 0) {
    console.log('[GSC] Keine URLs zum Abfragen vorhanden');
    return new Map();
  }

  console.log(`[GSC] Abfrage von ${pageUrls.length} DB-URLs für Zeitraum ${startDate} - ${endDate}`);
  
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  
  // Map [Key: Normalisierte URL (ohne Protokoll/www)] -> [Value: Original-URL]
  const normalizedToOriginal = new Map<string, string>();
  
  // Set aller einzigartigen URL-Varianten (http/s, www/non-www, /), die an die API gesendet werden
  const apiFilterUrls = new Set<string>();

  for (const originalUrl of pageUrls) {
    // Erstelle alle 8 Varianten (http://domain.de, https://www.domain.de, etc.)
    const variants = createUrlVariants(originalUrl);
    
    // Normalisiere die Original-URL für die ZUORDNUNG
    const normalizedKey = normalizeUrl(originalUrl);
    if (!normalizedToOriginal.has(normalizedKey)) {
        normalizedToOriginal.set(normalizedKey, originalUrl);
    }
    
    variants.forEach(variant => {
      // Füge die (nicht-normalisierte) Variante dem API-Filter hinzu
      apiFilterUrls.add(variant); 
    });
  }
  
  console.log(`[GSC] Erstellt: ${normalizedToOriginal.size} Normalisierungs-Mappings`);
  console.log(`[GSC] Sende ${apiFilterUrls.size} URL-Varianten an die API`);

  // API-Limit (500 Filter) beachten
  const MAX_FILTERS = 450; // Sicherer Puffer
  const urlChunks: string[][] = [];
  const allApiUrls = Array.from(apiFilterUrls);

  for (let i = 0; i < allApiUrls.length; i += MAX_FILTERS) {
    urlChunks.push(allApiUrls.slice(i, i + MAX_FILTERS));
  }

  console.log(`[GSC] Aufruf wird in ${urlChunks.length} Chunks aufgeteilt.`);

  const resultMap = new Map<string, { clicks: number; impressions: number; position: number }>();
  
  try {
    // Führe API-Aufrufe für jeden Chunk parallel aus
    const chunkPromises = urlChunks.map(async (chunk, index) => {
      console.log(`[GSC] Chunk ${index + 1}/${urlChunks.length} wird verarbeitet (${chunk.length} URLs)`);
      
      const response = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'],
          type: 'web',
          aggregationType: 'byPage',
          // Verwende 'or' Gruppe mit 'equals'
          dimensionFilterGroups: [
            {
              groupType: 'or',
              filters: chunk.map(pageUrl => ({
                dimension: 'page',
                operator: 'equals', // Präziser Abgleich
                expression: pageUrl  // Volle URL-Variante
              }))
            }
          ],
          rowLimit: 5000 
        },
      });
      return response.data.rows || [];
    });

    const allChunkResults = await Promise.all(chunkPromises);
    const rows = allChunkResults.flat(); // Alle Ergebnisse kombinieren

    console.log(`[GSC] ${rows.length} Zeilen von GSC (alle Chunks) erhalten`);

    // Verarbeite GSC-Ergebnisse
    for (const row of rows) {
      const gscUrl = row.keys?.[0]; // z.B. http://domain.de/seite/
      if (!gscUrl) continue;

      // Normalisiere die GSC-URL (wird zu: domain.de/seite)
      const normalizedGscUrl = normalizeUrl(gscUrl);
      
      // Finde die Original-DB-URL (z.B. https://www.domain.de/Seite/)
      const originalUrl = normalizedToOriginal.get(normalizedGscUrl);
      
      if (originalUrl) {
        // Aggregiere Daten (falls mehrere GSC-Varianten zur selben Original-URL gehören)
        const existing = resultMap.get(originalUrl) || { clicks: 0, impressions: 0, position: 0 };
        const clicks = existing.clicks + (row.clicks || 0);
        const impressions = existing.impressions + (row.impressions || 0);
        
        let position = row.position || 0;
        if (existing.position > 0 && position > 0) {
          // Durchschnitt gewichtet nach Impressionen
          const totalImpressions = existing.impressions + (row.impressions || 0);
          if (totalImpressions > 0) {
             position = ((existing.position * existing.impressions) + (position * (row.impressions || 0))) / totalImpressions;
          } else {
             position = (existing.position + position) / 2;
          }
        } else if (existing.position > 0) {
          position = existing.position;
        }

        resultMap.set(originalUrl, {
          clicks,
          impressions,
          position
        });
        
      } else {
        // Diese URL wurde von GSC zurückgegeben, passt aber zu keiner unserer DB-URLs
        console.log(`[GSC] ⚠️ Keine Zuordnung für GSC-URL: ${gscUrl.substring(0, 60)}... (Normalisiert: ${normalizedGscUrl.substring(0, 60)}...)`);
      }
    }

    console.log(`[GSC] ${resultMap.size} von ${pageUrls.length} DB-URLs erfolgreich zugeordnet`);
    
    // Debugging für nicht gematchte URLs
    const unmatchedUrls = pageUrls.filter(url => !resultMap.has(url));
    if (unmatchedUrls.length > 0) {
      console.log(`[GSC] ⚠️ ${unmatchedUrls.length} DB-URLs ohne GSC-Daten (Top 5):`);
      unmatchedUrls.slice(0, 5).forEach(url => {
        console.log(`  - ${url.substring(0, 80)}... (Normalisiert: ${normalizeUrl(url)})`);
      });
    }

    return resultMap;
    
  } catch (error: unknown) {
    console.error(`[GSC] ❌ Fehler beim Abrufen der Page-Daten (${startDate} - ${endDate}):`, error);
    
    if (error instanceof Error) {
      console.error('[GSC] Error Message:', error.message);
    }
    
    return new Map();
  }
}

/**
 * ✅ KORRIGIERT: Ruft GSC-Daten für Seiten mit verbessertem URL-Matching ab
 */
export async function getGscDataForPagesWithComparison(
  siteUrl: string,
  pageUrls: string[],
  currentRange: { startDate: string, endDate: string },
  previousRange: { startDate: string, endDate: string }
): Promise<Map<string, GscPageData>> {
  
  console.log('[GSC] === START: getGscDataForPagesWithComparison ===');
  console.log(`[GSC] Site URL: ${siteUrl}`);
  console.log(`[GSC] Anzahl URLs: ${pageUrls.length}`);
  
  // 1. Parallele Anfragen für beide Zeiträume
  const [currentDataMap, previousDataMap] = await Promise.all([
    queryGscDataForPages(siteUrl, currentRange.startDate, currentRange.endDate, pageUrls),
    queryGscDataForPages(siteUrl, previousRange.startDate, previousRange.endDate, pageUrls)
  ]);

  const resultMap = new Map<string, GscPageData>();

  // 2. Daten kombinieren und Differenzen berechnen
  for (const url of pageUrls) {
    // WICHTIG: Verwende die Original-URL als Schlüssel
    const current = currentDataMap.get(url) || { clicks: 0, impressions: 0, position: 0 };
    const previous = previousDataMap.get(url) || { clicks: 0, impressions: 0, position: 0 };

    // Spezielle Positionsbehandlung: 0 bedeutet "keine Daten"
    const currentPos = current.position || 0;
    const prevPos = previous.position || 0;

    let posChange = 0;
    if (currentPos > 0 && prevPos > 0) {
      posChange = prevPos - currentPos; // Niedrigere Position ist besser
    }
    
    const roundedPosChange = Math.round(posChange * 100) / 100;

    resultMap.set(url, {
      clicks: current.clicks,
      clicks_prev: previous.clicks,
      clicks_change: current.clicks - previous.clicks,
      
      impressions: current.impressions,
      impressions_prev: previous.impressions,
      impressions_change: current.impressions - previous.impressions,
      
      position: Math.round(currentPos * 100) / 100,
      position_prev: Math.round(prevPos * 100) / 100,
      position_change: roundedPosChange
    });
  }

  console.log(`[GSC] === ENDE: ${resultMap.size} URLs mit Daten versehen ===`);
  
  return resultMap;
}
