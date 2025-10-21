// src/lib/google-api.ts

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Erstellt den Authentifizierungs-Client für die Google APIs
function createAuth(): JWT {
  // Option 1: Komplettes JSON in GOOGLE_CREDENTIALS (falls vorhanden)
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

  // Option 2: Separate Environment Variables (deine aktuelle Konfiguration)
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
     console.error("Fehler beim Erstellen der JWT-Auth aus Umgebungsvariablen:", error);
     throw new Error("Fehler beim Initialisieren der Google API Authentifizierung.");
  }
}

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

// --- API-Funktionen ---

/**
 * Ruft aggregierte Klick- und Impressionsdaten sowie tägliche Daten von der Google Search Console ab.
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
        dimensions: ['date'], // Aggregiert nach Datum
        type: 'web',
        aggregationType: 'byProperty',
      },
    });

    const rows = response.data.rows || [];

    // Verarbeite tägliche Datenpunkte sicher
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
        daily: clicksDaily.sort((a, b) => a.date.localeCompare(b.date)), // Nach Datum sortieren
      },
      impressions: {
        total: totalImpressions,
        daily: impressionsDaily.sort((a, b) => a.date.localeCompare(b.date)), // Nach Datum sortieren
      },
    };
  } catch (error: unknown) {
    console.error('Fehler beim Abrufen der Search Console Daten:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter API-Fehler';
    // Detailliertere Fehlermeldung für Debugging
    console.error("GSC API Request Details:", { siteUrl, startDate, endDate });
    throw new Error(`Fehler bei Google Search Console API: ${errorMessage}`);
  }
}

/**
 * Ruft die Top 5 Suchanfragen (nach Klicks) von der Google Search Console ab.
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
        dimensions: ["query"], // Dimension ist 'query'
        type: "web",
        rowLimit: 100, // Mehr Zeilen abrufen für bessere Auswahl
        dataState: "all",
        aggregationType: "byProperty",
      },
    });

    // Alle abgerufenen Anfragen verarbeiten
    const allQueries = res.data.rows?.map((row) => ({
      query: row.keys?.[0] || "N/A", // Suchanfrage oder "N/A"
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })) || [];

    // Im Code sortieren und die Top 5 auswählen
    return allQueries
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);

  } catch (error: unknown) {
    console.error("Fehler beim Abrufen der Top GSC Queries:", error);
    // Detailliertere Fehlermeldung für Debugging
    console.error("GSC Top Queries API Request Details:", { siteUrl, startDate, endDate });
    // Bei Fehler leeres Array zurückgeben, anstatt den gesamten Prozess abzubrechen
    return [];
  }
}

/**
 * Ruft aggregierte Sitzungs- und Nutzerdaten sowie tägliche Daten von Google Analytics 4 ab.
 */
export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{ sessions: DateRangeData; totalUsers: DateRangeData }> {
  // Stelle sicher, dass "properties/" nicht doppelt vorkommt
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
        dimensions: [{ name: 'date' }], // Dimension ist 'date'
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ // Sortiere nach Datum aufsteigend
          dimension: {
            dimensionName: 'date',
          },
          desc: false, // false = aufsteigend, true = absteigend
        }],
      },
    });

    const rows = response.data.rows || [];

    // Verarbeite tägliche Datenpunkte sicher
    const sessionsDaily: DailyDataPoint[] = [];
    const usersDaily: DailyDataPoint[] = [];
    let totalSessions = 0;
    let totalUsers = 0;

    for (const row of rows) {
       // GA4 Datumsformat: YYYYMMDD -> YYYY-MM-DD
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
        // Die API sollte bereits sortiert zurückgeben, aber zur Sicherheit
        daily: sessionsDaily,
      },
      totalUsers: {
        total: totalUsers,
        daily: usersDaily,
      },
    };
  } catch (error: unknown) {
    console.error('Fehler beim Abrufen der Analytics Daten:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter API-Fehler';
     // Detailliertere Fehlermeldung für Debugging
    console.error("GA4 API Request Details:", { propertyId: formattedPropertyId, startDate, endDate });
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
  try {
    const auth = await getGoogleAuth();
    const analyticsData = google.analyticsdata('v1beta');

    // Bekannte KI-Bot User-Agents und Quellen
    const aiSources = [
      'ChatGPT-User',
      'GPTBot',
      'Claude-Web',
      'Google-Extended',
      'Bingbot',
      'Perplexity',
      'Anthropic-AI',
      'OpenAI'
    ];

    // Filter für KI-Traffic
    const aiFilterExpression = aiSources
      .map(source => `sessionSource=~"${source}"|deviceCategory=~"${source}"`)
      .join('|');

    // Haupt-Query für KI-Traffic
    const response = await analyticsData.properties.runReport({
      auth,
      property: `properties/${propertyId}`,
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
          filter: {
            fieldName: 'sessionSource',
            stringFilter: {
              matchType: 'CONTAINS',
              value: 'bot|Bot|gpt|GPT|claude|Claude|AI|perplexity',
              caseSensitive: false
            }
          }
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
      }
    });

    const rows = response.data.rows || [];
    
    let totalSessions = 0;
    let totalUsers = 0;
    const sessionsBySource: { [key: string]: number } = {};
    const trendMap: { [date: string]: number } = {};

    // Daten aggregieren
    rows.forEach(row => {
      const source = row.dimensionValues?.[0]?.value || 'Unknown';
      const date = row.dimensionValues?.[1]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

      totalSessions += sessions;
      totalUsers += users;

      sessionsBySource[source] = (sessionsBySource[source] || 0) + sessions;
      trendMap[date] = (trendMap[date] || 0) + sessions;
    });

    // Top AI Sources ermitteln
    const topAiSources = Object.entries(sessionsBySource)
      .map(([source, sessions]) => ({
        source,
        sessions,
        users: Math.round(sessions * 0.8), // Schätzung
        percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    // Trend-Daten formatieren
    const trend = Object.entries(trendMap)
      .map(([date, sessions]) => ({
        date: formatDateForChart(date),
        sessions
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSessions,
      totalUsers,
      sessionsBySource,
      topAiSources,
      trend
    };

  } catch (error) {
    console.error('[getAiTrafficData] Fehler:', error);
    // Fallback mit leeren Daten
    return {
      totalSessions: 0,
      totalUsers: 0,
      sessionsBySource: {},
      topAiSources: [],
      trend: []
    };
  }
}

/**
 * Formatiert Datum für Charts (YYYYMMDD -> DD.MM)
 */
function formatDateForChart(dateStr: string): string {
  if (dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}.${month}`;
}
