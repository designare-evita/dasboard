// src/lib/bing-api.ts
import axios from 'axios';
import { BingDataPoint } from '@/lib/dashboard-shared';

// Bing Webmaster API Endpoints
const BING_API_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

export interface BingKeywordData {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  ctr?: number;
}

export async function getBingData(siteUrl: string): Promise<BingKeywordData[]> {
  const apiKey = process.env.BING_API_KEY;

  if (!apiKey) {
    console.warn('[BING] API Key fehlt in Environment Variables');
    return [];
  }

  try {
    // Bing mag keine Trailing Slashes
    const cleanUrl = siteUrl.replace(/\/$/, "");
    
    console.log('[BING] Fetching data for:', cleanUrl);

    // GetQueryStats gibt Keyword-Daten zurück
    const response = await axios.get(`${BING_API_BASE}/GetQueryStats`, {
      params: {
        apikey: apiKey,
        siteUrl: cleanUrl,
      },
      timeout: 10000 // 10s Timeout
    });
    
    console.log('[BING] Response status:', response.status);
    console.log('[BING] Response data:', JSON.stringify(response.data).substring(0, 500));

    // API Antwort transformieren
    if (response.data && response.data.d) {
      const keywords: BingKeywordData[] = response.data.d.map((entry: any) => ({
        query: entry.Query || entry.query || '',
        impressions: entry.Impressions || entry.impressions || 0,
        clicks: entry.Clicks || entry.clicks || 0,
        position: entry.AvgImpressionPosition || entry.Position || entry.position || 0,
      }));
      
      console.log(`[BING] ${keywords.length} Keywords geladen`);
      return keywords;
    }
    
    // Alternative Response-Struktur prüfen
    if (Array.isArray(response.data)) {
      const keywords: BingKeywordData[] = response.data.map((entry: any) => ({
        query: entry.Query || entry.query || '',
        impressions: entry.Impressions || entry.impressions || 0,
        clicks: entry.Clicks || entry.clicks || 0,
        position: entry.AvgImpressionPosition || entry.Position || entry.position || 0,
      }));
      
      console.log(`[BING] ${keywords.length} Keywords geladen (Array Format)`);
      return keywords;
    }

    console.warn('[BING] Unerwartetes Response-Format:', response.data);
    return [];

  } catch (error: any) {
    if (error.response) {
      console.error('[BING] API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('[BING] No response received:', error.message);
    } else {
      console.error('[BING] Request Error:', error.message);
    }
    return [];
  }
}

// Alternative: Traffic Stats (falls GetQueryStats nicht funktioniert)
export async function getBingTrafficStats(siteUrl: string): Promise<BingDataPoint[]> {
  const apiKey = process.env.BING_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const cleanUrl = siteUrl.replace(/\/$/, "");
    
    const response = await axios.get(`${BING_API_BASE}/GetRankAndTrafficStats`, {
      params: {
        apikey: apiKey,
        siteUrl: cleanUrl,
      },
      timeout: 10000
    });
    
    if (response.data && response.data.d) {
      return response.data.d.map((entry: any) => ({
        date: entry.Date,
        clicks: entry.Clicks || 0,
        impressions: entry.Impressions || 0
      }));
    }
    
    return [];
  } catch (error: any) {
    console.warn('[BING Traffic] Fehler:', error.message);
    return [];
  }
}
