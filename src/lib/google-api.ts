// src/lib/google-api.ts

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Erstellt einen OAuth2-Client mit den Anmeldeinformationen des Benutzers
function createAuthenticatedClient(accessToken: string, refreshToken: string): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
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
 * Benötigt jetzt die Tokens des Benutzers.
 */
export async function getSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string,
  tokens: { accessToken: string; refreshToken: string }
): Promise<Pick<DateRangeData, 'clicks' | 'impressions'>> {
  const oauth2Client = createAuthenticatedClient(tokens.accessToken, tokens.refreshToken);
  const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

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
 * Benötigt jetzt die Tokens des Benutzers.
 */
export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string,
  tokens: { accessToken: string; refreshToken: string }
): Promise<Pick<DateRangeData, 'sessions' | 'totalUsers'>> {
  const oauth2Client = createAuthenticatedClient(tokens.accessToken, tokens.refreshToken);
  const analytics = google.analyticsdata({ version: 'v1beta', auth: oauth2Client });

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
