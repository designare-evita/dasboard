// src/lib/bing-api.ts
import axios from 'axios';

// Bing Webmaster API Endpoints
const BING_API_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

export interface BingKeywordData {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  ctr?: number;
}

export async function getBingData(
  siteUrl: string,
  startDate?: string,
  endDate?: string
): Promise<BingKeywordData[]> {
  const apiKey = process.env.BING_API_KEY;

  if (!apiKey) {
    console.warn('[BING] API Key fehlt in Environment Variables');
    return [];
  }

  try {
    // Bing mag keine Trailing Slashes
    const cleanUrl = siteUrl.replace(/\/$/, "");
    
    console.log('[BING] Fetching data for:', cleanUrl);
    console.log('[BING] Date range:', startDate, '-', endDate);

    // Parameter für die API
    const params: Record<string, string> = {
      apikey: apiKey,
      siteUrl: cleanUrl,
    };

    // Bing GetQueryStats unterstützt diese Parameter (falls vorhanden)
    // Die API verwendet manchmal andere Formate, wir probieren mehrere Varianten
    
    const response = await axios.get(`${BING_API_BASE}/GetQueryStats`, {
      params,
      timeout: 10000
    });
    
    console.log('[BING] Response status:', response.status);

    let keywords: BingKeywordData[] = [];

    // API Antwort transformieren
    if (response.data && response.data.d) {
      keywords = response.data.d.map((entry: any) => ({
        query: entry.Query || entry.query || '',
        impressions: entry.Impressions || entry.impressions || 0,
        clicks: entry.Clicks || entry.clicks || 0,
        position: entry.AvgImpressionPosition || entry.Position || entry.position || 0,
      }));
    } else if (Array.isArray(response.data)) {
      keywords = response.data.map((entry: any) => ({
        query: entry.Query || entry.query || '',
        impressions: entry.Impressions || entry.impressions || 0,
        clicks: entry.Clicks || entry.clicks || 0,
        position: entry.AvgImpressionPosition || entry.Position || entry.position || 0,
      }));
    }

    // Wenn wir Datums-Parameter haben, filtern wir client-seitig
    // (Bing API gibt manchmal alle Daten zurück)
    if (startDate && endDate && keywords.length > 0) {
      console.log(`[BING] ${keywords.length} Keywords geladen (vor Filterung)`);
      // Hinweis: GetQueryStats gibt aggregierte Daten zurück, keine täglichen
      // Daher können wir hier nicht nach Datum filtern
      // Die Daten sind bereits für den Standardzeitraum aggregiert
    }

    console.log(`[BING] ${keywords.length} Keywords zurückgegeben`);
    return keywords;

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

// Für tägliche Traffic-Statistiken (mit Datumsfilter)
export async function getBingRankAndTrafficStats(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<BingKeywordData[]> {
  const apiKey = process.env.BING_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const cleanUrl = siteUrl.replace(/\/$/, "");
    
    console.log('[BING Traffic] Fetching for:', cleanUrl, 'from', startDate, 'to', endDate);

    const response = await axios.get(`${BING_API_BASE}/GetRankAndTrafficStats`, {
      params: {
        apikey: apiKey,
        siteUrl: cleanUrl,
      },
      timeout: 10000
    });
    
    if (response.data && response.data.d && Array.isArray(response.data.d)) {
      // Filtern nach Datum
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const filtered = response.data.d.filter((entry: any) => {
        // Bing Datum kann im Format "/Date(timestamp)/" sein
        let entryDate: Date;
        if (typeof entry.Date === 'string' && entry.Date.includes('/Date(')) {
          const timestamp = parseInt(entry.Date.replace(/\/Date\((\d+)\)\//, '$1'));
          entryDate = new Date(timestamp);
        } else {
          entryDate = new Date(entry.Date);
        }
        return entryDate >= start && entryDate <= end;
      });

      return filtered.map((entry: any) => ({
        query: entry.Query || '',
        impressions: entry.Impressions || 0,
        clicks: entry.Clicks || 0,
        position: entry.AvgImpressionPosition || 0,
      }));
    }
    
    return [];
  } catch (error: any) {
    console.warn('[BING Traffic] Fehler:', error.message);
    return [];
  }
}

// Kombinierte Funktion die beide Endpoints versucht
export async function getBingDataWithDateRange(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<BingKeywordData[]> {
  // Zuerst GetQueryStats versuchen (gibt aggregierte Keyword-Daten)
  let data = await getBingData(siteUrl, startDate, endDate);
  
  // Wenn keine Daten, versuche GetRankAndTrafficStats
  if (data.length === 0) {
    console.log('[BING] Fallback zu GetRankAndTrafficStats...');
    data = await getBingRankAndTrafficStats(siteUrl, startDate, endDate);
  }
  
  return data;
}
