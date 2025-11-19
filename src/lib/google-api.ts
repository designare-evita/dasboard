// src/lib/google-api.ts (FINAL & FIXED)

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
    value: number; // 'value' ist wichtig für Recharts
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
    throw new Error('Google API Credentials fehlen.');
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

function formatDateToISO(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

function isAiSource(source: string): boolean {
  if (!source) return false;
  const aiPatterns = ['chatgpt', 'gpt', 'openai', 'claude', 'anthropic', 'bard', 'gemini', 'perplexity', 'bing chat', 'copilot', 'gptbot', 'claudebot', 'google-extended', 'cohere-ai', 'ai2bot', 'you.com', 'neeva', 'phind', 'metaphor', 'notion ai', 'jasper', 'copy.ai', 'writesonic'];
  const sourceLower = source.toLowerCase();
  return aiPatterns.some(pattern => sourceLower.includes(pattern));
}

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

// --- URL Normalisierung ---

export function normalizeGscUrl(url: string): string {
  try {
    if (url.startsWith('/')) {
      const path = url.endsWith('/') && url.length > 1 ? url.slice(0, -1) : url;
      return path.toLowerCase();
    }
    const parsedUrl = new URL(url);
    let host = parsedUrl.hostname;
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    let path = parsedUrl.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.substring(0, path.length - 1);
    }
    const fullPath = host + path + parsedUrl.search;
    return fullPath.toLowerCase();
  } catch (e) {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
  }
}

// --- API-Funktionen ---

export async function getSearchConsoleData(siteUrl: string, startDate: string, endDate: string): Promise<{ clicks: DateRangeData; impressions: DateRangeData }> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  try {
    const response = await searchconsole.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions: ['date'], type: 'web', aggregationType: 'byProperty' } });
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
      clicks: { total: totalClicks, daily: clicksDaily.sort((a, b) => a.date.localeCompare(b.date)) },
      impressions: { total: totalImpressions, daily: impressionsDaily.sort((a, b) => a.date.localeCompare(b.date)) },
    };
  } catch (error: unknown) {
    console.error('[GSC] Fehler beim Abrufen der Daten:', error);
    throw new Error(`Fehler bei Google Search Console API: ${error instanceof Error ? error.message : 'Unbekannt'}`);
  }
}

export async function getTopQueries(siteUrl: string, startDate: string, endDate: string): Promise<TopQueryData[]> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });
  try {
    const res = await searchconsole.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions: ["query"], type: "web", rowLimit: 100, dataState: "all", aggregationType: "byProperty" } });
    const allQueries = res.data.rows?.map((row) => ({
      query: row.keys?.[0] || "N/A",
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })) || [];
    return allQueries.sort((a, b) => b.clicks - a.clicks).slice(0, 100);
  } catch (error: unknown) {
    console.error("[GSC] Fehler beim Abrufen der Top Queries:", error);
    return [];
  }
}

export async function getAnalyticsData(propertyId: string, startDate: string, endDate: string): Promise<{ sessions: DateRangeData; totalUsers: DateRangeData }> {
  const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });
  try {
    const response = await analytics.properties.runReport({ property: formattedPropertyId, requestBody: { dateRanges: [{ startDate, endDate }], dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }] } });
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
      sessions: { total: totalSessions, daily: sessionsDaily },
      totalUsers: { total: totalUsers, daily: usersDaily },
    };
  } catch (error: unknown) {
    console.error('[GA4] Fehler beim Abrufen der Daten:', error);
    throw new Error(`Fehler bei Google Analytics API: ${error instanceof Error ? error.message : 'Unbekannt'}`);
  }
}

export async function getAiTrafficData(propertyId: string, startDate: string, endDate: string): Promise<AiTrafficData> {
  const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });
  try {
    const sourceResponse = await analytics.properties.runReport({ property: formattedPropertyId, requestBody: { dateRanges: [{ startDate, endDate }], dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: '1000' } });
    const trendResponse = await analytics.properties.runReport({ property: formattedPropertyId, requestBody: { dateRanges: [{ startDate, endDate }], dimensions: [{ name: 'date' }, { name: 'sessionSource' }, { name: 'sessionMedium' }], metrics: [{ name: 'sessions' }], orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }], limit: '10000' } });
    const sourceRows = sourceResponse.data.rows || [];
    const trendRows = trendResponse.data.rows || [];
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
    
    const topAiSources = Object.entries(sessionsBySource).map(([source, sessions]) => ({ source, sessions, users: usersBySource[source] || 0, percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0 })).sort((a, b) => b.sessions - a.sessions).slice(0, 5);
    const trend = Object.entries(trendMap).map(([date, sessions]) => ({ date: date, value: sessions })).sort((a, b) => a.date.localeCompare(b.date));
    
    return { totalSessions, totalUsers, sessionsBySource, topAiSources, trend };
  } catch (error: unknown) {
    console.error('[AI-Traffic] Fehler beim Abrufen:', error);
    return { totalSessions: 0, totalUsers: 0, sessionsBySource: {}, topAiSources: [], trend: [] };
  }
}

