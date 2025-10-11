// src/lib/google-api.ts

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

function createAuth(): GoogleAuth { /* ... unverändert ... */ }

// Neue Typ-Definitionen für die Tagesdaten
interface DailyDataPoint { date: string; value: number; }
interface DateRangeData {
  total: number;
  daily: DailyDataPoint[];
}

// Angepasste Funktion für die Search Console
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
        dimensions: ['date'] // WICHTIG: Wir gruppieren nach Datum
      },
    });

    const rows = response.data.rows || [];
    
    const clicksDaily = rows.map(row => ({ date: row.keys![0], value: row.clicks! }));
    const impressionsDaily = rows.map(row => ({ date: row.keys![0], value: row.impressions! }));

    return {
      clicks: {
        total: clicksDaily.reduce((sum, item) => sum + item.value, 0),
        daily: clicksDaily,
      },
      impressions: {
        total: impressionsDaily.reduce((sum, item) => sum + item.value, 0),
        daily: impressionsDaily,
      },
    };
  } catch (error: unknown) { /* ... unverändert ... */ }
}

// Angepasste Funktion für Analytics
export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{ sessions: DateRangeData; totalUsers: DateRangeData }> {
  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    const response = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }], // WICHTIG: Wir gruppieren nach Datum
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      },
    });

    const rows = response.data.rows || [];

    const sessionsDaily = rows.map(row => ({ date: row.dimensionValues![0].value!, value: parseInt(row.metricValues![0].value!, 10) }));
    const usersDaily = rows.map(row => ({ date: row.dimensionValues![0].value!, value: parseInt(row.metricValues![1].value!, 10) }));

    return {
      sessions: {
        total: sessionsDaily.reduce((sum, item) => sum + item.value, 0),
        daily: sessionsDaily,
      },
      totalUsers: {
        total: usersDaily.reduce((sum, item) => sum + item.value, 0),
        daily: usersDaily,
      },
    };
  } catch (error: unknown) { /* ... unverändert ... */ }
}
