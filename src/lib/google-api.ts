// src/lib/google-api.ts

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ChartEntry } from '@/lib/dashboard-shared';

// --- Typdefinitionen ---

interface DailyDataPoint {
  date: number; // ✅ Timestamp
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

// --- Sheet API (Wieder hinzugefügt für Build Fix) ---
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
        dimensions: ['query'],
        rowLimit: 100, 
      },
    });

    const rows = res.data.rows || [];
    return rows.map(row => ({
      query: row.keys?.[0] || '(not set)',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  } catch (error) {
    console.error('GSC TopQueries Error:', error);
    return [];
  }
}

export type GscPageData = {
  clicks: number;
  clicks_prev: number;
  clicks_change: number;
  impressions: number;
  impressions_prev: number;
  impressions_change: number;
  position: number;
  position_change: number;
};

export async function getGscDataForPagesWithComparison(
  siteUrl: string,
  pageUrls: string[],
  currentRange: { startDate: string; endDate: string },
  previousRange: { startDate: string; endDate: string }
): Promise<Map<string, GscPageData>> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const queryAllPages = async (sDate: string, eDate: string) => {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: sDate,
        endDate: eDate,
        dimensions: ['page'],
        rowLimit: 25000
      }
    });
    const map = new Map<string, { clicks: number; impressions: number; position: number }>();
    (res.data.rows || []).forEach(r => {
      if (r.keys?.[0]) map.set(r.keys[0], { clicks: r.clicks || 0, impressions: r.impressions || 0, position: r.position || 0 });
    });
    return map;
  };

  const [currentDataMap, previousDataMap] = await Promise.all([
    queryAllPages(currentRange.startDate, currentRange.endDate),
    queryAllPages(previousRange.startDate, previousRange.endDate)
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
      
      position: currentPos,
      position_change: roundedPosChange
    });
  }

  return resultMap;
}


// --- Google Analytics 4 (GA4) ---

export type Ga4ExtendedData = {
  sessions: DateRangeData;
  totalUsers: DateRangeData;
  newUsers: DateRangeData;
  bounceRate: DateRangeData;
  engagementRate: DateRangeData;
  avgEngagementTime: DateRangeData;
  conversions: DateRangeData;
  clicks: DateRangeData; 
  impressions: DateRangeData;
}

