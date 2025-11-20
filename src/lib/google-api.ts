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
    sessions: number;
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
          'https://www.googleapis.com/auth/spreadsheets.readonly', // <--- NEU: Zugriff auf Sheets
        ],
      });
    } catch (e) {
      console.error("Fehler beim Parsen von GOOGLE_CREDENTIALS:", e);
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
        'https://www.googleapis.com/auth/spreadsheets.readonly', // <--- NEU: Zugriff auf Sheets
      ],
    });
  } catch (error) {
    console.error("Fehler beim Erstellen der JWT-Auth:", error);
    throw new Error("Fehler beim Initialisieren der Google API Authentifizierung.");
  }
}

// --- NEUE FUNKTION: Google Sheet Daten lesen ---

export async function getGoogleSheetData(sheetId: string): Promise<any[]> {
  const auth = createAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // Wir holen daten vom ersten Tabellenblatt (Standard)
    // Range A1:Z2000 deckt die meisten Redaktionspläne ab
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:Z2000', 
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return [];
    }

    // Die erste Zeile sind die Header (Spaltennamen)
    const headers = rows[0];
    
    // Wir mappen die restlichen Zeilen auf Objekte basierend auf den Headern
    const data = rows.slice(1).map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        const key = header?.trim();
        // Wenn die Zeile kürzer ist als die Header, ist der Wert undefined -> leerer String
        const val = row[index] ? row[index].toString().trim() : '';
        if (key) {
          obj[key] = val;
        }
      });
      return obj;
    });

    return data;

  } catch (error: unknown) {
    console.error('[Sheets API] Fehler:', error);
    throw new Error('Konnte Google Sheet nicht lesen. Stellen Sie sicher, dass die Service-Account-Email Lesezugriff auf das Sheet hat.');
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

function isAiSource(source: string): boolean {
  if (!source) return false;
  
  const aiPatterns = [
    'chatgpt', 'gpt', 'openai',
    'claude', 'anthropic',
    'bard', 'gemini',
    'perplexity',
    'bing chat', 'copilot',
    'gptbot', 'claudebot',
    'google-extended', 
    'cohere-ai',
    'ai2bot',
    'you.com', 'neeva',
    'phind', 'metaphor',
    'notion ai', 'jasper',
    'copy.ai', 'writesonic',
  ];

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

// --- API-Funktionen ---

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

    const topAiSources = Object.entries(sessionsBySource)
      .map(([source, sessions]) => ({
        source,
        sessions,
        users: usersBySource[source] || 0,
        percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    const trend = Object.entries(trendMap)
      .map(([date, sessions]) => ({
        date: date,
        sessions: sessions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSessions,
      totalUsers,
      sessionsBySource,
      topAiSources,
      trend,
    };

  } catch (error: unknown) {
    console.error('[AI-Traffic] Fehler beim Abrufen:', error);
    return {
      totalSessions: 0,
      totalUsers: 0,
      sessionsBySource: {},
      topAiSources: [],
      trend: [],
    };
  }
}

export async function getGa4DimensionReport(
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensionName: 'country' | 'sessionDefaultChannelGroup' | 'deviceCategory'
): Promise<Array<{ name: string; value: number }>> {
  
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
        dimensions: [{ name: dimensionName }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{
          metric: { metricName: 'sessions' },
          desc: true,
        }],
        limit: '10',
      },
    });
    
    const rows = response.data.rows || [];
    const results: Array<{ name: string; value: number }> = [];
    
    for (const row of rows) {
      const name = row.dimensionValues?.[0]?.value || 'Unknown';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      results.push({ name, value: sessions });
    }
    
    if (results.length > 6) {
      const top5 = results.slice(0, 5);
      const otherValue = results.slice(5).reduce((acc, curr) => acc + curr.value, 0);
      
      if (otherValue > 0) {
        return [
          ...top5,
          { name: 'Sonstige', value: otherValue }
        ];
      }
      return top5;
    }
    
    return results;
  } catch (error: unknown) {
    console.error(`[GA4] Fehler beim Abrufen des ${dimensionName}-Reports:`, error);
    return [];
  }
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

async function queryGscDataForPages(
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
        aggregationType: 'byPage',
        dimensionFilterGroups: [
          {
            filters: pageUrls.map(pageUrl => ({
              dimension: 'page',
              operator: 'equals',
              expression: pageUrl
            }))
          }
        ],
        rowLimit: Math.min(pageUrls.length, 5000)
      },
    });

    const rows = response.data.rows || [];
    const resultMap = new Map<string, { clicks: number; impressions: number; position: number }>();

    for (const row of rows) {
      const page = row.keys?.[0];
      if (page) {
        resultMap.set(page, {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          position: row.position || 0 
        });
      }
    }
    return resultMap;
  } catch (error: unknown) {
    console.error(`[GSC] Fehler beim Abrufen der Page-Daten (${startDate} - ${endDate}):`, error);
    return new Map();
  }
}

export async function getGscDataForPagesWithComparison(
  siteUrl: string,
  pageUrls: string[],
  currentRange: { startDate: string, endDate: string },
  previousRange: { startDate: string, endDate: string }
): Promise<Map<string, GscPageData>> {
  
  const [currentDataMap, previousDataMap] = await Promise.all([
    queryGscDataForPages(siteUrl, currentRange.startDate, currentRange.endDate, pageUrls),
    queryGscDataForPages(siteUrl, previousRange.startDate, previousRange.endDate, pageUrls)
  ]);

  const resultMap = new Map<string, GscPageData>();

  for (const url of pageUrls) {
    const current = currentDataMap.get(url) || { clicks: 0, impressions: 0, position: 0 };
    const previous = previousDataMap.get(url) || { clicks: 0, impressions: 0, position: 0 };

    const currentPos = current.position || 0;
    const prevPos = previous.position || 0;

    let posChange = 0;
    if (currentPos > 0 && prevPos > 0) {
      posChange = prevPos - currentPos;
    } else if (currentPos > 0 && prevPos === 0) {
      posChange = 0;
    } else if (currentPos === 0 && prevPos > 0) {
      posChange = 0;
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

  return resultMap;
}
