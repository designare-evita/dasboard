// src/lib/google-api.ts

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ChartEntry } from '@/lib/dashboard-shared';
import type { TopQueryData } from '@/types/dashboard';

// --- Typdefinitionen ---

interface DailyDataPoint {
  date: number; // ✅ Timestamp
  value: number;
}

export interface DateRangeData {
  total: number;
  daily: DailyDataPoint[];
}

// ✅ NEU: Erweiterte GA4-Response mit paidSearch
export interface Ga4ExtendedData {
  sessions: DateRangeData;
  totalUsers: DateRangeData;
  newUsers: DateRangeData;
  conversions: DateRangeData;
  bounceRate: DateRangeData;
  engagementRate: DateRangeData;
  avgEngagementTime: DateRangeData;
  clicks: DateRangeData;
  impressions: DateRangeData;
  paidSearch: DateRangeData; // ✅ NEU
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
    date: number; 
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
          'https://www.googleapis.com/auth/spreadsheets.readonly'
        ],
      });
    } catch (e) {
      console.error('Fehler beim Parsen der GOOGLE_CREDENTIALS:', e);
      throw new Error('Google Credentials invalid');
    }
  }
  
  // Fallback für alte Env Vars
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
        'https://www.googleapis.com/auth/spreadsheets.readonly', 
      ],
    });
  } catch (error) {
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

// --- Helper ---

function parseGscDate(dateString: string): number {
  return new Date(dateString).getTime();
}

function parseGa4Date(dateString: string): number {
  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10) - 1;
  const day = parseInt(dateString.substring(6, 8), 10);
  return new Date(year, month, day).getTime();
}

// --- Search Console (GSC) ---

export async function getSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{ clicks: DateRangeData; impressions: DateRangeData }> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        rowLimit: 25000,
      },
    });

    const rows = res.data.rows || [];
    rows.sort((a, b) => (a.keys?.[0] || '').localeCompare(b.keys?.[0] || ''));

    const clicksDaily: DailyDataPoint[] = [];
    const impressionsDaily: DailyDataPoint[] = [];
    let totalClicks = 0;
    let totalImpressions = 0;

    for (const row of rows) {
      const dateStr = row.keys?.[0]; 
      if (!dateStr) continue;

      const dateTs = parseGscDate(dateStr);
      const c = row.clicks || 0;
      const i = row.impressions || 0;

      clicksDaily.push({ date: dateTs, value: c });
      impressionsDaily.push({ date: dateTs, value: i });

      totalClicks += c;
      totalImpressions += i;
    }

    return {
      clicks: { total: totalClicks, daily: clicksDaily },
      impressions: { total: totalImpressions, daily: impressionsDaily },
    };
  } catch (error) {
    console.error('GSC Error:', error);
    throw error;
  }
}

export async function getTopQueries(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<TopQueryData[]> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        rowLimit: 1000,
      },
    });

    const rows = res.data.rows || [];
    
    // ✅ Aggregation Logic (Gruppieren nach Query, Top URL ermitteln)
    const queryMap = new Map<string, {
      clicks: number;
      impressions: number;
      positionSum: number;
      count: number;
      topUrl: string;
      maxClicksForUrl: number;
    }>();

    for (const row of rows) {
      const query = row.keys?.[0] || '(not set)';
      const url = row.keys?.[1] || '';
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;
      const position = row.position || 0;
      
      if (!queryMap.has(query)) {
        queryMap.set(query, {
          clicks: 0,
          impressions: 0,
          positionSum: 0,
          count: 0,
          topUrl: url,
          maxClicksForUrl: clicks
        });
      }
      
      const entry = queryMap.get(query)!;
      entry.clicks += clicks;
      entry.impressions += impressions;
      entry.positionSum += (position * impressions); 
      
      if (clicks > entry.maxClicksForUrl) {
        entry.maxClicksForUrl = clicks;
        entry.topUrl = url;
      }
    }
    
    const results: TopQueryData[] = [];
    for (const [query, data] of queryMap.entries()) {
        const avgPosition = data.impressions > 0 ? data.positionSum / data.impressions : 0;
        const ctr = data.impressions > 0 ? data.clicks / data.impressions : 0;
        
        results.push({
            query,
            clicks: data.clicks,
            impressions: data.impressions,
            ctr,
            position: avgPosition,
            url: data.topUrl
        });
    }

    return results
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);
  } catch (error) {
    console.error('Error in getTopQueries:', error);
    return [];
  }
}

// --- Google Analytics (GA4) ---

