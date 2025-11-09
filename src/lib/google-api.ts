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
 * ✅ NEU: Normalisiert URLs für konsistenten Vergleich
 * - Konvertiert zu Kleinbuchstaben
 * - Entfernt trailing slashes
 * - Entfernt URL-Fragmente (#)
 * - Behält Query-Parameter bei
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    
    // Normalisierung:
    // 1. Hostname zu Kleinbuchstaben
    urlObj.hostname = urlObj.hostname.toLowerCase();
    
    // 2. Pathname zu Kleinbuchstaben (für case-insensitive Matching)
    urlObj.pathname = urlObj.pathname.toLowerCase();
    
    // 3. Entferne trailing slash (außer bei Root-URL)
    if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // 4. Entferne Fragment (#)
    urlObj.hash = '';
    
    // 5. Sortiere Query-Parameter alphabetisch (optional, für Konsistenz)
    const params = Array.from(urlObj.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    urlObj.search = new URLSearchParams(params).toString();
    
    return urlObj.toString();
  } catch (error) {
    console.error('[normalizeUrl] Ungültige URL:', url, error);
    // Fallback: Einfache Normalisierung
    return url.toLowerCase().replace(/\/$/, '').split('#')[0];
  }
}

/**
 * ✅ NEU: Erstellt Varianten einer URL für besseres Matching
 * GSC gibt URLs manchmal mit unterschiedlichen Formaten zurück
 */
