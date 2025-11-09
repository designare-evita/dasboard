// src/lib/google-api.ts

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
    [source: string]: number;
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

/**
 * Erstellt den Authentifizierungs-Client für die Google APIs
 */
function createAuth(): JWT {
  // Option 1: Komplettes JSON in GOOGLE_CREDENTIALS
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
      // Fallback zu Option 2
    }
  }

  // Option 2: Separate Environment Variables
  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKeyBase64 || !clientEmail) {
    throw new Error(
      'Google API Credentials fehlen. Setze entweder GOOGLE_CREDENTIALS oder GOOGLE_PRIVATE_KEY_BASE64 + GOOGLE_SERVICE_ACCOUNT_EMAIL'
    );
  }

  try {
    // Base64 zu normalem String dekodieren
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

/**
 * Formatiert GA4-Datum (YYYYMMDD) zu lesbarem Format (DD.MM)
 */
function formatDateForChart(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const day = dateStr.substring(6, 8);
  const month = dateStr.substring(4, 6);
  return `${day}.${month}`;
}

/**
 * Formatiert GA4-Datum (YYYYMMDD) zu ISO-Format (YYYY-MM-DD)
 */
function formatDateToISO(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Prüft, ob eine Quelle ein bekannter KI-Bot ist
 */
function isAiSource(source: string): boolean {
  if (!source) return false;
  
  const aiPatterns = [
    // KI-Chatbots
    'chatgpt', 'gpt', 'openai',
    'claude', 'anthropic',
    'bard', 'gemini',
    'perplexity',
    'bing chat', 'copilot',
    
    // KI-Crawler
    'gptbot', 'claudebot',
    'google-extended', // Google's AI Training Bot
    'cohere-ai',
    'ai2bot',
    
    // Suchmaschinen-KI
    'you.com', 'neeva',
    'phind', 'metaphor',
    
    // Zusätzliche KI-Dienste
    'notion ai', 'jasper',
    'copy.ai', 'writesonic',
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
  
  // Gruppiere ähnliche Quellen
  if (sourceLower.includes('chatgpt') || sourceLower.includes('gptbot')) return 'ChatGPT';
  if (sourceLower.includes('claude')) return 'Claude AI';
  if (sourceLower.includes('bard') || sourceLower.includes('gemini')) return 'Google Gemini';
  if (sourceLower.includes('perplexity')) return 'Perplexity';
  if (sourceLower.includes('bing') || sourceLower.includes('copilot')) return 'Bing Copilot';
  if (sourceLower.includes('you.com')) return 'You.com';
  
  // Fallback: Ersten Teil des Quellennamens verwenden
  const parts = source.split('/')[0].split('?')[0];
  return parts.length > 30 ? parts.substring(0, 27) + '...' : parts;
}

// --- API-Funktionen ---

/**
 * Ruft aggregierte Klick- und Impressionsdaten von der Google Search Console ab
 */
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

/**
 * Ruft die Top 5 Suchanfragen von der Google Search Console ab
 */
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

    const rows = res.data.rows || [];
    const topQueries: TopQueryData[] = [];

    for (const row of rows) {
      const query = row.keys?.[0];
      if (!query) continue;

      topQueries.push({
        query,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      });
    }

    return topQueries;
  } catch (error: unknown) {
    console.error("[GSC] Fehler beim Abrufen der Top Queries:", error);
    const errorMessage = error instanceof Error ? error.message : "Unbekannter API-Fehler";
    throw new Error(`Fehler bei Google Search Console API: ${errorMessage}`);
  }
}

/**
 * Ruft aggregierte Sitzungsdaten von Google Analytics 4 ab
 */
export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<DateRangeData> {
  const auth = createAuth();
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });

  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  try {
    const response = await analyticsData.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      },
    });

    const rows = response.data.rows || [];
    const sessionsDaily: DailyDataPoint[] = [];
    let totalSessions = 0;

    for (const row of rows) {
      const rawDate = row.dimensionValues?.[0]?.value;
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);

      if (rawDate) {
        const date = formatDateToISO(rawDate); // YYYYMMDD -> YYYY-MM-DD
        sessionsDaily.push({ date, value: sessions });
        totalSessions += sessions;
      }
    }

    return {
      total: totalSessions,
      daily: sessionsDaily.sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch (error: unknown) {
    console.error('[GA4] Fehler beim Abrufen der Sessions:', error);
    console.error('[GA4] Request Details:', { propertyId: formattedPropertyId, startDate, endDate });
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter API-Fehler';
    throw new Error(`Fehler bei Google Analytics 4 API: ${errorMessage}`);
  }
}