export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4ExtendedData> {
  const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  // Default-Werte
  const defaultData: DateRangeData = { total: 0, daily: [] };
  const result: Ga4ExtendedData = {
    sessions: { ...defaultData },
    totalUsers: { ...defaultData },
    newUsers: { ...defaultData },
    conversions: { ...defaultData },
    bounceRate: { ...defaultData },
    engagementRate: { ...defaultData },
    avgEngagementTime: { ...defaultData },
    clicks: { ...defaultData },
    impressions: { ...defaultData },
    paidSearch: { ...defaultData }
  };

  try {
    // Report mit Tagesaufteilung
    const response = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'conversions' },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' }
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
    });

    const rows = response.data.rows || [];
    
    let sessionsTotal = 0;
    let totalUsersTotal = 0;
    let newUsersTotal = 0;
    let conversionsTotal = 0;
    let bounceRateSum = 0;
    let engagementRateSum = 0;
    let avgEngagementTimeSum = 0;
    let count = 0;

    for (const row of rows) {
      const dateStr = row.dimensionValues?.[0]?.value || '';
      const dateTs = parseGa4Date(dateStr);

      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const newUsers = parseInt(row.metricValues?.[2]?.value || '0', 10);
      const conversions = parseInt(row.metricValues?.[3]?.value || '0', 10);
      const bounceRate = parseFloat(row.metricValues?.[4]?.value || '0');
      const engagementRate = parseFloat(row.metricValues?.[5]?.value || '0');
      const avgEngagementTime = parseFloat(row.metricValues?.[6]?.value || '0');

      result.sessions.daily.push({ date: dateTs, value: sessions });
      result.totalUsers.daily.push({ date: dateTs, value: users });
      result.newUsers.daily.push({ date: dateTs, value: newUsers });
      result.conversions.daily.push({ date: dateTs, value: conversions });
      result.bounceRate.daily.push({ date: dateTs, value: bounceRate });
      result.engagementRate.daily.push({ date: dateTs, value: engagementRate });
      result.avgEngagementTime.daily.push({ date: dateTs, value: avgEngagementTime });

      sessionsTotal += sessions;
      totalUsersTotal += users;
      newUsersTotal += newUsers;
      conversionsTotal += conversions;
      bounceRateSum += bounceRate;
      engagementRateSum += engagementRate;
      avgEngagementTimeSum += avgEngagementTime;
      count++;
    }

    result.sessions.total = sessionsTotal;
    result.totalUsers.total = totalUsersTotal;
    result.newUsers.total = newUsersTotal;
    result.conversions.total = conversionsTotal;
    result.bounceRate.total = count > 0 ? bounceRateSum / count : 0;
    result.engagementRate.total = count > 0 ? engagementRateSum / count : 0;
    result.avgEngagementTime.total = count > 0 ? avgEngagementTimeSum / count : 0;

    // ✅ Paid Search Daten separat laden
    try {
      const paidResponse = await analytics.properties.runReport({
        property: formattedPropertyId,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }],
          dimensionFilter: {
            filter: {
              fieldName: 'sessionDefaultChannelGroup',
              stringFilter: {
                matchType: 'EXACT',
                value: 'Paid Search'
              }
            }
          },
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        },
      });

      const paidRows = paidResponse.data.rows || [];
      let paidTotal = 0;

      for (const row of paidRows) {
        const dateStr = row.dimensionValues?.[0]?.value || '';
        const dateTs = parseGa4Date(dateStr);
        const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);

        result.paidSearch.daily.push({ date: dateTs, value: sessions });
        paidTotal += sessions;
      }

      result.paidSearch.total = paidTotal;
    } catch (paidError) {
      console.warn('[GA4] Paid Search Daten nicht verfügbar:', paidError);
    }

    return result;
  } catch (error) {
    console.error('GA4 Error:', error);
    throw error;
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

  const AI_SOURCES = [
    'chatgpt.com', 'chat.openai.com', 'openai.com',
    'claude.ai', 'anthropic.com',
    'gemini.google.com', 'bard.google.com',
    'perplexity.ai',
    'bing.com/chat', 'copilot.microsoft.com',
    'you.com',
    'poe.com',
    'character.ai'
  ];

  try {
    const response = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'date' }
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' }
        ],
        dimensionFilter: {
          orGroup: {
            expressions: AI_SOURCES.map(source => ({
              filter: {
                fieldName: 'sessionSource',
                stringFilter: {
                  matchType: 'CONTAINS',
                  value: source,
                  caseSensitive: false
                }
              }
            }))
          }
        },
        orderBys: [
          { metric: { metricName: 'sessions' }, desc: true }
        ],
        limit: '1000'
      },
    });

    const rows = response.data.rows || [];

    let totalSessions = 0;
    let totalUsers = 0;
    const sessionsBySource: { [key: string]: number } = {};
    const usersBySource: { [key: string]: number } = {};
    const trendMap = new Map<number, number>();

    for (const row of rows) {
      const source = row.dimensionValues?.[0]?.value || 'unknown';
      const dateStr = row.dimensionValues?.[1]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

      totalSessions += sessions;
      totalUsers += users;

      sessionsBySource[source] = (sessionsBySource[source] || 0) + sessions;
      usersBySource[source] = (usersBySource[source] || 0) + users;

      if (dateStr) {
        const dateTs = parseGa4Date(dateStr);
        trendMap.set(dateTs, (trendMap.get(dateTs) || 0) + sessions);
      }
    }

    const topAiSources = Object.entries(sessionsBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, sessions]) => ({
        source,
        sessions,
        users: usersBySource[source] || 0,
        percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0
      }));

    const trend = Array.from(trendMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([date, sessions]) => ({ date, sessions }));

    return {
      totalSessions,
      totalUsers,
      sessionsBySource,
      topAiSources,
      trend
    };
  } catch (error) {
    console.error('Error fetching AI traffic data:', error);
    return {
      totalSessions: 0,
      totalUsers: 0,
      sessionsBySource: {},
      topAiSources: [],
      trend: []
    };
  }
}

