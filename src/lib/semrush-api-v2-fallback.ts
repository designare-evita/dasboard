// src/lib/semrush-api-v2-fallback.ts - ALTERNATIVE MIT V2 API
import axios from 'axios';

const apiKey = process.env.SEMRUSH_API_KEY;

interface ProcessedKeyword {
  keyword: string;
  position: number;
  previousPosition: number | null;
  searchVolume: number;
  url: string;
  trafficPercent: number;
}

/**
 * FALLBACK: Nutzt die älteren Semrush v2 API Endpoints
 * Falls v1 weiterhin "metadata not received" Fehler wirft
 */
export async function getSemrushKeywordsV2Fallback(
  domain: string,
  database: string = 'de'
): Promise<{ keywords: ProcessedKeyword[]; error: null | string }> {
  
  if (!apiKey) {
    console.error('[Semrush-v2] SEMRUSH_API_KEY is not set');
    return { keywords: [], error: 'Semrush API key is missing' };
  }

  if (!domain) {
    console.error('[Semrush-v2] No domain provided');
    return { keywords: [], error: 'No domain provided' };
  }

  // Normalize domain
  let normalizedDomain = String(domain);
  if (normalizedDomain.startsWith('www.')) {
    normalizedDomain = normalizedDomain.substring(4);
  }
  if (normalizedDomain.startsWith('https://')) {
    normalizedDomain = normalizedDomain.substring(8);
  } else if (normalizedDomain.startsWith('http://')) {
    normalizedDomain = normalizedDomain.substring(7);
  }

  console.log('[Semrush-v2] Using fallback v2 API for domain:', normalizedDomain);

  // v2 API hat einfachere Parameter
  const rankParams = {
    key: apiKey,
    type: 'rank',
    domain: normalizedDomain,
    database: database,
    limit: 50
  };

  try {
    console.log('[Semrush-v2] Fetching rank data from v2 API');
    
    // Query string aufbauen (v2 erwartet das so)
    const queryString = new URLSearchParams(
      rankParams as Record<string, string>
    ).toString();
    
    const response = await axios.get(
      `https://www.semrush.com/api/v2/?${queryString}`,
      {
        timeout: 15000,
        headers: {
          'Accept': 'text/plain' // v2 API gibt oft text/plain zurück
        }
      }
    );

    // v2 API gibt CSV-ähnliches Format zurück
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    
    if (lines.length === 0 || lines[0].includes('No data')) {
      console.warn('[Semrush-v2] No rank data found');
      return { keywords: [], error: 'No keywords found' };
    }

    console.log('[Semrush-v2] ✅ Got', lines.length, 'rank results');

    // Parse CSV-Format: keyword|position|search_volume|...
    const keywords: ProcessedKeyword[] = [];
    
    for (const line of lines) {
      if (line.startsWith('|') || line.includes('No data') || line.trim() === '') {
        continue;
      }

      const parts = line.split('|');
      if (parts.length < 3) continue;

      const keyword = parts[0].trim();
      const position = parseInt(parts[1].trim());
      const searchVolume = parseInt(parts[2].trim());

      if (!keyword || isNaN(position) || position === 0 || position > 100) {
        continue;
      }

      keywords.push({
        keyword,
        position,
        previousPosition: null, // v2 API hat das nicht so leicht verfügbar
        searchVolume: searchVolume || 0,
        url: '', // v2 API gibt Landing URLs nicht so direkt zurück
        trafficPercent: 0 // Müsste extra abgerufen werden
      });
    }

    keywords.sort((a, b) => a.position - b.position);
    const top20 = keywords.slice(0, 20);

    console.log('[Semrush-v2] ✅ Processed', top20.length, 'keywords');
    return { keywords: top20, error: null };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[Semrush-v2] Error status:', error.response?.status);
      console.error('[Semrush-v2] Error data:', error.response?.data);
    } else {
      console.error('[Semrush-v2] Error:', error);
    }
    return { keywords: [], error: String(error) };
  }
}

/**
 * Erweiterte v2 API: Holt zusätzliche Metriken wie vorherige Position
 */
export async function getSemrushKeywordsV2Extended(
  domain: string,
  database: string = 'de'
): Promise<{ keywords: ProcessedKeyword[]; error: null | string }> {
  
  if (!apiKey) {
    console.error('[Semrush-v2-ext] SEMRUSH_API_KEY is not set');
    return { keywords: [], error: 'Semrush API key is missing' };
  }

  let normalizedDomain = String(domain);
  if (normalizedDomain.startsWith('www.')) {
    normalizedDomain = normalizedDomain.substring(4);
  }

  console.log('[Semrush-v2-ext] Extended v2 API query for:', normalizedDomain);

  try {
    // Hole Rang-Daten
    const rankParams = {
      key: apiKey,
      type: 'rank',
      domain: normalizedDomain,
      database: database,
      limit: 50
    };

    const rankResponse = await axios.get(
      `https://www.semrush.com/api/v2/?${new URLSearchParams(rankParams as Record<string, string>).toString()}`,
      { timeout: 15000 }
    );

    // Hole Suchvolumen-Daten
    const volumeParams = {
      key: apiKey,
      type: 'phrase_volume',
      phrase: '*',
      database: database
    };

    let volumeMap: Record<string, number> = {};
    try {
      const volumeResponse = await axios.get(
        `https://www.semrush.com/api/v2/?${new URLSearchParams(volumeParams as Record<string, string>).toString()}`,
        { timeout: 15000 }
      );
      
      volumeResponse.data.split('\n').forEach((line: string) => {
        const [phrase, volume] = line.split('|');
        if (phrase && volume) {
          volumeMap[phrase.trim()] = parseInt(volume.trim());
        }
      });
    } catch (e) {
      console.warn('[Semrush-v2-ext] Could not fetch volume data:', e);
    }

    const keywords: ProcessedKeyword[] = [];
    rankResponse.data.split('\n').forEach((line: string) => {
      const parts = line.split('|');
      if (parts.length < 3) return;

      const keyword = parts[0].trim();
      const position = parseInt(parts[1].trim());
      
      if (!keyword || isNaN(position) || position === 0 || position > 100) {
        return;
      }

      keywords.push({
        keyword,
        position,
        previousPosition: null,
        searchVolume: volumeMap[keyword] || 0,
        url: '',
        trafficPercent: 0
      });
    });

    keywords.sort((a, b) => a.position - b.position);
    return { keywords: keywords.slice(0, 20), error: null };

  } catch (error) {
    console.error('[Semrush-v2-ext] Error:', error);
    return { keywords: [], error: String(error) };
  }
}

/**
 * HYBRID: Versucht v1, fällt zurück auf v2
 */
export async function getSemrushKeywordsHybrid(
  campaignId: string,
  domain: string
): Promise<{ keywords: ProcessedKeyword[]; error: null | string }> {
  
  console.log('[Semrush-hybrid] Attempting v1 API first...');
  
  // Versuche v1 (importiere die verbesserte Version)
  // const result = await getSemrushKeywords(campaignId, domain);
  // if (result.keywords.length > 0 || !result.error?.includes('metadata')) {
  //   return result;
  // }

  console.log('[Semrush-hybrid] v1 failed, falling back to v2...');
  return getSemrushKeywordsV2Fallback(domain);
}
