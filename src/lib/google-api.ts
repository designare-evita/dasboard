// src/lib/google-api.ts

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ChartEntry } from '@/lib/dashboard-shared'; // Import für ChartEntry

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
          'https://www.googleapis.com/auth/spreadsheets.readonly' // Falls benötigt
        ],
      });
    } catch (e) {
      console.error('Fehler beim Parsen der GOOGLE_CREDENTIALS:', e);
      throw new Error('Google Credentials invalid');
    }
  }
  throw new Error('GOOGLE_CREDENTIALS not set');
}

// --- Helper ---

function parseGscDate(dateString: string): number {
  return new Date(dateString).getTime();
}

function parseGa4Date(dateString: string): number {
  // GA4 liefert YYYYMMDD
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
    
    // Sortieren nach Datum aufsteigend für Charts
    rows.sort((a, b) => (a.keys?.[0] || '').localeCompare(b.keys?.[0] || ''));

    const clicksDaily: DailyDataPoint[] = [];
    const impressionsDaily: DailyDataPoint[] = [];
    let totalClicks = 0;
    let totalImpressions = 0;

    for (const row of rows) {
      const dateStr = row.keys?.[0]; // YYYY-MM-DD
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
        rowLimit: 20, // Top 20 Queries
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

// Hilfsfunktion für Landingpages (verwendet in CronJob)
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

  // Funktion für interne Abfrage
  const queryGscDataForPages = async (url: string, start: string, end: string, pages: string[]) => {
    try {
      const res = await searchconsole.searchanalytics.query({
        siteUrl: url,
        requestBody: {
          startDate: start,
          endDate: end,
          dimensions: ['page'],
          dimensionFilterGroups: [{
            filters: [{
              dimension: 'page',
              operator: 'equals', // Wir holen exact matches via Loop Filter oder hier 'contains'? 
              // GSC API 'equals' filtert auf genaue URL. 'contains' kann zu viele Ergebnisse liefern.
              // Besser: Abfrage OHNE Filter für alle Pages und wir filtern im Memory,
              // ODER wenn die Liste klein ist, iterieren.
              // Hier für Performance bei vielen Pages: Abfrage aller Pages (rowLimit hoch) und filtern.
              expression: '/', // Hol alles
            }]
          }],
          rowLimit: 25000 
        }
      });
      
      // Map bauen
      const map = new Map<string, { clicks: number; impressions: number; position: number }>();
      const rows = res.data.rows || [];
      
      for (const row of rows) {
        const pUrl = row.keys?.[0];
        if (pUrl && pages.includes(pUrl)) {
           map.set(pUrl, { 
             clicks: row.clicks || 0, 
             impressions: row.impressions || 0,
             position: row.position || 0
           });
        }
      }
      return map;
    } catch (e) {
      console.warn('GSC Page Query Error', e);
      return new Map();
    }
  };
  
  // Parallele Abfrage für aktuellen und vorherigen Zeitraum
  // Hinweis: Bei SEHR vielen Landingpages könnte der obige Ansatz (alles laden) ineffizient sein.
  // Falls Filter auf bestimmte Pages nötig ist:
  // GSC API erlaubt "operator: equals" und "expression: URL". Aber nur EINE expression pro filter.
  // Man kann Filterschleifen bauen oder batching.
  // Hier nehmen wir an, wir laden die Top Pages der Domain und matchen im Speicher.
  // Um sicherzugehen, dass wir DEINE pages erwischen, fragen wir lieber OHNE Filter ab und hoffen, sie sind in den Top 25k.
  
  // Verbesserter Ansatz: Query ohne expliziten Page-Filter (außer "page" dimension), um Daten für ALLE Seiten zu bekommen
  // und dann lokal zu matchen.
  
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
      posChange = prevPos - currentPos; // Positive Änderung ist gut (kleinere Position) -> hier Positiv = Verbesserung? 
      // Üblich: (Prev - Curr). Bsp: Prev 10, Curr 5 -> 5 Plätze verbessert.
    } else if (currentPos > 0 && prevPos === 0) {
      posChange = 0; // Neu im Ranking
    } else if (currentPos === 0 && prevPos > 0) {
      posChange = 0; // Verloren
    }
    
    // Runden
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

// Typ für die erweiterten Daten
export type Ga4ExtendedData = {
  // Basics
  sessions: DateRangeData;
  totalUsers: DateRangeData;
  newUsers: DateRangeData;
  
  // Engagement
  bounceRate: DateRangeData;
  engagementRate: DateRangeData;
  avgEngagementTime: DateRangeData;
  
  // Conversions
  conversions: DateRangeData;
  
  // Clicks/Impressions (nur Placeholder, da GA4 diese nicht liefert, sondern GSC)
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
          { name: 'userEngagementDuration' }, // Summe in Sekunden
          { name: 'conversions' }
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
    });

    const rows = response.data.rows || [];
    
    // Daten-Arrays initialisieren
    const sessionsDaily: DailyDataPoint[] = [];
    const usersDaily: DailyDataPoint[] = [];
    const newUsersDaily: DailyDataPoint[] = [];
    const bounceRateDaily: DailyDataPoint[] = [];
    const engagementRateDaily: DailyDataPoint[] = [];
    const avgTimeDaily: DailyDataPoint[] = [];
    const conversionsDaily: DailyDataPoint[] = [];

    // Totals
    let totalSessions = 0;
    let totalUsers = 0;
    let totalNewUsers = 0;
    let totalConversions = 0;
    // Für Rates: Wir berechnen den gewichteten Durchschnitt über die Totals am Ende nicht aus Tagessummen
    // Aber die API liefert auch Totals in row count? Nein, response.data.totals
    
    // API liefert Totals meist in response.data.totals oder maximums.
    // Wir summieren hier manuell oder nutzen die Totals der API.
    // Bei Raten (BounceRate) dürfen wir NICHT summieren.
    
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
    let sumBounceWeighted = 0; // BounceRate * Sessions
    let sumEngRateWeighted = 0; // EngRate * Sessions

    for (const row of rows) {
      const dateStr = row.dimensionValues?.[0]?.value; // YYYYMMDD
      if (!dateStr) continue;
      const dateTs = parseGa4Date(dateStr);

      const sess = parseInt(row.metricValues?.[idxSessions]?.value || '0', 10);
      const usrs = parseInt(row.metricValues?.[idxUsers]?.value || '0', 10);
      const newU = parseInt(row.metricValues?.[idxNewUsers]?.value || '0', 10);
      const bounce = parseFloat(row.metricValues?.[idxBounce]?.value || '0');
      const engRate = parseFloat(row.metricValues?.[idxEngRate]?.value || '0');
      const dur = parseFloat(row.metricValues?.[idxDuration]?.value || '0');
      const conv = parseInt(row.metricValues?.[idxConv]?.value || '0', 10);

      // Daily Arrays
      sessionsDaily.push({ date: dateTs, value: sess });
      usersDaily.push({ date: dateTs, value: usrs });
      newUsersDaily.push({ date: dateTs, value: newU });
      bounceRateDaily.push({ date: dateTs, value: bounce });
      engagementRateDaily.push({ date: dateTs, value: engRate });
      
      // Avg Time Daily = Duration / ActiveUsers (oder Sessions? GA4 Standard ist meist per User oder Session)
      // userEngagementDuration ist die Gesamtsumme. 
      // Average Engagement Time = userEngagementDuration / activeUsers. 
      // Hier vereinfacht / Sessions oder wir nehmen den Wert direkt wenn wir avg hätten.
      // Wir speichern hier die Duration pro Session für den Daily Chart? 
      // Üblich im Chart: Durchschnitt. 
      const avgTimeDay = sess > 0 ? (dur / sess) : 0; // Annäherung
      avgTimeDaily.push({ date: dateTs, value: avgTimeDay });
      
      conversionsDaily.push({ date: dateTs, value: conv });

      // Totals Accumulation
      totalSessions += sess;
      totalUsers += usrs; // Achtung: User summieren ist statistisch falsch (Unique Users), aber ohne separate Query schwer. 
      // Besser: Wir nehmen die Totals aus dem API Response Header, wenn verfügbar.
      // GA4 API property 'totals' in RunReportResponse liefert Aggregate.
      
      totalNewUsers += newU;
      totalConversions += conv;
      
      sumDuration += dur;
      // Rates gewichten für Durchschnitt
      // BounceRate ist sessionsbasiert? Nein, GA4 BounceRate ist (1 - EngagementRate).
      // EngagementRate = EngagedSessions / Sessions.
      // Wir haben engaged sessions nicht direkt hier, aber wir können die API Totals nutzen.
    }

    // Totals aus API Response holen (Genauer für User Metrics)
    const totalsRow = response.data.totals?.[0];
    
    if (totalsRow) {
      totalSessions = parseInt(totalsRow.metricValues?.[idxSessions]?.value || '0', 10);
      totalUsers = parseInt(totalsRow.metricValues?.[idxUsers]?.value || '0', 10);
      totalNewUsers = parseInt(totalsRow.metricValues?.[idxNewUsers]?.value || '0', 10);
      totalConversions = parseInt(totalsRow.metricValues?.[idxConv]?.value || '0', 10);
      
      const totalBounce = parseFloat(totalsRow.metricValues?.[idxBounce]?.value || '0');
      const totalEngRate = parseFloat(totalsRow.metricValues?.[idxEngRate]?.value || '0');
      const totalDuration = parseFloat(totalsRow.metricValues?.[idxDuration]?.value || '0'); // Summe Sekunden
      
      // Avg Engagement Time = Total Duration / Total Active Users (oft näherungsweise Total Users)
      // GA4 UI berechnet: User Engagement Duration / Active Users.
      const avgEngagementTimeVal = totalUsers > 0 ? (totalDuration / totalUsers) : 0;

      return {
        sessions: { total: totalSessions, daily: sessionsDaily },
        totalUsers: { total: totalUsers, daily: usersDaily },
        newUsers: { total: totalNewUsers, daily: newUsersDaily },
        conversions: { total: totalConversions, daily: conversionsDaily },
        bounceRate: { total: totalBounce, daily: bounceRateDaily },
        engagementRate: { total: totalEngRate, daily: engagementRateDaily },
        avgEngagementTime: { total: avgEngagementTimeVal, daily: avgTimeDaily },
        
        // Placeholders für Typ-Sicherheit
        clicks: { total: 0, daily: [] },
        impressions: { total: 0, daily: [] }
      };
    }
    
    // Fallback falls keine Totals (selten)
    const fallbackAvgTime = totalUsers > 0 ? (sumDuration / totalUsers) : 0;
    
    return {
      sessions: { total: totalSessions, daily: sessionsDaily },
      totalUsers: { total: totalUsers, daily: usersDaily },
      newUsers: { total: totalNewUsers, daily: newUsersDaily },
      conversions: { total: totalConversions, daily: conversionsDaily },
      bounceRate: { total: 0, daily: bounceRateDaily }, // Fallback 0
      engagementRate: { total: 0, daily: engagementRateDaily },
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
          { name: 'sessionSource' }, // Quelle
          { name: 'sessionMedium' }, // Medium (um referral zu prüfen)
          { name: 'date' }           // Datum für Trend
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

    // Bekannte AI Patterns
    const aiPatterns = [
      /chatgpt/i, /openai/i, /bing/i, /copilot/i, /gemini/i, /bard/i, 
      /claude/i, /anthropic/i, /perplexity/i, /ai_search/i
    ];

    for (const row of rows) {
      const source = row.dimensionValues?.[0]?.value || '';
      // const medium = row.dimensionValues?.[1]?.value || '';
      const dateStr = row.dimensionValues?.[2]?.value; // YYYYMMDD
      
      const sess = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const usrs = parseInt(row.metricValues?.[1]?.value || '0', 10);

      // Check if source is AI
      const isAi = aiPatterns.some(pattern => pattern.test(source));

      if (isAi) {
        totalAiSessions += sess;
        totalAiUsers += usrs;

        // Source Stats
        if (!sourceStats[source]) {
          sourceStats[source] = { sessions: 0, users: 0 };
        }
        sourceStats[source].sessions += sess;
        sourceStats[source].users += usrs;

        // Trend
        if (dateStr) {
          const dateTs = parseGa4Date(dateStr);
          dailyTrend[dateTs] = (dailyTrend[dateTs] || 0) + sess;
        }
      }
    }

    // Top Sources sortieren
    const topAiSources = Object.entries(sourceStats)
      .map(([source, stats]) => ({
        source,
        sessions: stats.sessions,
        users: stats.users,
        percentage: totalAiSessions > 0 ? (stats.sessions / totalAiSessions) * 100 : 0
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    // Trend Array
    const trend = Object.entries(dailyTrend)
      .map(([date, sessions]) => ({
        date: parseInt(date, 10),
        sessions
      }))
      .sort((a, b) => a.date - b.date);

    return {
      totalSessions: totalAiSessions,
      totalUsers: totalAiUsers,
      sessionsBySource: {}, // Deprecated, use topAiSources
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

// ✅ HIER ANGEPASST: Holt jetzt auch Conversions und mappt Labels
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
        // Wir holen Sessions, EngagementRate UND Conversions
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
        // ✅ Interaktionsrate
        subValue: `${(rate * 100).toFixed(1)}%`,
        subLabel: 'Interaktionsrate',
        // ✅ Conversions (subValue2)
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

// ✅ NEUE FUNKTION: Google Sheets Daten abrufen
export async function getGoogleSheetData(sheetId: string): Promise<any[]> {
  const auth = createAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:Z1000', // Liest die ersten 1000 Zeilen
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Konvertiere Array-of-Arrays in Array-of-Objects
    const headers = rows[0].map((header: string) => header.toLowerCase().trim());
    const data = rows.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      row.forEach((cell: string, index: number) => {
        if (headers[index]) {
          obj[headers[index]] = cell; // Keine .trim() hier, um Datenintegrität zu wahren (trim passiert später)
        }
      });
      return obj;
    });

    return data;

  } catch (error) {
    console.error('Google Sheets API Error:', error);
    throw new Error('Fehler beim Laden des Google Sheets. Ist das Sheet für den Service-Account freigegeben?');
  }
}
}
Das Problem ist, dass die Funktion `getGoogleSheetData` in deiner `src/lib/google-api.ts` Datei fehlt, aber in der Route `src/app/api/users/[id]/landingpages/route.ts` importiert wird.

Hier ist der **vollständige, korrigierte Code** für `src/lib/google-api.ts`. Ich habe die fehlende Funktion `getGoogleSheetData` ganz am Ende hinzugefügt.

Kopiere diesen gesamten Code in deine Datei `src/lib/google-api.ts`:

```typescript
// src/lib/google-api.ts

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ChartEntry } from '@/lib/dashboard-shared'; // Import für ChartEntry

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
          '[https://www.googleapis.com/auth/webmasters.readonly](https://www.googleapis.com/auth/webmasters.readonly)',
          '[https://www.googleapis.com/auth/analytics.readonly](https://www.googleapis.com/auth/analytics.readonly)',
          '[https://www.googleapis.com/auth/spreadsheets.readonly](https://www.googleapis.com/auth/spreadsheets.readonly)' // Falls benötigt
        ],
      });
    } catch (e) {
      console.error('Fehler beim Parsen der GOOGLE_CREDENTIALS:', e);
      throw new Error('Google Credentials invalid');
    }
  }
  throw new Error('GOOGLE_CREDENTIALS not set');
}

// --- Helper ---

function parseGscDate(dateString: string): number {
  return new Date(dateString).getTime();
}

function parseGa4Date(dateString: string): number {
  // GA4 liefert YYYYMMDD
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
    
    // Sortieren nach Datum aufsteigend für Charts
    rows.sort((a, b) => (a.keys?.[0] || '').localeCompare(b.keys?.[0] || ''));

    const clicksDaily: DailyDataPoint[] = [];
    const impressionsDaily: DailyDataPoint[] = [];
    let totalClicks = 0;
    let totalImpressions = 0;

    for (const row of rows) {
      const dateStr = row.keys?.[0]; // YYYY-MM-DD
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
        rowLimit: 20, // Top 20 Queries
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

// Hilfsfunktion für Landingpages (verwendet in CronJob)
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

  // Funktion für interne Abfrage
  const queryGscDataForPages = async (url: string, start: string, end: string, pages: string[]) => {
    try {
      const res = await searchconsole.searchanalytics.query({
        siteUrl: url,
        requestBody: {
          startDate: start,
          endDate: end,
          dimensions: ['page'],
          dimensionFilterGroups: [{
            filters: [{
              dimension: 'page',
              operator: 'equals', // Wir holen exact matches via Loop Filter oder hier 'contains'? 
              // GSC API 'equals' filtert auf genaue URL. 'contains' kann zu viele Ergebnisse liefern.
              // Besser: Abfrage OHNE Filter für alle Pages und wir filtern im Memory,
              // ODER wenn die Liste klein ist, iterieren.
              // Hier für Performance bei vielen Pages: Abfrage aller Pages (rowLimit hoch) und filtern.
              expression: '/', // Hol alles
            }]
          }],
          rowLimit: 25000 
        }
      });
      
      // Map bauen
      const map = new Map<string, { clicks: number; impressions: number; position: number }>();
      const rows = res.data.rows || [];
      
      for (const row of rows) {
        const pUrl = row.keys?.[0];
        if (pUrl && pages.includes(pUrl)) {
           map.set(pUrl, { 
             clicks: row.clicks || 0, 
             impressions: row.impressions || 0,
             position: row.position || 0
           });
        }
      }
      return map;
    } catch (e) {
      console.warn('GSC Page Query Error', e);
      return new Map();
    }
  };
  
  // Parallele Abfrage für aktuellen und vorherigen Zeitraum
  // Hinweis: Bei SEHR vielen Landingpages könnte der obige Ansatz (alles laden) ineffizient sein.
  // Falls Filter auf bestimmte Pages nötig ist:
  // GSC API erlaubt "operator: equals" und "expression: URL". Aber nur EINE expression pro filter.
  // Man kann Filterschleifen bauen oder batching.
  // Hier nehmen wir an, wir laden die Top Pages der Domain und matchen im Speicher.
  // Um sicherzugehen, dass wir DEINE pages erwischen, fragen wir lieber OHNE Filter ab und hoffen, sie sind in den Top 25k.
  
  // Verbesserter Ansatz: Query ohne expliziten Page-Filter (außer "page" dimension), um Daten für ALLE Seiten zu bekommen
  // und dann lokal zu matchen.
  
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
      posChange = prevPos - currentPos; // Positive Änderung ist gut (kleinere Position) -> hier Positiv = Verbesserung? 
      // Üblich: (Prev - Curr). Bsp: Prev 10, Curr 5 -> 5 Plätze verbessert.
    } else if (currentPos > 0 && prevPos === 0) {
      posChange = 0; // Neu im Ranking
    } else if (currentPos === 0 && prevPos > 0) {
      posChange = 0; // Verloren
    }
    
    // Runden
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

// Typ für die erweiterten Daten
export type Ga4ExtendedData = {
  // Basics
  sessions: DateRangeData;
  totalUsers: DateRangeData;
  newUsers: DateRangeData;
  
  // Engagement
  bounceRate: DateRangeData;
  engagementRate: DateRangeData;
  avgEngagementTime: DateRangeData;
  
  // Conversions
  conversions: DateRangeData;
  
  // Clicks/Impressions (nur Placeholder, da GA4 diese nicht liefert, sondern GSC)
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
          { name: 'userEngagementDuration' }, // Summe in Sekunden
          { name: 'conversions' }
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
    });

    const rows = response.data.rows || [];
    
    // Daten-Arrays initialisieren
    const sessionsDaily: DailyDataPoint[] = [];
    const usersDaily: DailyDataPoint[] = [];
    const newUsersDaily: DailyDataPoint[] = [];
    const bounceRateDaily: DailyDataPoint[] = [];
    const engagementRateDaily: DailyDataPoint[] = [];
    const avgTimeDaily: DailyDataPoint[] = [];
    const conversionsDaily: DailyDataPoint[] = [];

    // Totals
    let totalSessions = 0;
    let totalUsers = 0;
    let totalNewUsers = 0;
    let totalConversions = 0;
    // Für Rates: Wir berechnen den gewichteten Durchschnitt über die Totals am Ende nicht aus Tagessummen
    // Aber die API liefert auch Totals in row count? Nein, response.data.totals
    
    // API liefert Totals meist in response.data.totals oder maximums.
    // Wir summieren hier manuell oder nutzen die Totals der API.
    // Bei Raten (BounceRate) dürfen wir NICHT summieren.
    
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
    let sumBounceWeighted = 0; // BounceRate * Sessions
    let sumEngRateWeighted = 0; // EngRate * Sessions

    for (const row of rows) {
      const dateStr = row.dimensionValues?.[0]?.value; // YYYYMMDD
      if (!dateStr) continue;
      const dateTs = parseGa4Date(dateStr);

      const sess = parseInt(row.metricValues?.[idxSessions]?.value || '0', 10);
      const usrs = parseInt(row.metricValues?.[idxUsers]?.value || '0', 10);
      const newU = parseInt(row.metricValues?.[idxNewUsers]?.value || '0', 10);
      const bounce = parseFloat(row.metricValues?.[idxBounce]?.value || '0');
      const engRate = parseFloat(row.metricValues?.[idxEngRate]?.value || '0');
      const dur = parseFloat(row.metricValues?.[idxDuration]?.value || '0');
      const conv = parseInt(row.metricValues?.[idxConv]?.value || '0', 10);

      // Daily Arrays
      sessionsDaily.push({ date: dateTs, value: sess });
      usersDaily.push({ date: dateTs, value: usrs });
      newUsersDaily.push({ date: dateTs, value: newU });
      bounceRateDaily.push({ date: dateTs, value: bounce });
      engagementRateDaily.push({ date: dateTs, value: engRate });
      
      // Avg Time Daily = Duration / ActiveUsers (oder Sessions? GA4 Standard ist meist per User oder Session)
      // userEngagementDuration ist die Gesamtsumme. 
      // Average Engagement Time = userEngagementDuration / activeUsers. 
      // Hier vereinfacht / Sessions oder wir nehmen den Wert direkt wenn wir avg hätten.
      // Wir speichern hier die Duration pro Session für den Daily Chart? 
      // Üblich im Chart: Durchschnitt. 
      const avgTimeDay = sess > 0 ? (dur / sess) : 0; // Annäherung
      avgTimeDaily.push({ date: dateTs, value: avgTimeDay });
      
      conversionsDaily.push({ date: dateTs, value: conv });

      // Totals Accumulation
      totalSessions += sess;
      totalUsers += usrs; // Achtung: User summieren ist statistisch falsch (Unique Users), aber ohne separate Query schwer. 
      // Besser: Wir nehmen die Totals aus dem API Response Header, wenn verfügbar.
      // GA4 API property 'totals' in RunReportResponse liefert Aggregate.
      
      totalNewUsers += newU;
      totalConversions += conv;
      
      sumDuration += dur;
      // Rates gewichten für Durchschnitt
      // BounceRate ist sessionsbasiert? Nein, GA4 BounceRate ist (1 - EngagementRate).
      // EngagementRate = EngagedSessions / Sessions.
      // Wir haben engaged sessions nicht direkt hier, aber wir können die API Totals nutzen.
    }

    // Totals aus API Response holen (Genauer für User Metrics)
    const totalsRow = response.data.totals?.[0];
    
    if (totalsRow) {
      totalSessions = parseInt(totalsRow.metricValues?.[idxSessions]?.value || '0', 10);
      totalUsers = parseInt(totalsRow.metricValues?.[idxUsers]?.value || '0', 10);
      totalNewUsers = parseInt(totalsRow.metricValues?.[idxNewUsers]?.value || '0', 10);
      totalConversions = parseInt(totalsRow.metricValues?.[idxConv]?.value || '0', 10);
      
      const totalBounce = parseFloat(totalsRow.metricValues?.[idxBounce]?.value || '0');
      const totalEngRate = parseFloat(totalsRow.metricValues?.[idxEngRate]?.value || '0');
      const totalDuration = parseFloat(totalsRow.metricValues?.[idxDuration]?.value || '0'); // Summe Sekunden
      
      // Avg Engagement Time = Total Duration / Total Active Users (oft näherungsweise Total Users)
      // GA4 UI berechnet: User Engagement Duration / Active Users.
      const avgEngagementTimeVal = totalUsers > 0 ? (totalDuration / totalUsers) : 0;

      return {
        sessions: { total: totalSessions, daily: sessionsDaily },
        totalUsers: { total: totalUsers, daily: usersDaily },
        newUsers: { total: totalNewUsers, daily: newUsersDaily },
        conversions: { total: totalConversions, daily: conversionsDaily },
        bounceRate: { total: totalBounce, daily: bounceRateDaily },
        engagementRate: { total: totalEngRate, daily: engagementRateDaily },
        avgEngagementTime: { total: avgEngagementTimeVal, daily: avgTimeDaily },
        
        // Placeholders für Typ-Sicherheit
        clicks: { total: 0, daily: [] },
        impressions: { total: 0, daily: [] }
      };
    }
    
    // Fallback falls keine Totals (selten)
    const fallbackAvgTime = totalUsers > 0 ? (sumDuration / totalUsers) : 0;
    
    return {
      sessions: { total: totalSessions, daily: sessionsDaily },
      totalUsers: { total: totalUsers, daily: usersDaily },
      newUsers: { total: totalNewUsers, daily: newUsersDaily },
      conversions: { total: totalConversions, daily: conversionsDaily },
      bounceRate: { total: 0, daily: bounceRateDaily }, // Fallback 0
      engagementRate: { total: 0, daily: engagementRateDaily },
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
          { name: 'sessionSource' }, // Quelle
          { name: 'sessionMedium' }, // Medium (um referral zu prüfen)
          { name: 'date' }           // Datum für Trend
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

    // Bekannte AI Patterns
    const aiPatterns = [
      /chatgpt/i, /openai/i, /bing/i, /copilot/i, /gemini/i, /bard/i, 
      /claude/i, /anthropic/i, /perplexity/i, /ai_search/i
    ];

    for (const row of rows) {
      const source = row.dimensionValues?.[0]?.value || '';
      // const medium = row.dimensionValues?.[1]?.value || '';
      const dateStr = row.dimensionValues?.[2]?.value; // YYYYMMDD
      
      const sess = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const usrs = parseInt(row.metricValues?.[1]?.value || '0', 10);

      // Check if source is AI
      const isAi = aiPatterns.some(pattern => pattern.test(source));

      if (isAi) {
        totalAiSessions += sess;
        totalAiUsers += usrs;

        // Source Stats
        if (!sourceStats[source]) {
          sourceStats[source] = { sessions: 0, users: 0 };
        }
        sourceStats[source].sessions += sess;
        sourceStats[source].users += usrs;

        // Trend
        if (dateStr) {
          const dateTs = parseGa4Date(dateStr);
          dailyTrend[dateTs] = (dailyTrend[dateTs] || 0) + sess;
        }
      }
    }

    // Top Sources sortieren
    const topAiSources = Object.entries(sourceStats)
      .map(([source, stats]) => ({
        source,
        sessions: stats.sessions,
        users: stats.users,
        percentage: totalAiSessions > 0 ? (stats.sessions / totalAiSessions) * 100 : 0
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    // Trend Array
    const trend = Object.entries(dailyTrend)
      .map(([date, sessions]) => ({
        date: parseInt(date, 10),
        sessions
      }))
      .sort((a, b) => a.date - b.date);

    return {
      totalSessions: totalAiSessions,
      totalUsers: totalAiUsers,
      sessionsBySource: {}, // Deprecated, use topAiSources
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

// ✅ HIER ANGEPASST: Holt jetzt auch Conversions und mappt Labels
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
        // Wir holen Sessions, EngagementRate UND Conversions
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
        // ✅ Interaktionsrate
        subValue: `${(rate * 100).toFixed(1)}%`,
        subLabel: 'Interaktionsrate',
        // ✅ Conversions (subValue2)
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

// ✅ NEUE FUNKTION: Google Sheets Daten abrufen
export async function getGoogleSheetData(sheetId: string): Promise<any[]> {
  const auth = createAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:Z1000', // Liest die ersten 1000 Zeilen
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Konvertiere Array-of-Arrays in Array-of-Objects
    const headers = rows[0].map((header: string) => header.toLowerCase().trim());
    const data = rows.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      row.forEach((cell: string, index: number) => {
        if (headers[index]) {
          obj[headers[index]] = cell; // Keine .trim() hier, um Datenintegrität zu wahren (trim passiert später)
        }
      });
      return obj;
    });

    return data;

  } catch (error) {
    console.error('Google Sheets API Error:', error);
    throw new Error('Fehler beim Laden des Google Sheets. Ist das Sheet für den Service-Account freigegeben?');
  }
}
