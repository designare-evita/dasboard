// src/lib/semrush-api.ts (ANGEPASST - Nur Keywords aktiv)
import axios from 'axios';

// API-Schlüssel aus der Umgebungsvariable holen
const apiKey = process.env.SEMRUSH_API_KEY;

/**
 * ========================================================================
 * DEAKTIVIERT (Wunsch des Nutzers)
 * Funktion zum Abrufen von Domain-Übersichtsdaten von Semrush (Domain-basiert)
 * ========================================================================
 */
/*
export async function getSemrushDomainOverview(domain: string, database: string = 'de') {
  if (!apiKey) {
    console.error('[Semrush] SEMRUSH_API_KEY is not set in environment variables.');
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'Semrush API key is missing'
    };
  }
  // ... (Rest der Funktion auskommentiert) ...
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'Could not fetch Semrush data',
    };
  }
}
*/

/**
 * ========================================================================
 * DEAKTIVIERT (Wunsch des Nutzers)
 * Funktion zum Abrufen von Project-Daten von Semrush (Project ID-basiert)
 * ========================================================================
 */
/*
export async function getSemrushProjectData(projectId: string) {
  if (!apiKey) {
    console.error('[Semrush] SEMRUSH_API_KEY is not set in environment variables.');
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'Semrush API key is missing'
    };
  }
  // ... (Rest der Funktion auskommentiert) ...
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'Could not fetch Semrush project data',
    };
  }
}
*/

/**
 * ========================================================================
 * DEAKTIVIERT (Wunsch des Nutzers)
 * Intelligente Funktion die automatisch die beste Methode wählt
 * ========================================================================
 */
/*
export async function getSemrushData(params: {
  domain?: string;
  projectId?: string;
  trackingId?: string;
  database?: string;
}) {
  const { domain, projectId, trackingId, database = 'de' } = params;

  console.log('[Semrush] Getting data with params:', { domain, projectId, trackingId, database });

  // NUR Project ID verwenden - kein Fallback!
  if (projectId) {
    console.log('[Semrush] Using Project ID strategy');
    return await getSemrushProjectData(projectId);
  }

  // Keine Project ID = keine Daten
  console.warn('[Semrush] No Project ID configured - Semrush tracking not available');
  return {
    organicKeywords: null,
    organicTraffic: null,
    error: 'No Semrush Project ID configured'
  };
}
*/


// ========================================================================
// TYP-DEFINITIONEN FÜR KEYWORD-FUNKTION (AKTIV)
// ========================================================================

/**
 * Definiert die Struktur der Keyword-Daten wie sie von der Management API
 * im "data"-Objekt zurückgegeben werden
 */
interface SemrushApiKeywordData {
  Pi?: string; // Phrase ID
  Ph?: string; // Phrase (Keyword)
  Kb?: number; // Keyword basis
  Tg?: Record<string, unknown>; // Tags
  In?: Record<string, string>; // Intent
  Cp?: string; // Cost per click
  Nq?: string; // Number of queries
  Gs?: string; // Global search volume
  Dt?: Record<string, Record<string, number | string>>; // Date tracking data (Positionen pro Datum)
  Be?: Record<string, number | string>; // Begin position
  Fi?: Record<string, number | string>; // Final position
  Diff?: Record<string, number>; // Position difference
  Diff1?: Record<string, number>; // 1-day difference
  Diff7?: Record<string, number>; // 7-day difference  
  Diff30?: Record<string, number>; // 30-day difference
  Vi?: Record<string, number | Record<string, number>>; // Visibility
  Sov?: Record<string, number | Record<string, number>>; // Share of voice
  Sf?: Record<string, string[]>; // SERP features
  Tr?: Record<string, number | Record<string, number>>; // Traffic
  Tc?: Record<string, number | Record<string, number>>; // Traffic cost
  Lu?: Record<string, string | Record<string, string>>; // Landing URL
  Lt?: Record<string, string[] | Record<string, string[]>>; // Landing type
}

/**
 * Root-Response-Struktur der Semrush Management API
 */
interface SemrushApiResponse {
  total?: number;
  state?: string;
  limit?: number;
  offset?: number;
  data?: Record<string, SemrushApiKeywordData>;
  status?: number;
  server?: string;
  exec_time?: number;
}

/**
 * Definiert die Struktur unseres bereinigten Keyword-Objekts
 */
interface ProcessedKeyword {
  keyword: string;
  position: number;
  previousPosition: number | null;
  searchVolume: number;
  url: string;
  trafficPercent: number;
}

// ========================================================================
// FINALE KEYWORD-FUNKTION (AKTIV)
// Verwendet Reports API v1 (tracking_position_organic)
// ========================================================================

/**
 * Funktion zum Abrufen von Keywords mit Rankings aus Semrush Position Tracking
 * Verwendet die Semrush Reports API v1
 * @param campaignId Die Semrush Campaign/Tracking ID im Format "projectID_trackingID" (z.B. "12920575_1209408")
 * @param domainOrContext Die zu trackende Domain (z.B. "www.aichelin.at") ODER das gesamte Projekt-Kontext-Objekt
 */
