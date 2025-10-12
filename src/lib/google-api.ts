// src/lib/google-api.ts

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

function createAuth(): JWT {
  // Option 1: Komplettes JSON in GOOGLE_CREDENTIALS (falls vorhanden)
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    return new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/analytics.readonly',
      ],
    });
  }
  
  // Option 2: Separate Environment Variables (deine aktuelle Konfiguration)
  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  
  if (!privateKeyBase64 || !clientEmail) {
    throw new Error('Google API Credentials fehlen. Setze entweder GOOGLE_CREDENTIALS oder GOOGLE_PRIVATE_KEY_BASE64 + GOOGLE_SERVICE_ACCOUNT_EMAIL');
  }
  
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
}

interface DailyDataPoint { 
  date: string; 
  value: number; 
}

interface DateRangeData {
  total: number;
  daily: DailyDataPoint[];
}

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
        dimensions: ['date']
      },
    });

    const rows = response.data.rows || [];
    
    // Sicherer Zugriff auf Datenpunkte
    const clicksDaily = rows.map(row => ({ 
      date: row.keys?.[0] ?? '', 
      value: row.clicks || 0 
    })).filter(d => d.date);
    
    const impressionsDaily = rows.map(row => ({ 
      date: row.keys?.[0] ?? '', 
      value: row.impressions || 0 
    })).filter(d => d.date);

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
  } catch (error: unknown) {
    console.error('Detaillierter Fehler beim Abrufen der Search Console Daten:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter API-Fehler';
    throw new Error(`Fehler bei Google Search Console API: ${errorMessage}`);
  }
}

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
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      },
    });

    const rows = response.data.rows || [];

    // Sicherer Zugriff auf Datenpunkte
    const sessionsDaily = rows.map(row => ({ 
      date: row.dimensionValues?.[0]?.value?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') ?? '',
      value: parseInt(row.metricValues?.[0]?.value || '0', 10) 
    })).filter(d => d.date);
    
    const usersDaily = rows.map(row => ({ 
      date: row.dimensionValues?.[0]?.value?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') ?? '',
      value: parseInt(row.metricValues?.[1]?.value || '0', 10) 
    })).filter(d => d.date);

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
  } catch (error: unknown) {
    console.error('Detaillierter Fehler beim Abrufen der Analytics Daten:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter API-Fehler';
    throw new Error(`Fehler bei Google Analytics API: ${errorMessage}`);
  }
}
