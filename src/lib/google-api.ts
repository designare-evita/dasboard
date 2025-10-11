// src/lib/google-api.ts

import { google } from 'googleapis';

// Erstellt einen authentifizierten Client mit dem Service Account
function getAuthenticatedClient() {
  // Diese Umgebungsvariablen musst du in Vercel setzen.
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !serviceAccountKey) {
    throw new Error('Google Service Account credentials are not set in environment variables.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: serviceAccountKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
    ],
  });

  return auth.getClient();
}

// Definiert eine Struktur für die zurückgegebenen Daten
interface DateRangeData {
  clicks?: number;
  impressions?: number;
  sessions?: number;
  totalUsers?: number;
}

/**
 * Holt Klicks und Impressionen von der Google Search Console.
 * Benötigt keine Benutzer-Tokens mehr.
 */
export async function getSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<Pick<DateRangeData, 'clicks' | 'impressions'>> {
  const authClient = await getAuthenticatedClient();
  const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: { startDate, endDate, dimensions: [] },
    });

    const rows = response.data.rows;
    return {
      clicks: rows?.[0]?.clicks ?? 0,
      impressions: rows?.[0]?.impressions ?? 0,
    };
  } catch (error) {
    console.error('Fehler bei der Abfrage der Search Console API:', error);
    throw new Error('Search Console API-Abfrage fehlgeschlagen.');
  }
}

/**
 * Holt Sitzungen und Nutzer von der Google Analytics 4 API.
 * Benötigt keine Benutzer-Tokens mehr.
 */
export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Pick<DateRangeData, 'sessions' | 'totalUsers'>> {
  const authClient = await getAuthenticatedClient();
  const analytics = google.analyticsdata({ version: 'v1beta', auth: authClient });

  try {
    const response = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      },
    });

    const rows = response.data.rows;
    return {
      sessions: parseInt(rows?.[0]?.metricValues?.[0]?.value ?? '0', 10),
      totalUsers: parseInt(rows?.[0]?.metricValues?.[1]?.value ?? '0', 10),
    };
  } catch (error) {
    console.error('Fehler bei der Abfrage der Analytics API:', error);
    throw new Error('Analytics API-Abfrage fehlgeschlagen.');
  }
}