// ==================================================================
// --- FUNKTIONEN FÜR LANDINGPAGE-DATEN (ABGLEICH) ---
// ==================================================================

/**
 * Interne Hilfsfunktion: Ruft GSC-Daten für eine Liste von Seiten ab.
 * Normalisiert alle URLs auf Kleinbuchstaben für den Vergleich.
 */
async function getGscDataForPagesInternal(
  siteUrl: string,
  startDate: string,
  endDate: string,
  pageUrls: string[]
): Promise<Map<string, { clicks: number; impressions: number; position: number }>> {
  
  if (pageUrls.length === 0) {
    return new Map();
  }

  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        type: 'web',
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'page',
            operator: 'in',
            expression: pageUrls
          }]
        }],
        rowLimit: Math.min(pageUrls.length, 5000)
      },
    });

    const rows = response.data.rows || [];
    const pageData = new Map<string, { clicks: number; impressions: number; position: number }>();
    
    for (const row of rows) {
      const url = row.keys?.[0];
      if (url) {
        // Normalisierte URL als Key speichern
        pageData.set(normalizeGscUrl(url), {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          position: row.position || 0,
        });
      }
    }
    return pageData;

  } catch (error: unknown) {
    console.error(`[GSC] Fehler beim Abrufen der Page-Daten (${startDate} - ${endDate}):`, error);
    return new Map();
  }
}

/**
 * Ruft GSC-Daten für URLs mit Vergleichszeitraum ab.
 * Nutzt `getGscDataForPagesInternal` für die Abfragen.
 */
export async function getGscDataForPagesWithComparison(
  siteUrl: string,
  pageUrls: string[], // URLs aus der DB
  currentRange: { startDate: string, endDate: string },
  previousRange: { startDate: string, endDate: string }
): Promise<Map<string, GscPageData>> {
  
  // 1. Beide Anfragen parallel starten
  const [currentDataMap, previousDataMap] = await Promise.all([
    getGscDataForPagesInternal(siteUrl, currentRange.startDate, currentRange.endDate, pageUrls),
    getGscDataForPagesInternal(siteUrl, previousRange.startDate, previousRange.endDate, pageUrls)
  ]);

  const resultMap = new Map<string, GscPageData>();
  const processedUrls = new Set<string>();

  // 2. Gehe die DB-URLs durch
  for (const dbUrl of pageUrls) {
    // Normalisiere die DB-URL für den Lookup
    const normalizedUrl = normalizeGscUrl(dbUrl);

    if (processedUrls.has(normalizedUrl)) {
      continue;
    }
    processedUrls.add(normalizedUrl);

    // 3. Daten aus den Maps holen (Lookup mit normalisiertem Key)
    const current = currentDataMap.get(normalizedUrl) || { clicks: 0, impressions: 0, position: 0 };
    const previous = previousDataMap.get(normalizedUrl) || { clicks: 0, impressions: 0, position: 0 };

    const currentPos = current.position || 0;
    const prevPos = previous.position || 0;

    let posChange = 0;
    if (currentPos > 0 && prevPos > 0) {
      posChange = prevPos - currentPos;
    }
    
    const roundedPosChange = Math.round(posChange * 100) / 100;

    // 4. Speichere Ergebnis mit der ORIGINAL-URL als Key
    // Damit findet die aufrufende API-Route die Landingpage-ID wieder.
    resultMap.set(dbUrl, {
      clicks: current.clicks,
      clicks_prev: previous.clicks,
      clicks_change: current.clicks - previous.clicks,
      
      impressions: current.impressions,
      impressions_prev: previous.impressions,
      impressions_change: current.impressions - previous.impressions,
      
      position: currentPos, 
      position_prev: prevPos,
      position_change: roundedPosChange
    });
  }

  return resultMap;
}
