// src/lib/google-api.ts

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Erstelle einen wiederverwendbaren OAuth2-Client
function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Stellt sicher, dass das Token aktuell ist
async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const oauth2Client = createOAuth2Client();
  // Annahme: Du speicherst das Refresh-Token sicher
  // In einer echten App würde dies aus der Datenbank für den jeweiligen Benutzer kommen.
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN, 
  });
  
  // Token aktualisieren, falls nötig
  await oauth2Client.refreshAccessToken();
  
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
 * Holt Klicks und Impressionen von der Google Search Console für einen bestimmten Zeitraum.
 */
export async function getSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<Pick<DateRangeData, 'clicks' | 'impressions'>> {
  const oauth2Client = await getAuthenticatedClient();
  const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: [], // Keine Dimensionen, wir wollen nur die Gesamtwerte
      },
    });

    const rows = response.data.rows;
    if (!rows || rows.length === 0) {
      return { clicks: 0, impressions: 0 };
    }
    
    // In der GSC-API sind die Werte in der ersten (und einzigen) Zeile
    return {
      clicks: rows[0].clicks ?? 0,
      impressions: rows[0].impressions ?? 0,
    };
  } catch (error) {
    console.error('Fehler bei der Abfrage der Search Console API:', error);
    // Gib einen Fallback-Wert zurück, damit die App nicht abstürzt
    return { clicks: 0, impressions: 0 };
  }
}

/**
 * Holt Sitzungen und Nutzer von der Google Analytics 4 API für einen bestimmten Zeitraum.
 */
export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Pick<DateRangeData, 'sessions' | 'totalUsers'>> {
  const oauth2Client = await getAuthenticatedClient();
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
    if (!rows || rows.length === 0) {
      return { sessions: 0, totalUsers: 0 };
    }

    // Die Werte stehen in der ersten Zeile, aufgeteilt auf die Metriken
    return {
      sessions: parseInt(rows[0].metricValues?.[0]?.value ?? '0', 10),
      totalUsers: parseInt(rows[0].metricValues?.[1]?.value ?? '0', 10),
    };
  } catch (error) {
    console.error('Fehler bei der Abfrage der Analytics API:', error);
    return { sessions: 0, totalUsers: 0 };
  }
}
