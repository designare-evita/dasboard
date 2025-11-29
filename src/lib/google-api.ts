// src/lib/google-api.ts

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// --- Typdefinitionen ---

interface DailyDataPoint {
  date: number; // ✅ Timestamp (number) für Recharts
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
    [key: string]: number;
  };
  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  trend: Array<{
    date: number; // ✅ Timestamp
    sessions: number;
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
          'https://www.googleapis.com/auth/spreadsheets.readonly', 
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
        'https://www.googleapis.com/auth/spreadsheets.readonly', 
      ],
    });
  } catch (error) {
    console.error("Fehler beim Erstellen der JWT-Auth:", error);
    throw new Error("Fehler beim Initialisieren der Google API Authentifizierung.");
  }
}

// --- Sheet API ---
export async function getGoogleSheetData(sheetId: string): Promise<any[]> {
  const auth = createAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:Z2000', 
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        const key = header?.trim();
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
    throw new Error('Konnte Google Sheet nicht lesen.');
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
  const aiPatterns = [
    'chatgpt', 'gpt', 'openai', 'claude', 'anthropic', 'bard', 'gemini',
    'perplexity', 'bing chat', 'copilot', 'gptbot', 'claudebot', 'google-extended', 
    'cohere-ai', 'ai2bot', 'you.com', 'neeva', 'phind', 'metaphor',
    'notion ai', 'jasper', 'copy.ai', 'writesonic',
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

// ✅ WICHTIG: Hilfsfunktion für Regex-Escaping (damit URLs im Regex funktionieren)
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      const dateStr = row.keys?.[0]; // Format: YYYY-MM-DD
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;

      if (dateStr) {
        // Konvertiere YYYY-MM-DD zu Timestamp
        const timestamp = new Date(dateStr).getTime();
        clicksDaily.push({ date: timestamp, value: clicks });
        impressionsDaily.push({ date: timestamp, value: impressions });
        totalClicks += clicks;
        totalImpressions += impressions;
      }
    }

    return {
      clicks: {
        total: totalClicks,
        daily: clicksDaily.sort((a, b) => a.date - b.date), // ✅ Numerische Sortierung
      },
      impressions: {
        total: totalImpressions,
        daily: impressionsDaily.sort((a, b) => a.date - b.date), // ✅ Numerische Sortierung
      },
    };
  } catch (error: unknown) {
    console.error('[GSC] Fehler beim Abrufen der Daten:', error);
    throw new Error(`Fehler bei Google Search Console API`);
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
        aggregationType: "byProperty",
        rowLimit: 100,
      },
    });

    const rows = res.data.rows || [];
    return rows.map((row) => ({
      query: row.keys?.[0] || "",
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  } catch (error: unknown) {
    console.error("[Top Queries] Fehler:", error);
    return [];
  }
}

export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{
  sessions: { total: number; daily: Array<{ date: number; value: number }> };
  totalUsers: { total: number; daily: Array<{ date: number; value: number }> };
  conversions: { total: number; daily: Array<{ date: number; value: number }> };
  engagementRate: { total: number; daily: Array<{ date: number; value: number }> };
}> {
  const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    const response = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'conversions' },
          { name: 'engagementRate' }
        ],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      },
    });

    const rows = response.data.rows || [];
    const sessionsDaily: Array<{ date: number; value: number }> = [];
    const usersDaily: Array<{ date: number; value: number }> = [];
    const conversionsDaily: Array<{ date: number; value: number }> = [];
    const engagementDaily: Array<{ date: number; value: number }> = [];
    
    let totalSessions = 0;
    let totalUsers = 0;
    let totalConversions = 0;
    let weightedEngagement = 0;

    for (const row of rows) {
      const rawDate = row.dimensionValues?.[0]?.value || '';
      const dateStr = formatDateToISO(rawDate);
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
      // Conversions und EngagementRate könnten fehlen wenn Property sie nicht unterstützt
      const conversions = parseInt(row.metricValues?.[2]?.value || '0', 10);
      const engagementRate = parseFloat(row.metricValues?.[3]?.value || '0');

      const timestamp = new Date(dateStr).getTime();
      sessionsDaily.push({ date: timestamp, value: sessions });
      usersDaily.push({ date: timestamp, value: users });
      conversionsDaily.push({ date: timestamp, value: conversions });
      engagementDaily.push({ date: timestamp, value: engagementRate * 100 }); // Als Prozent
      
      totalSessions += sessions;
      totalUsers += users;
      totalConversions += conversions;
      weightedEngagement += (engagementRate * sessions);
    }

    const avgEngagement = totalSessions > 0 ? (weightedEngagement / totalSessions) : 0;

    return {
      sessions: { total: totalSessions, daily: sessionsDaily },
      totalUsers: { total: totalUsers, daily: usersDaily },
      conversions: { total: totalConversions, daily: conversionsDaily },
      engagementRate: { total: avgEngagement, daily: engagementDaily }
    };
  } catch (error: unknown) {
    const err = error as any;
    console.error('[GA4] Fehler:', err.message);
    
    // Falls Conversions/EngagementRate nicht verfügbar sind, versuche ohne
    if (err.message?.includes('INVALID_METRIC') || err.message?.includes('conversions') || err.message?.includes('engagementRate')) {
      console.warn('[GA4] Conversions/EngagementRate nicht verfügbar, fallback zu Basic Metrics');
      try {
        const fallbackResponse = await analytics.properties.runReport({
          property: formattedPropertyId,
          requestBody: {
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: 'date' }],
            metrics: [
              { name: 'sessions' },
              { name: 'totalUsers' }
            ],
            orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
          },
        });

        const rows = fallbackResponse.data.rows || [];
        const sessionsDaily: Array<{ date: number; value: number }> = [];
        const usersDaily: Array<{ date: number; value: number }> = [];
        let totalSessions = 0;
        let totalUsers = 0;

        for (const row of rows) {
          const rawDate = row.dimensionValues?.[0]?.value || '';
          const dateStr = formatDateToISO(rawDate);
          const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
          const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

          const timestamp = new Date(dateStr).getTime();
          sessionsDaily.push({ date: timestamp, value: sessions });
          usersDaily.push({ date: timestamp, value: users });
          totalSessions += sessions;
          totalUsers += users;
        }

        return {
          sessions: { total: totalSessions, daily: sessionsDaily },
          totalUsers: { total: totalUsers, daily: usersDaily },
          conversions: { total: 0, daily: [] },
          engagementRate: { total: 0, daily: [] }
        };
      } catch (fallbackError) {
        console.error('[GA4] Auch Fallback fehlgeschlagen:', fallbackError);
      }
    }
    
    return {
      sessions: { total: 0, daily: [] },
      totalUsers: { total: 0, daily: [] },
      conversions: { total: 0, daily: [] },
      engagementRate: { total: 0, daily: [] }
    };
  }
}

