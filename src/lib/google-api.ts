// src/lib/google-api.ts

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

function createAuth(): GoogleAuth {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Wir lesen die Base64-kodierte Variable
  const serviceAccountKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;

  if (!serviceAccountEmail) {
    throw new Error('Umgebungsvariable GOOGLE_SERVICE_ACCOUNT_EMAIL fehlt.');
  }
  if (!serviceAccountKeyBase64) {
    throw new Error('Umgebungsvariable GOOGLE_PRIVATE_KEY_BASE64 fehlt.');
  }

  // Sicherheitsprüfung: Dekodieren des Schlüssels
  let serviceAccountKey: string;
  try {
    serviceAccountKey = Buffer.from(serviceAccountKeyBase64, 'base64').toString('utf-8');
  } catch (e) {
    throw new Error('GOOGLE_PRIVATE_KEY_BASE64 konnte nicht dekodiert werden. Ist es valides Base64?');
  }
  
  // Stellt sicher, dass der dekodierte Schlüssel wie ein echter Schlüssel aussieht
  if (!serviceAccountKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('Der dekodierte Private Key hat ein ungültiges Format.');
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

// Der Rest der Datei bleibt unverändert...
interface DateRangeData {
  clicks?: number;
  impressions?: number;
  sessions?: number;
  totalUsers?: number;
}

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
  } catch (error: unknown) {
    console.error('Detaillierter Fehler von der Search Console API:', JSON.stringify(error, null, 2));
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new Error(`Search Console API-Abfrage fehlgeschlagen: ${errorMessage}`);
  }
}

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
  } catch (error: unknown) {
    console.error('Detaillierter Fehler von der Analytics API:', JSON.stringify(error, null, 2));
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new Error(`Analytics API-Abfrage fehlgeschlagen: ${errorMessage}`);
  }
}
