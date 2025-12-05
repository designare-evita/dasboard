// src/lib/bing-api.ts
import axios from 'axios';
import { BingDataPoint } from '@/lib/dashboard-shared'; // Pfad anpassen

const BING_API_ENDPOINT = 'https://ssl.bing.com/webmaster/api.svc/json/GetSearchUserStats';

export async function getBingData(siteUrl: string): Promise<BingDataPoint[]> {
  const apiKey = process.env.BING_API_KEY;

  console.log('[BING] API Key vorhanden:', !!apiKey);
  console.log('[BING] Site URL:', siteUrl);

  if (!apiKey) {
    console.warn('[BING] API Key fehlt!');
    return [];
  }

  try {
    // Bing mag keine Trailing Slashes
    const cleanUrl = siteUrl.replace(/\/$/, "");

    // Wir holen die letzten 30 Tage
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    const response = await axios.get(BING_API_ENDPOINT, {
      params: {
        apikey: apiKey,
        siteUrl: cleanUrl,
        startDate: startDate,
        endDate: endDate
      },
      timeout: 5000 // 5s Timeout damit das Dashboard nicht hängt
    });
    
    // API Antwort transformieren
    if (response.data && response.data.d) {
      return response.data.d.map((entry: any) => ({
        date: entry.Date, // Format: "/Date(163...)/" -> muss oft noch geparst werden, oder Bing liefert ISO
        clicks: entry.Clicks,
        impressions: entry.Impressions
      }));
    }
    
    return [];

  } catch (error: any) {
    // Fehler ignorieren (z.B. wenn Seite noch nicht in Bing importiert ist)
    // console.warn(`Bing Warning für ${siteUrl}:`, error.message);
    return [];
  }
}