export async function getAiTrafficData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AiTrafficData> {
  const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    const [sourceResponse, trendResponse] = await Promise.all([
      analytics.properties.runReport({
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: '1000',
        },
      }),
      analytics.properties.runReport({
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }, { name: 'sessionSource' }, { name: 'sessionMedium' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
          limit: '10000',
        },
      }),
    ]);

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

    const trendMap: { [timestamp: number]: number } = {}; // ✅ Timestamp als Key
    for (const row of trendRows) {
      const rawDate = row.dimensionValues?.[0]?.value || '';
      const source = row.dimensionValues?.[1]?.value || '';
      const medium = row.dimensionValues?.[2]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const fullSource = `${source}${medium ? `/${medium}` : ''}`;

      if (isAiSource(fullSource) || isAiSource(source)) {
        const dateStr = formatDateToISO(rawDate);
        const timestamp = new Date(dateStr).getTime();
        trendMap[timestamp] = (trendMap[timestamp] || 0) + sessions;
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
      .map(([timestampStr, sessions]) => ({ 
        date: parseInt(timestampStr, 10), // ✅ String-Key zurück zu Number
        sessions 
      }))
      .sort((a, b) => a.date - b.date); // ✅ Numerische Sortierung

    return { totalSessions, totalUsers, sessionsBySource, topAiSources, trend };

  } catch (error) {
    return { totalSessions: 0, totalUsers: 0, sessionsBySource: {}, topAiSources: [], trend: [] };
  }
}

export async function getGa4DimensionReport(
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensionName: 'country' | 'sessionDefaultChannelGroup' | 'deviceCategory'
): Promise<Array<{ name: string; value: number }>> {
  const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });
  
  try {
    const response = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: dimensionName }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
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
        return [...top5, { name: 'Sonstige', value: otherValue }];
      }
      return top5;
    }
    return results;
  } catch (error) {
    return [];
  }
}

// --- GSC Page Data ---

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

// ✅ KORRIGIERTE FUNKTION: Nutzt Batching und Regex für korrekte "ODER"-Abfragen
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
  const resultMap = new Map<string, { clicks: number; impressions: number; position: number }>();

  // Wir teilen die URLs in Batches auf, um Regex-Längenlimits zu vermeiden
  // ca. 25 URLs pro Request ist ein sicherer Wert
  const batchSize = 25;
  const chunks = [];
  for (let i = 0; i < pageUrls.length; i += batchSize) {
    chunks.push(pageUrls.slice(i, i + batchSize));
  }

  for (const chunk of chunks) {
    // Regex bauen: ^(url1|url2|...)$ für exakte Übereinstimmung einer der URLs
    const regexPattern = chunk.map(url => `^${escapeRegExp(url)}$`).join('|');

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
              filters: [
                {
                  dimension: 'page',
                  operator: 'includingRegex', // WICHTIG: Regex statt 'equals'
                  expression: regexPattern
                }
              ]
            }
          ],
          rowLimit: 25000
        },
      });

      const rows = response.data.rows || [];
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
    } catch (error: unknown) {
      console.error(`[GSC] Fehler beim Abrufen eines Batches (${startDate} - ${endDate}):`, error);
      // Wir fahren mit dem nächsten Batch fort, anstatt alles abzubrechen
    }
  }

  return resultMap;
}

export async function getGscDataForPagesWithComparison(
  siteUrl: string,
  pageUrls: string[],
  currentRange: { startDate: string, endDate: string },
  previousRange: { startDate: string, endDate: string }
): Promise<Map<string, GscPageData>> {
  
  // Parallele Abfrage für aktuellen und vorherigen Zeitraum
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
