// src/lib/semrush-api-v2-only.ts
// FORCE V2 API - Umgeht v1 komplett

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
 * 🚀 FORCE V2 API - Keine v1 Versuche, direkt v2
 */
export async function getSemrushKeywordsV2Only(
  domain: string,
  database: string = 'de'
): Promise<{ keywords: ProcessedKeyword[]; error: null | string }> {
  
  if (!apiKey) {
    console.error('[Semrush-v2-only] SEMRUSH_API_KEY not set');
    return { keywords: [], error: 'Semrush API key is missing' };
  }

  if (!domain) {
    console.error('[Semrush-v2-only] No domain provided');
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

  console.log('[Semrush-v2-only] Fetching from v2 API for domain:', normalizedDomain);

  const rankParams: Record<string, string> = {
    key: apiKey,
    type: 'rank',
    domain: normalizedDomain,
    database: database,
    limit: '50'
  };

  try {
    console.log('[Semrush-v2-only] Making API request...');
    
    const queryString = new URLSearchParams(rankParams).toString();
    const url = `https://www.semrush.com/api/v2/?${queryString}`;
    
    console.log('[Semrush-v2-only] URL:', url.substring(0, 100) + '...');
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'Accept': 'text/plain'
      }
    });

    console.log('[Semrush-v2-only] Response status:', response.status);
    
    const lines = response.data.split('\n').filter((line: string) => line.trim());
    
    if (lines.length === 0 || lines[0].includes('No data')) {
      console.log('[Semrush-v2-only] ⚠️ No data returned');
      return { keywords: [], error: 'No keywords found' };
    }

    console.log('[Semrush-v2-only] ✅ Got', lines.length, 'lines');

    const keywords: ProcessedKeyword[] = [];
    
    for (const line of lines) {
      if (line.startsWith('|') || line.includes('No data') || line.trim() === '') {
        continue;
      }

      const parts = line.split('|');
      if (parts.length < 3) continue;

      const keyword = parts[0].trim();
      const position = parseInt(parts[1].trim(), 10);
      const searchVolume = parseInt(parts[2].trim(), 10);

      if (!keyword || isNaN(position) || position === 0 || position > 100) {
        continue;
      }

      keywords.push({
        keyword,
        position,
        previousPosition: null,
        searchVolume: searchVolume || 0,
        url: '',
        trafficPercent: 0
      });
    }

    keywords.sort((a, b) => a.position - b.position);
    const top20 = keywords.slice(0, 20);

    console.log('[Semrush-v2-only] ✅ SUCCESS! Processed', top20.length, 'keywords');
    return { keywords: top20, error: null };

  } catch (error: unknown) {
    console.error('[Semrush-v2-only] ❌ Error:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('[Semrush-v2-only] Status:', error.response?.status);
      console.error('[Semrush-v2-only] Data:', error.response?.data);
      return { keywords: [], error: String(error.response?.data) };
    }
    
    return { keywords: [], error: String(error) };
  }
}
