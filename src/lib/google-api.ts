// src/lib/google-api.ts

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library'; // Expliziter Import für den Typ

// Die Funktion gibt jetzt den korrekten Typ 'GoogleAuth' zurück.
function createAuth(): GoogleAuth {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !serviceAccountKey) {
    throw new Error('Google Service Account credentials are not set in environment variables.');
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: serviceAccountKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
    ],
  });
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
 */
export async function getSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<Pick<DateRangeData, 'clicks' | 'impressions'>> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

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
 */
export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Pick<DateRangeData, 'sessions' | 'totalUsers'>> {
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

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
