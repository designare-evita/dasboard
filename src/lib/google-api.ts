import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

// --- Authentifizierung ---
// Liest die Anmeldedaten aus der Environment Variable, die Sie in Vercel gespeichert haben.
const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || '{}'),
  scopes: [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/analytics.readonly',
  ],
});

const searchconsole = google.searchconsole({
  version: 'v1',
  auth: auth,
});

const analyticsdata = google.analyticsdata({
  version: 'v1beta',
  auth: auth,
});

// --- Funktionen zum Datenabruf ---

/**
 * Ruft die Top-Suchanfragen der letzten 12 Monate aus der Google Search Console ab.
 * @param siteUrl Die URL der Search Console Property (z.B. 'sc-domain:ihredomain.at')
 */
export async function getSearchConsoleData(siteUrl: string) {
  try {
    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - 1); // 12 Monate zurück

    const response = await searchconsole.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
        dimensions: ['query'],
        rowLimit: 20, // Begrenzt auf die Top 20 Suchanfragen
      },
    });

    return response.data.rows;
  } catch (error) {
    console.error('Fehler beim Abrufen der Search Console Daten:', error);
    throw new Error('Could not fetch Search Console data.');
  }
}

/**
 * Ruft die Anzahl der Nutzer der letzten 12 Monate aus Google Analytics 4 ab.
 * @param propertyId Die ID der GA4 Property (z.B. 'properties/123456789')
 */
export async function getGa4Data(propertyId: string) {
  try {
    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - 1); // 12 Monate zurück

    const response = await analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [
          {
            startDate: startDate.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0],
          },
        ],
        metrics: [
          {
            name: 'totalUsers',
          },
        ],
      },
    });

    return response.data;
  } catch (error) {
    console.error('Fehler beim Abrufen der GA4 Daten:', error);
    throw new Error('Could not fetch GA4 data.');
  }
}
