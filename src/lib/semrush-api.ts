// src/lib/semrush-api.ts (FINALE KORREKTUR DER URL)
import axios from 'axios';

const apiKey = process.env.SEMRUSH_API_KEY;

// (Interfaces bleiben gleich)
interface SemrushApiKeywordData {
  Ph?: string;
  Fi?: Record<string, number | string>;
  Be?: Record<string, number | string>;
  Nq?: string;
  Lu?: Record<string, string | Record<string, string>>;
  Tr?: Record<string, number | Record<string, number>>;
}
interface SemrushApiResponse {
  data?: Record<string, SemrushApiKeywordData>;
}
interface ProcessedKeyword {
  keyword: string;
  position: number;
  previousPosition: number | null;
  searchVolume: number;
  url: string;
  trafficPercent: number;
}


export async function getSemrushKeywords(
  campaignId: string,
  domainOrContext?: string | Record<string, unknown>
) {
  if (!apiKey) {
    console.error('[Semrush] SEMRUSH_API_KEY is not set');
    return { keywords: [], error: 'Semrush API key is not set' };
  }

  if (!campaignId || !campaignId.includes('_')) {
    console.warn('[Semrush] Invalid campaign ID provided, expected projectID_trackingID');
    return { keywords: [], error: 'Invalid campaign ID format' };
  }

  console.log('[Semrush] Fetching keywords for campaign ID:', campaignId);
  
  // HINWEIS: campaignId IST BEREITS "projectID_trackingID"
  // Wir müssen sie NICHT mehr in parts zerlegen

  let domain = domainOrContext;

  // (Domain-Extraktion bleibt gleich)
  if (typeof domainOrContext === 'object' && domainOrContext !== null) {
    const obj = domainOrContext as Record<string, unknown>;
    domain = (obj.domain || obj.Domain || obj.url) as string;
  }
  if (!domain) {
    console.warn('[Semrush] No domain provided, request will likely fail');
    domain = 'example.com'; 
  }

  // (Domain-Normalisierung bleibt gleich)
  let normalizedDomain = String(domain);
  if (normalizedDomain.startsWith('www.')) {
    normalizedDomain = normalizedDomain.substring(4);
  }
  if (normalizedDomain.startsWith('https://')) {
    normalizedDomain = normalizedDomain.substring(8);
  } else if (normalizedDomain.startsWith('http://')) {
    normalizedDomain = normalizedDomain.substring(7);
  }

  // KORREKTUR: Die URL MUSS die *gesamte* campaignId enthalten
  const url = `https://api.semrush.com/reports/v1/projects/${campaignId}/tracking/`;

  // KORREKTUR: 'tracking_id' wird aus allen Strategien ENTFERNT
  const strategies = [
    {
      name: 'Strategy 1: Mit subdomain wildcard und /',
      params: {
        key: apiKey,
        type: 'tracking_position_organic',
        action: 'report',
        // tracking_id: trackingId, // ENTFERNT
        url: `*.${normalizedDomain}/*`,
        display_limit: '50'
      }
    },
    {
      name: 'Strategy 2: Mit einfacher Domain',
      params: {
        key: apiKey,
        type: 'tracking_position_organic',
        action: 'report',
        // tracking_id: trackingId, // ENTFERNT
        url: normalizedDomain,
        display_limit: '50'
      }
    },
    {
      name: 'Strategy 3: Mit www prefix',
      params: {
        key: apiKey,
        type: 'tracking_position_organic',
        action: 'report',
        // tracking_id: trackingId, // ENTFERNT
        url: `www.${normalizedDomain}`,
        display_limit: '50'
      }
    },
    {
      name: 'Strategy 4: Mit domain_name statt url (Alternative)',
      params: {
        key: apiKey,
        type: 'tracking_position_organic',
        action: 'report',
        // tracking_id: trackingId, // ENTFERNT
        domain_name: normalizedDomain,
        display_limit: '50'
      }
    },
    {
      name: 'Strategy 5: Mit report_type',
      params: {
        key: apiKey,
        type: 'tracking_position_organic',
        action: 'report',
        // tracking_id: trackingId, // ENTFERNT
        url: normalizedDomain,
        report_type: 'organic_keywords',
        display_limit: '50'
      }
    }
  ];

  console.log('[Semrush] Testing strategies for domain:', normalizedDomain);
  console.log('[Semrush] Using Correct API URL Endpoint:', url);

  let lastError: string | null = null;

  for (let attemptIndex = 0; attemptIndex < strategies.length; attemptIndex++) {
    const strategy = strategies[attemptIndex];
    console.log(`\n[Semrush] ===== ${strategy.name} =====`);

    try {
      // (Debug URL bleibt gleich)
      const urlParams = new URLSearchParams();
      for (const [key, value] of Object.entries(strategy.params)) {
        urlParams.set(key, String(value));
      }
      const debugUrl = `${url}?${urlParams.toString()}`;
      console.log('[Semrush] Full URL:', debugUrl.substring(0, 150) + '...');

      // (Axios-Request bleibt gleich)
      const response = await axios.get<SemrushApiResponse>(url, {
        params: strategy.params,
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Semrush Keyword Tracker)'
        }
      });

      const data = response.data;

      if (!data?.data || typeof data.data !== 'object' || Object.keys(data.data).length === 0) {
        console.warn('[Semrush] Strategy', attemptIndex + 1, '- No keywords returned');
        lastError = 'No keywords found';
        continue;
      }

      console.log('[Semrush] ✅ SUCCESS! Strategy', attemptIndex + 1, 'works! Got', Object.keys(data.data).length, 'keywords');

      // (Keyword-Verarbeitung bleibt gleich)
      const keywords: ProcessedKeyword[] = [];
      const today = new Date();
      const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');

      for (const keywordData of Object.values(data.data)) {
        const keyword = keywordData.Ph || '';
        if (!keyword) continue;

        let currentPosition = 0;
        if (keywordData.Fi && typeof keywordData.Fi === 'object') {
          const positions = Object.values(keywordData.Fi);
          if (positions.length > 0) {
            const pos = positions[0];
            currentPosition = typeof pos === 'number' ? pos : (pos !== '-' ? parseFloat(String(pos)) : 0);
          }
        }
        if (currentPosition === 0 || isNaN(currentPosition) || currentPosition > 100) continue;

        let previousPosition: number | null = null;
        if (keywordData.Be && typeof keywordData.Be === 'object') {
          const positions = Object.values(keywordData.Be);
          if (positions.length > 0) {
            const pos = positions[0];
            previousPosition = typeof pos === 'number' ? pos : (pos !== '-' ? parseFloat(String(pos)) : null);
          }
        }

        const searchVolume = keywordData.Nq ? parseInt(keywordData.Nq) : 0;

        let landingUrl = '';
        if (keywordData.Lu && typeof keywordData.Lu === 'object') {
          const urls = keywordData.Lu as Record<string, string | Record<string, string>>;
          if (dateKey && urls[dateKey]) {
            const dateUrls = urls[dateKey];
            const urlValues = typeof dateUrls === 'object' ? Object.values(dateUrls) : [dateUrls];
            if (urlValues.length > 0) landingUrl = String(urlValues[0]);
          } else {
            for (const value of Object.values(urls)) {
              const urlValues = typeof value === 'object' ? Object.values(value) : [value];
              if (urlValues.length > 0) {
                landingUrl = String(urlValues[0]);
                break;
              }
            }
          }
        }

        let trafficPercent = 0;
        if (keywordData.Tr && typeof keywordData.Tr === 'object') {
          const traffic = keywordData.Tr as Record<string, number | Record<string, number>>;
          if (dateKey && traffic[dateKey]) {
            const dateTraffic = traffic[dateKey];
            const trafficValues = typeof dateTraffic === 'object' ? Object.values(dateTraffic) : [dateTraffic];
            if (trafficValues.length > 0 && typeof trafficValues[0] === 'number') {
              trafficPercent = trafficValues[0] * 100;
            }
          } else {
            for (const value of Object.values(traffic)) {
              const trafficValues = typeof value === 'object' ? Object.values(value) : [value];
              if (trafficValues.length > 0 && typeof trafficValues[0] === 'number') {
                trafficPercent = trafficValues[0] * 100;
                break;
              }
            }
          }
        }

        keywords.push({
          keyword,
          position: currentPosition,
          previousPosition,
          searchVolume,
          url: landingUrl,
          trafficPercent
        });
      }

      keywords.sort((a, b) => a.position - b.position);
      const top20 = keywords.slice(0, 20);

      console.log('[Semrush] ✅ Processed', top20.length, 'keywords');
      return { keywords: top20, error: null };

    } catch (error: unknown) {
      // (Fehlerbehandlung bleibt gleich)
      if (axios.isAxiosError(error)) {
        console.error('[Semrush] Strategy', attemptIndex + 1, '- Status:', error.response?.status);
        if (error.response?.data) {
          const errorData = error.response.data as Record<string, unknown>;
          console.error('[Semrush] Error Data:', JSON.stringify(errorData));
          lastError = (errorData.error as string) || JSON.stringify(errorData);
        } else if (error.message) {
          console.error('[Semrush] Error Message:', error.message);
          lastError = error.message;
        }
      } else {
        console.error('[Semrush] Strategy', attemptIndex + 1, '- Error:', error);
        lastError = String(error);
      }
    }
  }

  console.error('[Semrush] ❌ All strategies failed!');
  return { keywords: [], error: `Could not fetch Semrush keywords. Last error: ${lastError}` };
}