/**
 * Ruft AI-Traffic-Daten von Google Analytics 4 ab
 * Filtert Sitzungen nach bekannten KI-Quellen (ChatGPT, Claude, Perplexity, etc.)
 */
export async function getAiTrafficData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AiTrafficData> {
  const auth = createAuth();
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });

  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  try {
    console.log('[AI-Traffic] Starte Abfrage für Property:', formattedPropertyId);
    console.log('[AI-Traffic] Zeitraum:', startDate, 'bis', endDate);

    // Zwei separate Abfragen:
    // 1. Quellen-Daten (nach Source/Medium gruppiert)
    const sourceResponse = await analyticsData.properties.runReport({
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
        limit: '10000', // String statt Number
      },
    });

    // 2. Trend-Daten (nach Datum gruppiert)
    const trendResponse = await analyticsData.properties.runReport({
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
        limit: '10000', // String statt Number
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

      // Prüfe, ob es eine KI-Quelle ist
      const fullSource = `${source}${medium ? `/${medium}` : ''}`;
      
      if (isAiSource(fullSource) || isAiSource(source)) {
        const cleanName = cleanAiSourceName(source);
        
        totalSessions += sessions;
        totalUsers += users;
        
        sessionsBySource[cleanName] = (sessionsBySource[cleanName] || 0) + sessions;
        usersBySource[cleanName] = (usersBySource[cleanName] || 0) + users;
        
        console.log('[AI-Traffic] KI-Quelle gefunden:', cleanName, '- Sitzungen:', sessions);
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

    // Fallback mit leeren Daten statt Fehler zu werfen
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
// --- NEUER CODE FÜR LANDINGPAGE-DATEN ---
// ==================================================================

/**
 * Typ für die GSC-Daten einer einzelnen Landingpage mit Vergleichswerten.
 */
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
 * Interne Hilfsfunktion: Ruft GSC-Daten für eine Liste von Seiten in einem Zeitraum ab
 * ✅ KORRIGIERT: Verwendet 'contains' mit URL-Pfad für flexibles Matching
 */
async function queryGscDataForPages(
  siteUrl: string,
  startDate: string,
  endDate: string,
  pageUrls: string[]
): Promise<Map<string, { clicks: number; impressions: number; position: number }>> {
  
  // Verhindert API-Aufruf, wenn keine URLs angefordert werden
  if (pageUrls.length === 0) {
    return new Map();
  }

  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    console.log('[GSC Pages] Abfrage gestartet für', pageUrls.length, 'URLs');
    console.log('[GSC Pages] Zeitraum:', startDate, '-', endDate);
    console.log('[GSC Pages] Beispiel-URL:', pageUrls[0]);

    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        type: 'web',
        aggregationType: 'byPage',
        // ✅ KORRIGIERT: Verwende 'contains' mit URL-Pfad für flexibles Matching
        dimensionFilterGroups: [
          {
            filters: pageUrls.map(pageUrl => {
              try {
                // Extrahiere den Pfad ohne Domain (z.B. /de/Ratgeber/Altersgerechtes-Bauen)
                const urlObj = new URL(pageUrl);
                const pathWithoutDomain = urlObj.pathname;
                
                console.log('[GSC Pages] Filter:', pathWithoutDomain.toLowerCase());
                
                return {
                  dimension: 'page',
                  operator: 'contains', // ✅ Flexibles Matching
                  expression: pathWithoutDomain.toLowerCase() // ✅ Kleinbuchstaben
                };
              } catch (e) {
                console.warn('[GSC Pages] URL-Parsing fehlgeschlagen für:', pageUrl);
                return {
                  dimension: 'page',
                  operator: 'contains',
                  expression: pageUrl
                };
              }
            })
          }
        ],
        rowLimit: Math.min(pageUrls.length * 2, 5000) // ✅ Etwas größer für Varianten
      },
    });

    const rows = response.data.rows || [];
    console.log('[GSC Pages] Antwort: ', rows.length, 'Zeilen');
    
    if (rows.length > 0) {
      console.log('[GSC Pages] Erste Zeile:', rows[0].keys?.[0]);
    }

    const resultMap = new Map<string, { clicks: number; impressions: number; position: number }>();

    // ✅ KORRIGIERT: Matche zurückgegebene URLs flexibel mit den angeforderten URLs
    for (const row of rows) {
      const returnedPage = row.keys?.[0];
      if (!returnedPage) continue;

      // Finde die passende URL aus pageUrls
      const matchedUrl = pageUrls.find(requestedUrl => {
        try {
          const requestedPath = new URL(requestedUrl).pathname.toLowerCase();
          const returnedPath = new URL(returnedPage).pathname.toLowerCase();
          
          // Match wenn einer im anderen enthalten ist
          return returnedPath.includes(requestedPath.replace(/\/$/, '')) || 
                 requestedPath.includes(returnedPath.replace(/\/$/, ''));
        } catch (e) {
          return false;
        }
      });

      if (matchedUrl) {
        console.log('[GSC Pages] Match:', matchedUrl, '→', returnedPage);
        
        resultMap.set(matchedUrl, {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          position: row.position || 0
        });
      }
    }

    console.log('[GSC Pages] Gematchte URLs:', resultMap.size, 'von', pageUrls.length);
    
    return resultMap;
  } catch (error: unknown) {
    console.error(`[GSC Pages] Fehler beim Abrufen der Page-Daten (${startDate} - ${endDate}):`, error);
    return new Map();
  }
}