function createUrlVariants(url: string): string[] {
  const variants: Set<string> = new Set();
  
  try {
    const urlObj = new URL(url);
    const base = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    
    // Variante 1: Ohne Query-Parameter
    variants.add(normalizeUrl(base));
    
    // Variante 2: Mit Query-Parametern
    if (urlObj.search) {
      variants.add(normalizeUrl(url));
    }
    
    // Variante 3: Mit trailing slash
    const withSlash = urlObj.pathname.endsWith('/') ? base : base + '/';
    variants.add(normalizeUrl(withSlash));
    
    // Variante 4: Ohne trailing slash
    const withoutSlash = urlObj.pathname.endsWith('/') 
      ? base.slice(0, -1) 
      : base;
    variants.add(normalizeUrl(withoutSlash));
    
  } catch (error) {
    // Fallback
    variants.add(normalizeUrl(url));
  }
  
  return Array.from(variants);
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
 * Ruft die Top Suchanfragen von der Google Search Console ab
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

/**
 * Ruft aggregierte Sitzungs- und Nutzerdaten von Google Analytics 4 ab
 */
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

/**
 * Ruft KI-Traffic-Daten aus Google Analytics 4 ab
 * Identifiziert Traffic von bekannten KI-Bots und Crawlern
 */
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
 * ✅ VERBESSERT: Interne Hilfsfunktion mit besserer URL-Verarbeitung und Logging
 */
async function queryGscDataForPages(
  siteUrl: string,
  startDate: string,
  endDate: string,
  pageUrls: string[]
): Promise<Map<string, { clicks: number; impressions: number; position: number }>> {
  
  // Verhindert API-Aufruf, wenn keine URLs angefordert werden
  if (pageUrls.length === 0) {
    console.log('[GSC] Keine URLs zum Abfragen vorhanden');
    return new Map();
  }

  console.log(`[GSC] Abfrage von ${pageUrls.length} URLs für Zeitraum ${startDate} - ${endDate}`);
  console.log('[GSC] Erste 3 URLs (Original):', pageUrls.slice(0, 3));

  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    // ✅ WICHTIG: Keine URL-Normalisierung beim API-Call!
    // GSC erwartet die exakten URLs, wie sie indexiert sind
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        type: 'web',
        aggregationType: 'byPage',
        // ✅ GEÄNDERT: Verwende 'contains' statt 'equals' für flexibleres Matching
        dimensionFilterGroups: [
          {
            groupType: 'and',
            filters: pageUrls.map(pageUrl => {
              // Extrahiere den Pfad aus der URL (ohne Domain)
              let urlPath = pageUrl;
              try {
                const urlObj = new URL(pageUrl);
                urlPath = urlObj.pathname + urlObj.search;
              } catch {
                // Fallback: behalte die ursprüngliche URL
              }
              
              return {
                dimension: 'page',
                operator: 'contains', // ✅ Flexibler als 'equals'
                expression: urlPath
              };
            })
          }
        ],
        rowLimit: Math.min(pageUrls.length * 2, 5000) // ✅ Höheres Limit für Varianten
      },
    });

    const rows = response.data.rows || [];
    console.log(`[GSC] ${rows.length} Zeilen von GSC erhalten`);
    
    // ✅ NEU: Erstelle Mappings für normalisierte URLs
    const resultMap = new Map<string, { clicks: number; impressions: number; position: number }>();
    const normalizedToOriginal = new Map<string, string>();
    
    // Erstelle Mapping: normalisierte URL -> Original-URL aus Input
    for (const originalUrl of pageUrls) {
      const normalized = normalizeUrl(originalUrl);
      normalizedToOriginal.set(normalized, originalUrl);
      
      // Erstelle auch Mappings für URL-Varianten
      const variants = createUrlVariants(originalUrl);
      variants.forEach(variant => {
        if (!normalizedToOriginal.has(variant)) {
          normalizedToOriginal.set(variant, originalUrl);
        }
      });
    }

    console.log('[GSC] Erste 3 normalisierte URLs:', 
      Array.from(normalizedToOriginal.keys()).slice(0, 3)
    );

    // Verarbeite GSC-Ergebnisse
    for (const row of rows) {
      const gscUrl = row.keys?.[0];
      if (!gscUrl) continue;

      const normalizedGscUrl = normalizeUrl(gscUrl);
      const originalUrl = normalizedToOriginal.get(normalizedGscUrl);
      
      if (originalUrl) {
        // Aggregiere Daten, falls mehrere GSC-URLs zur selben normalisierten URL gehören
        const existing = resultMap.get(originalUrl);
        const clicks = (existing?.clicks || 0) + (row.clicks || 0);
        const impressions = (existing?.impressions || 0) + (row.impressions || 0);
        
        // Position: Nimm den Durchschnitt oder den besseren Wert
        let position = row.position || 0;
        if (existing && existing.position > 0 && position > 0) {
          position = (existing.position + position) / 2;
        } else if (existing && existing.position > 0) {
          position = existing.position;
        }

        resultMap.set(originalUrl, {
          clicks,
          impressions,
          position
        });

        console.log(`[GSC] ✅ Match gefunden: ${originalUrl.substring(0, 50)}... -> Clicks: ${clicks}, Impressions: ${impressions}`);
      } else {
        console.log(`[GSC] ⚠️ Keine Zuordnung für GSC-URL: ${gscUrl.substring(0, 60)}...`);
      }
    }

    console.log(`[GSC] ${resultMap.size} von ${pageUrls.length} URLs erfolgreich zugeordnet`);
    
    // ✅ NEU: Zeige URLs ohne Match für Debugging
    const unmatchedUrls = pageUrls.filter(url => !resultMap.has(url));
    if (unmatchedUrls.length > 0) {
      console.log(`[GSC] ⚠️ ${unmatchedUrls.length} URLs ohne GSC-Daten:`);
      unmatchedUrls.slice(0, 5).forEach(url => {
        console.log(`  - ${url.substring(0, 80)}...`);
      });
    }

    return resultMap;
    
  } catch (error: unknown) {
    console.error(`[GSC] ❌ Fehler beim Abrufen der Page-Daten (${startDate} - ${endDate}):`, error);
    
    // ✅ NEU: Detaillierteres Error-Logging
    if (error instanceof Error) {
      console.error('[GSC] Error Message:', error.message);
      console.error('[GSC] Error Stack:', error.stack);
    }
    
    console.error('[GSC] Request Details:', { 
      siteUrl, 
      startDate, 
      endDate, 
      urlCount: pageUrls.length,
      firstUrl: pageUrls[0]
    });
    
    // Leeres Map zurückgeben, damit Promise.all nicht fehlschlägt
    return new Map();
  }
}

/**
 * ✅ VERBESSERT: Ruft GSC-Daten für Seiten mit verbessertem URL-Matching ab
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
  console.log(`[GSC] Aktueller Zeitraum: ${currentRange.startDate} - ${currentRange.endDate}`);
  console.log(`[GSC] Vorheriger Zeitraum: ${previousRange.startDate} - ${previousRange.endDate}`);
  
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

    // Spezielle Positionsbehandlung: 0 bedeutet "keine Daten", nicht Position 0
    const currentPos = current.position || 0;
    const prevPos = previous.position || 0;

    // Positionsänderung nur berechnen, wenn beide Werte > 0 sind
    let posChange = 0;
    if (currentPos > 0 && prevPos > 0) {
      posChange = prevPos - currentPos; // Niedrigere Position ist besser
    } else if (currentPos > 0 && prevPos === 0) {
      posChange = 0; // Neu gerankt
    } else if (currentPos === 0 && prevPos > 0) {
      posChange = 0; // Ranking verloren
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