export async function getGa4DimensionReport(
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensionName: string
): Promise<ChartEntry[]> {
  const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });
  
  try {
    const response = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: dimensionName }],
        metrics: [
          { name: 'sessions' }, 
          { name: 'engagementRate' }, 
          { name: 'conversions' }
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '10',
      },
    });
    
    const rows = response.data.rows || [];
    const results: ChartEntry[] = [];
    
    for (const row of rows) {
      const name = row.dimensionValues?.[0]?.value || 'Unknown';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const rate = parseFloat(row.metricValues?.[1]?.value || '0'); 
      const conversions = parseInt(row.metricValues?.[2]?.value || '0', 10);

      results.push({ 
        name, 
        value: sessions,
        subValue: `${(rate * 100).toFixed(1)}%`,
        subLabel: 'Interaktionsrate',
        subValue2: conversions,
        subLabel2: 'Conversions'
      });
    }
    
    if (results.length > 6) {
      const top5 = results.slice(0, 5);
      const otherSessions = results.slice(5).reduce((acc, curr) => acc + curr.value, 0);
      const otherConversions = results.slice(5).reduce((acc, curr) => acc + (curr.subValue2 || 0), 0);
      
      if (otherSessions > 0) {
        return [...top5, { 
          name: 'Sonstige', 
          value: otherSessions, 
          subValue: '-', 
          subLabel: 'Interaktionsrate',
          subValue2: otherConversions,
          subLabel2: 'Conversions'
        }];
      }
      return top5;
    }
    return results;
  } catch (error) {
    console.error(`GA4 Dimension Report Error (${dimensionName}):`, error);
    return [];
  }
}

export interface ConvertingPageData {
  path: string;
  conversions: number;
  sessions: number;
  conversionRate: string;
}

export async function getTopConvertingPages(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConvertingPageData[]> {
  const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    const response = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'landingPagePlusQueryString' }],
        metrics: [
          { name: 'conversions' },
          { name: 'sessions' },
          { name: 'engagementRate' }, 
          { name: 'newUsers' } 
        ],
        orderBys: [
          { metric: { metricName: 'conversions' }, desc: true },
          { metric: { metricName: 'sessions' }, desc: true }
        ],
        limit: '100',
      },
    });

    const rows = response.data.rows || [];

    return rows.map(row => {
      const conversions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const sessions = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const engagementRate = parseFloat(row.metricValues?.[2]?.value || '0');
      const newUsers = parseInt(row.metricValues?.[3]?.value || '0', 10);

      const convRate = sessions > 0 ? ((conversions / sessions) * 100).toFixed(2) : '0';

      return {
        path: row.dimensionValues?.[0]?.value || '(not set)',
        conversions,
        sessions,
        newUsers,
        conversionRate: convRate,
        engagementRate: parseFloat((engagementRate * 100).toFixed(2))
      };
    })
    .filter(p => p.conversions > 0 || p.sessions > 5)
    .slice(0, 50);

  } catch (error) {
    console.error('Error fetching Top Converting Pages:', error);
    return [];
  }
}

// ✅ GSC Daten für spezifische Pages mit Vergleich
// Mit BATCHING für große URL-Listen (GSC API Limit umgehen)

export interface GscPageData {
  clicks: number;
  clicks_change: number;
  impressions: number;
  impressions_change: number;
  position: number;
  position_change: number;
}

const GSC_BATCH_SIZE = 20; // Max URLs pro API-Request (GSC hat Regex-Längenlimit)