/**
 * Ruft GSC-Daten (Klicks, Impressionen, Position) für eine Liste von Seiten
 * für zwei Zeiträume (aktuell und vorher) ab und berechnet die Differenz.
 */
export async function getGscDataForPagesWithComparison(
  siteUrl: string,
  pageUrls: string[],
  currentRange: { startDate: string, endDate: string },
  previousRange: { startDate: string, endDate: string }
): Promise<Map<string, GscPageData>> {
  
  console.log('[GSC Comparison] Start für', pageUrls.length, 'URLs');
  
  // 1. Parallele Anfragen für beide Zeiträume
  const [currentDataMap, previousDataMap] = await Promise.all([
    queryGscDataForPages(siteUrl, currentRange.startDate, currentRange.endDate, pageUrls),
    queryGscDataForPages(siteUrl, previousRange.startDate, previousRange.endDate, pageUrls)
  ]);

  const resultMap = new Map<string, GscPageData>();

  // 2. Daten kombinieren und Differenzen berechnen
  for (const url of pageUrls) {
    const current = currentDataMap.get(url) || { clicks: 0, impressions: 0, position: 0 };
    const previous = previousDataMap.get(url) || { clicks: 0, impressions: 0, position: 0 };

    const currentPos = current.position || 0;
    const prevPos = previous.position || 0;

    let posChange = 0;
    if (currentPos > 0 && prevPos > 0) {
      posChange = prevPos - currentPos;
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

  console.log('[GSC Comparison] Ergebnisse für', resultMap.size, 'URLs');

  return resultMap;
}