export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4ExtendedData> {
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
          { name: 'newUsers' },
          { name: 'bounceRate' },
          { name: 'engagementRate' },
          { name: 'userEngagementDuration' },
          { name: 'conversions' }
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        // ✅ NEU: Explizit Totals anfordern für korrekte Aggregation
        metricAggregations: ['TOTAL'],
      },
    });

    const rows = response.data.rows || [];
    
    const sessionsDaily: DailyDataPoint[] = [];
    const usersDaily: DailyDataPoint[] = [];
    const newUsersDaily: DailyDataPoint[] = [];
    const bounceRateDaily: DailyDataPoint[] = [];
    const engagementRateDaily: DailyDataPoint[] = [];
    const avgTimeDaily: DailyDataPoint[] = [];
    const conversionsDaily: DailyDataPoint[] = [];

    let totalSessions = 0;
    let totalUsers = 0;
    let totalNewUsers = 0;
    let totalConversions = 0;
    
    // ✅ NEU: Für gewichtete Durchschnittsberechnung als Fallback
    let weightedBounceSum = 0;
    let weightedEngagementSum = 0;
    
    const metricHeaders = response.data.metricHeaders || [];
    const getMetricIndex = (name: string) => metricHeaders.findIndex(h => h.name === name);
    
    const idxSessions = getMetricIndex('sessions');
    const idxUsers = getMetricIndex('totalUsers');
    const idxNewUsers = getMetricIndex('newUsers');
    const idxBounce = getMetricIndex('bounceRate');
    const idxEngRate = getMetricIndex('engagementRate');
    const idxDuration = getMetricIndex('userEngagementDuration');
    const idxConv = getMetricIndex('conversions');

    let sumDuration = 0;

    for (const row of rows) {
      const dateStr = row.dimensionValues?.[0]?.value; 
      if (!dateStr) continue;
      const dateTs = parseGa4Date(dateStr);

      const sess = parseInt(row.metricValues?.[idxSessions]?.value || '0', 10);
      const usrs = parseInt(row.metricValues?.[idxUsers]?.value || '0', 10);
      const newU = parseInt(row.metricValues?.[idxNewUsers]?.value || '0', 10);
      const bounce = parseFloat(row.metricValues?.[idxBounce]?.value || '0');
      const engRate = parseFloat(row.metricValues?.[idxEngRate]?.value || '0');
      const dur = parseFloat(row.metricValues?.[idxDuration]?.value || '0');
      const conv = parseInt(row.metricValues?.[idxConv]?.value || '0', 10);

      sessionsDaily.push({ date: dateTs, value: sess });
      usersDaily.push({ date: dateTs, value: usrs });
      newUsersDaily.push({ date: dateTs, value: newU });
      bounceRateDaily.push({ date: dateTs, value: bounce });
      engagementRateDaily.push({ date: dateTs, value: engRate });
      
      const avgTimeDay = sess > 0 ? (dur / sess) : 0; 
      avgTimeDaily.push({ date: dateTs, value: avgTimeDay });
      
      conversionsDaily.push({ date: dateTs, value: conv });

      totalSessions += sess;
      totalUsers += usrs; 
      totalNewUsers += newU;
      totalConversions += conv;
      sumDuration += dur;
      
      // ✅ NEU: Gewichtete Summen für Raten (gewichtet nach Sessions)
      weightedBounceSum += bounce * sess;
      weightedEngagementSum += engRate * sess;
    }

    const totalsRow = response.data.totals?.[0];
    
    if (totalsRow) {
      totalSessions = parseInt(totalsRow.metricValues?.[idxSessions]?.value || '0', 10);
      totalUsers = parseInt(totalsRow.metricValues?.[idxUsers]?.value || '0', 10);
      totalNewUsers = parseInt(totalsRow.metricValues?.[idxNewUsers]?.value || '0', 10);
      totalConversions = parseInt(totalsRow.metricValues?.[idxConv]?.value || '0', 10);
      
      const totalBounce = parseFloat(totalsRow.metricValues?.[idxBounce]?.value || '0');
      const totalEngRate = parseFloat(totalsRow.metricValues?.[idxEngRate]?.value || '0');
      const totalDuration = parseFloat(totalsRow.metricValues?.[idxDuration]?.value || '0');
      
      const avgEngagementTimeVal = totalUsers > 0 ? (totalDuration / totalUsers) : 0;

      return {
        sessions: { total: totalSessions, daily: sessionsDaily },
        totalUsers: { total: totalUsers, daily: usersDaily },
        newUsers: { total: totalNewUsers, daily: newUsersDaily },
        conversions: { total: totalConversions, daily: conversionsDaily },
        bounceRate: { total: totalBounce, daily: bounceRateDaily },
        engagementRate: { total: totalEngRate, daily: engagementRateDaily },
        avgEngagementTime: { total: avgEngagementTimeVal, daily: avgTimeDaily },
        clicks: { total: 0, daily: [] },
        impressions: { total: 0, daily: [] }
      };
    }
    
    const fallbackAvgTime = totalUsers > 0 ? (sumDuration / totalUsers) : 0;
    
    // ✅ FIX: Berechne gewichtete Durchschnitte für Raten
    const calculatedBounceRate = totalSessions > 0 
      ? weightedBounceSum / totalSessions 
      : 0;
    
    const calculatedEngagementRate = totalSessions > 0 
      ? weightedEngagementSum / totalSessions 
      : 0;

    console.log('[GA4] Calculated totals (fallback):', { 
      sessions: totalSessions, 
      bounceRate: calculatedBounceRate, 
      engagementRate: calculatedEngagementRate 
    });
    
    return {
      sessions: { total: totalSessions, daily: sessionsDaily },
      totalUsers: { total: totalUsers, daily: usersDaily },
      newUsers: { total: totalNewUsers, daily: newUsersDaily },
      conversions: { total: totalConversions, daily: conversionsDaily },
      // ✅ FIX: Gewichtete Durchschnitte statt 0
      bounceRate: { total: calculatedBounceRate, daily: bounceRateDaily }, 
      engagementRate: { total: calculatedEngagementRate, daily: engagementRateDaily },
      avgEngagementTime: { total: fallbackAvgTime, daily: avgTimeDaily },
      clicks: { total: 0, daily: [] },
      impressions: { total: 0, daily: [] }
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
        // ✅ Metrics: Sessions, EngagementRate, Conversions
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
        // ✅ Label Interaktionsrate
        subValue: `${(rate * 100).toFixed(1)}%`,
        subLabel: 'Interaktionsrate',
        // ✅ Value Conversions
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
  conversionRate: string; // String für "1.5%"
}

// ✅ NEUE FUNKTION
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
        // Wir sortieren primär nach Conversions, aber wir holen trotzdem alles
        orderBys: [
          { metric: { metricName: 'conversions' }, desc: true },
          { metric: { metricName: 'sessions' }, desc: true } // Fallback: Traffic
        ],
        limit: '100', // Wir holen mehr, um nach Filterung genug zu haben
      },
    });

    const rows = response.data.rows || [];

    return rows.map(row => {
      const conversions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const sessions = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const engagementRate = parseFloat(row.metricValues?.[2]?.value || '0'); // ✅ NEU: Auslesen
      const newUsers = parseInt(row.metricValues?.[3]?.value || '0', 10); // ✅ NEU

      // Conversion Rate berechnen
      const convRate = sessions > 0 ? ((conversions / sessions) * 100).toFixed(2) : '0';

      return {
        path: row.dimensionValues?.[0]?.value || '(not set)',
        conversions,
        sessions,
        newUsers, // ✅ NEU
        conversionRate: convRate, // Achtung: Hier ggf. Typ anpassen in Interface, wir senden hier String, Loader macht Number draus
        engagementRate: parseFloat((engagementRate * 100).toFixed(2)) // ✅ NEU: Als saubere Prozentzahl (z.B. 55.5)
      };
    })
    // ✅ FILTER GEÄNDERT: Wir lassen auch Seiten durch, die viel Traffic haben (>5 Sessions), 
    // auch wenn sie keine Conversions haben. So sehen wir "Engagement-Gewinner".
    .filter(p => p.conversions > 0 || p.sessions > 5)
    .slice(0, 50); // ✅ Top 50

  } catch (error) {
    console.error('Error fetching Top Converting Pages:', error);
    return [];
  }
}