async function fetchGscBatch(
  searchconsole: any,
  siteUrl: string,
  pageUrls: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, { clicks: number; impressions: number; position: number }>> {
  const dataMap = new Map<string, { clicks: number; impressions: number; position: number }>();
  
  if (pageUrls.length === 0) return dataMap;

  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'page',
                operator: 'including_regex',
                expression: pageUrls.map(url => url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
              }
            ]
          }
        ],
        rowLimit: 25000,
      },
    });

    for (const row of response.data.rows || []) {
      const page = row.keys?.[0];
      if (page) {
        dataMap.set(page, {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          position: row.position || 0
        });
      }
    }
  } catch (error: any) {
    // Bei Fehler loggen aber nicht abbrechen - andere Batches können noch funktionieren
    console.error(`[GSC Batch] Fehler für ${pageUrls.length} URLs:`, error.message);
  }

  return dataMap;
}

export async function getGscDataForPagesWithComparison(
  siteUrl: string,
  pageUrls: string[],
  currentRange: { startDate: string; endDate: string },
  previousRange: { startDate: string; endDate: string }
): Promise<Map<string, GscPageData>> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const resultMap = new Map<string, GscPageData>();

  // ✅ URLs in Batches aufteilen
  const batches: string[][] = [];
  for (let i = 0; i < pageUrls.length; i += GSC_BATCH_SIZE) {
    batches.push(pageUrls.slice(i, i + GSC_BATCH_SIZE));
  }

  console.log(`[GSC] Verarbeite ${pageUrls.length} URLs in ${batches.length} Batches...`);

  try {
    // Alle Current Period Batches parallel abfragen
    const currentDataMaps = await Promise.all(
      batches.map(batch => fetchGscBatch(searchconsole, siteUrl, batch, currentRange.startDate, currentRange.endDate))
    );

    // Alle Previous Period Batches parallel abfragen
    const previousDataMaps = await Promise.all(
      batches.map(batch => fetchGscBatch(searchconsole, siteUrl, batch, previousRange.startDate, previousRange.endDate))
    );

    // Ergebnisse zusammenführen
    const currentData = new Map<string, { clicks: number; impressions: number; position: number }>();
    const previousData = new Map<string, { clicks: number; impressions: number; position: number }>();

    for (const map of currentDataMaps) {
      for (const [key, value] of map.entries()) {
        currentData.set(key, value);
      }
    }

    for (const map of previousDataMaps) {
      for (const [key, value] of map.entries()) {
        previousData.set(key, value);
      }
    }

    // Changes berechnen
    for (const url of pageUrls) {
      const current = currentData.get(url);
      const previous = previousData.get(url);

      if (current) {
        const clicksChange = previous ? 
          (previous.clicks > 0 ? ((current.clicks - previous.clicks) / previous.clicks) * 100 : 100) 
          : (current.clicks > 0 ? 100 : 0);
        
        const impressionsChange = previous ? 
          (previous.impressions > 0 ? ((current.impressions - previous.impressions) / previous.impressions) * 100 : 100)
          : (current.impressions > 0 ? 100 : 0);
        
        const positionChange = previous ? 
          (current.position - previous.position)
          : 0;

        resultMap.set(url, {
          clicks: current.clicks,
          clicks_change: clicksChange,
          impressions: current.impressions,
          impressions_change: impressionsChange,
          position: current.position,
          position_change: positionChange
        });
      }
    }

    console.log(`[GSC] ✅ ${resultMap.size} von ${pageUrls.length} URLs erfolgreich abgerufen.`);
    return resultMap;

  } catch (error) {
    console.error('Error in getGscDataForPagesWithComparison:', error);
    throw error;
  }
}

// ✅ NEU: GSC CTR pro Seite laden (für LandingPageChart)
export async function getGscPageCtr(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  
  try {
    const auth = createAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });
    
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 500
      }
    });
    
    response.data.rows?.forEach(row => {
      const pageUrl = row.keys?.[0];
      const ctr = row.ctr;
      
      // ✅ Explizite Null-Prüfung für beide Werte
      if (pageUrl && ctr !== undefined && ctr !== null) {
        try {
          const url = new URL(pageUrl);
          result.set(url.pathname, ctr * 100); // Als Prozent
        } catch {
          // Fallback: Pfad direkt extrahieren
          const path = pageUrl.replace(/^https?:\/\/[^\/]+/, '') || '/';
          result.set(path, ctr * 100);
        }
      }
    });
    
    console.log(`[GSC] ${result.size} Seiten mit CTR-Daten geladen`);
  } catch (err) {
    console.warn('[GSC] CTR-Daten konnten nicht geladen werden:', err);
  }
  
  return result;
}
