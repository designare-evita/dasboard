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
        rowLimit: 500,
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
      .slice(0, 10);

  } catch (error) {
    console.error('Top Queries Error:', error);
    return [];
  }
}

// --- Google Analytics 4 (GA4) ---

export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4ExtendedData> {
  const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`;
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    // ✅ 1. Standard Metriken (Sessions, Users, Conversions, etc.)
    const mainResponse = await analytics.properties.runReport({
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
          { name: 'userEngagementDuration' },
        ],
      },
    });

    // ✅ 2. Paid Search Daten (separater Request)
    const paidSearchResponse = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionDefaultChannelGroup',
            stringFilter: { 
              matchType: 'EXACT',
              value: 'Paid Search' 
            }
          }
        },
        metrics: [{ name: 'sessions' }]
      },
    });

    const rows = mainResponse.data.rows || [];
    const paidRows = paidSearchResponse.data.rows || [];

    // ✅ Parse Paid Search Daten
    const paidSearchMap = new Map<number, number>();
    for (const row of paidRows) {
      const dateStr = row.dimensionValues?.[0]?.value;
      if (dateStr) {
        const dateTs = parseGa4Date(dateStr);
        const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
        paidSearchMap.set(dateTs, sessions);
      }
    }

    // ✅ Parse Main Metriken
    const sessionsDaily: DailyDataPoint[] = [];
    const usersDaily: DailyDataPoint[] = [];
    const newUsersDaily: DailyDataPoint[] = [];
    const conversionsDaily: DailyDataPoint[] = [];
    const bounceRateDaily: DailyDataPoint[] = [];
    const engagementRateDaily: DailyDataPoint[] = [];
    const avgTimeDaily: DailyDataPoint[] = [];
    const paidSearchDaily: DailyDataPoint[] = [];

    let totalSessions = 0;
    let totalUsers = 0;
    let totalNewUsers = 0;
    let totalConversions = 0;
    let totalEngagementDuration = 0;
    let totalBounceRate = 0;
    let totalEngagementRate = 0;
    let totalPaidSearch = 0;

    for (const row of rows) {
      const dateStr = row.dimensionValues?.[0]?.value;
      if (!dateStr) continue;

      const dateTs = parseGa4Date(dateStr);

      const sess = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const usrs = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const newUsrs = parseInt(row.metricValues?.[2]?.value || '0', 10);
      const conv = parseInt(row.metricValues?.[3]?.value || '0', 10);
      const bounce = parseFloat(row.metricValues?.[4]?.value || '0');
      const engage = parseFloat(row.metricValues?.[5]?.value || '0');
      const duration = parseFloat(row.metricValues?.[6]?.value || '0');

      sessionsDaily.push({ date: dateTs, value: sess });
      usersDaily.push({ date: dateTs, value: usrs });
      newUsersDaily.push({ date: dateTs, value: newUsrs });
      conversionsDaily.push({ date: dateTs, value: conv });
      bounceRateDaily.push({ date: dateTs, value: bounce });
      engagementRateDaily.push({ date: dateTs, value: engage });

      const avgTime = sess > 0 ? duration / sess : 0;
      avgTimeDaily.push({ date: dateTs, value: avgTime });

      // ✅ Paid Search für diesen Tag
      const paidSess = paidSearchMap.get(dateTs) || 0;
      paidSearchDaily.push({ date: dateTs, value: paidSess });

      totalSessions += sess;
      totalUsers += usrs;
      totalNewUsers += newUsrs;
      totalConversions += conv;
      totalEngagementDuration += duration;
      totalBounceRate += bounce * sess;
      totalEngagementRate += engage * sess;
      totalPaidSearch += paidSess;
    }

    const calculatedBounceRate = totalSessions > 0 ? totalBounceRate / totalSessions : 0;
    const calculatedEngagementRate = totalSessions > 0 ? totalEngagementRate / totalSessions : 0;
    const fallbackAvgTime = totalSessions > 0 ? totalEngagementDuration / totalSessions : 0;
    
    return {
      sessions: { total: totalSessions, daily: sessionsDaily },
      totalUsers: { total: totalUsers, daily: usersDaily },
      newUsers: { total: totalNewUsers, daily: newUsersDaily },
      conversions: { total: totalConversions, daily: conversionsDaily },
      bounceRate: { total: calculatedBounceRate, daily: bounceRateDaily }, 
      engagementRate: { total: calculatedEngagementRate, daily: engagementRateDaily },
      avgEngagementTime: { total: fallbackAvgTime, daily: avgTimeDaily },
      clicks: { total: 0, daily: [] },
      impressions: { total: 0, daily: [] },
      paidSearch: { total: totalPaidSearch, daily: paidSearchDaily } // ✅ NEU
    };

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

  try {
    const response = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'sessionSource' }, 
          { name: 'sessionMedium' }, 
          { name: 'date' }           
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' }
        ],
      },
    });

    const rows = response.data.rows || [];
    
    let totalAiSessions = 0;
    let totalAiUsers = 0;
    const sessionsBySource: Record<string, number> = {};
    const sourceStats: Record<string, { sessions: number; users: number }> = {};
    const dailyTrend: Record<number, number> = {};

    const aiPatterns = [
      /chatgpt/i, /openai/i, /bing/i, /copilot/i, /gemini/i, /bard/i, 
      /claude/i, /anthropic/i, /perplexity/i, /ai_search/i
    ];

    for (const row of rows) {
      const source = row.dimensionValues?.[0]?.value || '';
      const dateStr = row.dimensionValues?.[2]?.value; 
      
      const sess = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const usrs = parseInt(row.metricValues?.[1]?.value || '0', 10);

      const isAi = aiPatterns.some(pattern => pattern.test(source));

      if (isAi) {
        totalAiSessions += sess;
        totalAiUsers += usrs;

        if (!sourceStats[source]) {
          sourceStats[source] = { sessions: 0, users: 0 };
        }
        sourceStats[source].sessions += sess;
        sourceStats[source].users += usrs;

        if (dateStr) {
          const dateTs = parseGa4Date(dateStr);
          dailyTrend[dateTs] = (dailyTrend[dateTs] || 0) + sess;
        }
      }
    }

    const topAiSources = Object.entries(sourceStats)
      .map(([source, stats]) => ({
        source,
        sessions: stats.sessions,
        users: stats.users,
        percentage: totalAiSessions > 0 ? (stats.sessions / totalAiSessions) * 100 : 0
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    const trend = Object.entries(dailyTrend)
      .map(([date, sessions]) => ({
        date: parseInt(date, 10),
        sessions
      }))
      .sort((a, b) => a.date - b.date);

    return {
      totalSessions: totalAiSessions,
      totalUsers: totalAiUsers,
      sessionsBySource: {}, 
      topAiSources,
      trend
    };

  } catch (error) {
    console.error('AI Traffic API Error:', error);
    return {
      totalSessions: 0,
      totalUsers: 0,
      sessionsBySource: {},
      topAiSources: [],
      trend: []
    };
  }
}

// ✅ KORRIGIERT: Holt Conversions und setzt "Interaktionsrate"
export async function getGa4DimensionReport(
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensionName: 'country' | 'sessionDefaultChannelGroup' | 'deviceCategory'
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

// Funktion für Cron-Job - GSC Daten für spezifische Pages mit Vergleich
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

  // ✅ NEU: URLs in Batches aufteilen
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


    // 3. Parse Current Data
    const currentData = new Map<string, { clicks: number; impressions: number; position: number }>();
    for (const row of currentResponse.data.rows || []) {
      const page = row.keys?.[0];
      if (page) {
        currentData.set(page, {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          position: row.position || 0
        });
      }
    }

    // 4. Parse Previous Data
    const previousData = new Map<string, { clicks: number; impressions: number; position: number }>();
    for (const row of previousResponse.data.rows || []) {
      const page = row.keys?.[0];
      if (page) {
        previousData.set(page, {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          position: row.position || 0
        });
      }
    }

    // 5. Calculate Changes
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
          (current.position - previous.position) // Position: negative = besser
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

    return resultMap;

  } catch (error) {
    console.error('Error in getGscDataForPagesWithComparison:', error);
    throw error;
  }
}