export async function getSemrushKeywords(
  campaignId: string,
  domainOrContext?: string | Record<string, unknown>
) {
  if (!apiKey) {
    console.error('[Semrush] SEMRUSH_API_KEY is not set in environment variables.');
    return {
      keywords: [],
      error: 'Semrush API key is missing'
    };
  }

  if (!campaignId) {
    console.warn('[Semrush] No campaign ID provided for keywords');
    return {
      keywords: [],
      error: 'No campaign ID'
    };
  }

  console.log('[Semrush] Fetching keywords for campaign ID:', campaignId);

  // ✅ KORRIGIERT: Campaign ID splitten in projectId und campaignId
  const parts = campaignId.split('_');
  if (parts.length !== 2) {
    console.error('[Semrush] Campaign ID must be in format "projectId_campaignId"');
    return {
      keywords: [],
      error: 'Invalid campaign ID format'
    };
  }
  
  const projectId = parts[0];
  const trackingCampaignId = parts[1];
  
  // ✅ Domain aus Kontext extrahieren (flexibel)
  let domain = domainOrContext;
  
  // Wenn domainOrContext ein Objekt ist (z.B. User/Project-Kontext), Domain daraus auslesen
  if (typeof domainOrContext === 'object' && domainOrContext !== null) {
    const obj = domainOrContext as Record<string, unknown>;
    domain = (obj.domain || obj.Domain || obj.url) as string;
  }
  
  // Fallback auf 'aichelin.at' wenn keine Domain vorhanden
  if (!domain) {
    console.warn('[Semrush] No domain provided, using fallback');
    domain = 'aichelin.at';
  }
  
  // ✅ Domain normalisieren
  let normalizedDomain = String(domain);
  // Entferne www. wenn vorhanden
  if (normalizedDomain.startsWith('www.')) {
    normalizedDomain = normalizedDomain.substring(4);
  }
  // Entferne https://, http:// wenn vorhanden
  if (normalizedDomain.startsWith('https://')) {
    normalizedDomain = normalizedDomain.substring(8);
  } else if (normalizedDomain.startsWith('http://')) {
    normalizedDomain = normalizedDomain.substring(7);
  }
  
  // Bilde die Semrush URL-Mask: *.domain.com/*
  const urlMask = `*.${normalizedDomain}/*`;
  
  console.log('[Semrush] DEBUG - Project ID:', projectId);
  console.log('[Semrush] DEBUG - Tracking Campaign ID:', trackingCampaignId);
  console.log('[Semrush] DEBUG - Domain:', normalizedDomain);
  console.log('[Semrush] DEBUG - URL Mask:', urlMask);
  
  // ✅ WICHTIG: Der Endpoint verwendet PROJECT ID in der URL
  const url = `https://api.semrush.com/reports/v1/projects/${projectId}/tracking/`;
  
  // 1. Parameter – VEREINFACHT, nur die notwendigen Parameter
  const params = {
    key: apiKey,
    type: 'tracking_position_organic',
    action: 'report',
    url: urlMask, // ✅ ERFORDERLICH! Die Domain-Mask
    display_limit: '50'
  };

  // 2. Die 'fullUrl'-Logik wird nicht mehr benötigt

  try {
    // DEBUG: Zeige die exakte URL und Parameter
    console.log('[Semrush] DEBUG - Base URL:', url);
    console.log('[Semrush] DEBUG - Raw Params object:', params);
    
    // Baue die komplette URL vor dem Request
    const urlParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      urlParams.set(key, String(value));
    }
    const fullUrlDebug = `${url}?${urlParams.toString()}`;
    console.log('[Semrush] DEBUG - FULL REQUEST URL:', fullUrlDebug);
    
    // 3. Mache den API Request
    const response = await axios.get<SemrushApiResponse>(url, {
      params: params,
      timeout: 15000, 
      headers: {
        'Accept': 'application/json'
      }
    });
    const data = response.data;

    // Validiere Response-Struktur
    if (!data || typeof data !== 'object') {
      console.warn('[Semrush] Invalid response format');
      return {
        keywords: [],
        error: 'Invalid response format'
      };
    }

    // Prüfe ob Daten vorhanden sind
    if (!data.data || typeof data.data !== 'object' || Object.keys(data.data).length === 0) {
      console.warn('[Semrush] No keywords returned for campaign ID:', campaignId);
      return {
        keywords: [],
        error: 'No keywords found'
      };
    }

    console.log('[Semrush] ✅ Received', Object.keys(data.data).length, 'keywords from API');

    // Parse und transformiere die Daten
    const keywords: ProcessedKeyword[] = [];

    // Hole das aktuelle Datum im Format YYYYMMDD
    const today = new Date();
    const dateKey = today.toISOString().slice(0, 10).replace(/-/g, ''); // z.B. "20251031"

    // Iteriere über alle Keywords im data-Objekt
    for (const [index, keywordData] of Object.entries(data.data)) {
      
      const keyword = keywordData.Ph || ''; // Ph = Phrase (Keyword)
      
      if (!keyword) {
        console.warn('[Semrush] Skipping keyword without phrase at index:', index);
        continue;
      }

      // Extrahiere aktuelle Position
      // Fi enthält die finale/aktuelle Position pro URL
      // Format: { "*.domain.at/*": 19 }
      let currentPosition = 0;
      if (keywordData.Fi && typeof keywordData.Fi === 'object') {
        const positions = Object.values(keywordData.Fi);
        if (positions.length > 0 && typeof positions[0] === 'number') {
          currentPosition = positions[0];
        } else if (positions.length > 0 && typeof positions[0] === 'string') {
          // Manche Positionen könnten als String "-" zurückkommen
          const posStr = positions[0];
          if (posStr !== '-') {
            currentPosition = parseFloat(posStr);
          }
        }
      }

      // Extrahiere vorherige Position
      // Be enthält die Begin-Position (oft die Position vor 30 Tagen)
      let previousPosition: number | null = null;
      if (keywordData.Be && typeof keywordData.Be === 'object') {
        const positions = Object.values(keywordData.Be);
        if (positions.length > 0 && typeof positions[0] === 'number') {
          previousPosition = positions[0];
        } else if (positions.length > 0 && typeof positions[0] === 'string') {
          const posStr = positions[0];
          if (posStr !== '-') {
            previousPosition = parseFloat(posStr);
          }
        }
      }

      // Extrahiere Suchvolumen
      // Nq = Number of queries (Suchvolumen)
      const searchVolume = keywordData.Nq ? parseInt(keywordData.Nq) : 0;

      // Extrahiere Landing URL
      // Lu enthält die Landing-URLs pro Datum
      let url = '';
      if (keywordData.Lu && typeof keywordData.Lu === 'object') {
        // Versuche URL vom aktuellen Datum zu holen
        const urls = keywordData.Lu as Record<string, string | Record<string, string>>;
        if (dateKey && urls[dateKey]) {
          const dateUrls = urls[dateKey];
          if (typeof dateUrls === 'object') {
            const urlValues = Object.values(dateUrls);
            if (urlValues.length > 0) {
              url = urlValues[0];
            }
          } else if (typeof dateUrls === 'string') {
            url = dateUrls;
          }
        }
        // Fallback: Nimm die erste verfügbare URL
        if (!url) {
          for (const value of Object.values(urls)) {
            if (typeof value === 'object') {
              const urlValues = Object.values(value);
              if (urlValues.length > 0) {
                url = urlValues[0];
                break;
              }
            } else if (typeof value === 'string') {
              url = value;
              break;
            }
          }
        }
      }

      // Extrahiere Traffic Percent
      // Tr enthält den Traffic-Anteil
      let trafficPercent = 0;
      if (keywordData.Tr && typeof keywordData.Tr === 'object') {
        const traffic = keywordData.Tr as Record<string, number | Record<string, number>>;
        // Versuche Traffic vom aktuellen Datum zu holen
        if (dateKey && traffic[dateKey]) {
          const dateTraffic = traffic[dateKey];
          if (typeof dateTraffic === 'object') {
            const trafficValues = Object.values(dateTraffic);
            if (trafficValues.length > 0) {
              trafficPercent = trafficValues[0] * 100; // Konvertiere zu Prozent
            }
          } else if (typeof dateTraffic === 'number') {
            trafficPercent = dateTraffic * 100;
          }
        }
        // Fallback: Nimm den ersten verfügbaren Traffic-Wert
        if (trafficPercent === 0) {
          for (const value of Object.values(traffic)) {
            if (typeof value === 'object') {
              const trafficValues = Object.values(value);
              if (trafficValues.length > 0 && typeof trafficValues[0] === 'number') {
                trafficPercent = trafficValues[0] * 100;
                break;
              }
            } else if (typeof value === 'number') {
              trafficPercent = value * 100;
              break;
            }
          }
        }
      }

      // Filtere ungültige Positionen aus (0, "-", etc.)
      if (currentPosition === 0 || isNaN(currentPosition) || currentPosition > 100) {
        console.log('[Semrush] Skipping keyword with invalid position:', keyword, currentPosition);
        continue;
      }

      keywords.push({
        keyword,
        position: currentPosition,
        previousPosition,
        searchVolume,
        url,
        trafficPercent
      });
    }

    // Sortiere nach Position (beste zuerst)
    keywords.sort((a, b) => a.position - b.position);

    // Limitiere auf Top 20
    const top20Keywords = keywords.slice(0, 20);

    console.log('[Semrush] ✅ Successfully processed', top20Keywords.length, 'keywords for campaign ID:', campaignId);

    return {
      keywords: top20Keywords,
      error: null
    };

  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(`[Semrush] Axios error fetching keywords for campaign ID ${campaignId}:`, error.message);
      if (error.response) {
        console.error('[Semrush] Response status:', error.response.status);
        console.error('[Semrush] Response data:', JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.error(`[Semrush] Error fetching keywords:`, error);
    }
    
    return {
      keywords: [],
      error: 'Could not fetch Semrush keywords',
    };
  }
}
