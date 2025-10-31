// src/lib/semrush-api.ts (FINALE KORRIGIERTE VERSION - v17)
import axios from 'axios';

// Basis-URL für die Semrush API
const SEMRUSH_API_URL = 'https://api.semrush.com/';

// API-Schlüssel aus der Umgebungsvariable holen
const apiKey = process.env.SEMRUSH_API_KEY;

/**
 * Funktion zum Abrufen von Domain-Übersichtsdaten von Semrush (Domain-basiert)
 * @param domain Die Domain, für die Daten abgerufen werden sollen (z.B. "example.com")
 * @param database Die Semrush-Datenbank (z.B. "de" für Deutschland, "at" für Österreich, "us" für USA)
 */
export async function getSemrushDomainOverview(domain: string, database: string = 'de') {
  if (!apiKey) {
    console.error('[Semrush] SEMRUSH_API_KEY is not set in environment variables.');
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'Semrush API key is missing'
    };
  }

  // Domain bereinigen (ohne https:// oder www.)
  const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

  console.log('[Semrush] Fetching domain data for:', cleanDomain, 'database:', database);

  const params = new URLSearchParams({
    key: apiKey,
    type: 'domain_ranks',
    domain: cleanDomain,
    database: database,
    export_columns: 'Or,Ot', // Or = Organic Keywords, Ot = Organic Traffic
  });

  const url = `${SEMRUSH_API_URL}?${params.toString()}`;

  try {
    const response = await axios.get(url, {
      timeout: 10000 // 10 Sekunden Timeout
    });

    if (typeof response.data !== 'string') {
      throw new Error('Unexpected response format from Semrush');
    }

    const lines = response.data.trim().split('\n');
    
    if (lines.length < 2) {
      console.warn('[Semrush] No data returned for domain:', cleanDomain);
      return {
        organicKeywords: null,
        organicTraffic: null,
        error: 'No data available'
      };
    }

    const values = lines[1].split(';');

    if (values.length < 3) {
      console.warn('[Semrush] Invalid data format:', lines[1]);
      return {
        organicKeywords: null,
        organicTraffic: null,
        error: 'Invalid data format'
      };
    }

    const organicKeywords = parseInt(values[1], 10) || 0;
    const organicTraffic = parseInt(values[2], 10) || 0;

    console.log('[Semrush] ✅ Domain data fetched - Keywords:', organicKeywords, 'Traffic:', organicTraffic);

    return {
      organicKeywords,
      organicTraffic,
    };

  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(`[Semrush] Axios error for ${cleanDomain}:`, error.message);
      if (error.response) {
        console.error('[Semrush] Response status:', error.response.status);
        console.error('[Semrush] Response data:', error.response.data);
      }
    } else {
      console.error(`[Semrush] Error fetching data for ${cleanDomain}:`, error);
    }
    
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'Could not fetch Semrush data',
    };
  }
}

/**
 * Funktion zum Abrufen von Project-Daten von Semrush (Project ID-basiert)
 * Verwendet die Semrush Project API für detailliertere Tracking-Daten
 * @param projectId Die Semrush Project ID
 */
export async function getSemrushProjectData(projectId: string) {
  if (!apiKey) {
    console.error('[Semrush] SEMRUSH_API_KEY is not set in environment variables.');
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'Semrush API key is missing'
    };
  }

  if (!projectId) {
    console.warn('[Semrush] No project ID provided');
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'No project ID'
    };
  }

  console.log('[Semrush] Fetching project data for project ID:', projectId);

  // Semrush Projects API Endpoint
  const params = new URLSearchParams({
    key: apiKey,
    type: 'project_overview',
    project_id: projectId,
    export_columns: 'Or,Ot', // Or = Organic Keywords, Ot = Organic Traffic
  });

  const url = `${SEMRUSH_API_URL}?${params.toString()}`;

  try {
    const response = await axios.get(url, {
      timeout: 10000
    });

    if (typeof response.data !== 'string') {
      throw new Error('Unexpected response format from Semrush');
    }

    const lines = response.data.trim().split('\n');
    
    if (lines.length < 2) {
      console.warn('[Semrush] No project data returned for ID:', projectId);
      return {
        organicKeywords: null,
        organicTraffic: null,
        error: 'No project data available'
      };
    }

    const values = lines[1].split(';');

    if (values.length < 2) {
      console.warn('[Semrush] Invalid project data format');
      return {
        organicKeywords: null,
        organicTraffic: null,
        error: 'Invalid data format'
      };
    }

    const organicKeywords = parseInt(values[0], 10) || 0;
    const organicTraffic = parseInt(values[1], 10) || 0;

    console.log('[Semrush] ✅ Project data fetched - Keywords:', organicKeywords, 'Traffic:', organicTraffic);

    return {
      organicKeywords,
      organicTraffic,
    };

  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(`[Semrush] Axios error for project ${projectId}:`, error.message);
      if (error.response) {
        console.error('[Semrush] Response status:', error.response.status);
        console.error('[Semrush] Response data:', error.response.data);
      }
    } else {
      console.error(`[Semrush] Error fetching project data:`, error);
    }
    
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'Could not fetch Semrush project data',
    };
  }
}

/**
 * Intelligente Funktion die automatisch die beste Methode wählt
 * NUR Project ID - kein Domain-Fallback mehr!
 */
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


// ========================================================================
// TYP-DEFINITIONEN FÜR KEYWORD-FUNKTION
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
// FINALE KEYWORD-FUNKTION (Version 5.0 - Reports API v1)
// ========================================================================

/**
 * Funktion zum Abrufen von Keywords mit Rankings aus Semrush Position Tracking
 * Verwendet die Semrush Reports API v1 (KORRIGIERT)
 * @param campaignId Die Semrush Campaign/Tracking ID im Format "projectID_campaignID" (z.B. "12920575_1209408")
 */
export async function getSemrushKeywords(campaignId: string) {
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

  // ✅ KORRIGIERT: Reports API v1 mit richtigem Endpoint
  // Die Campaign ID sollte im Format "projectID_campaignID" sein
  // Aber unsere Datenbank hat nur die Campaign ID - wir müssen sie kombinieren
  // Laut den Logs: Project ID = 12920575, Tracking ID = 1209408
  
  // Prüfe ob Campaign ID bereits das richtige Format hat (enthält Underscore)
  const fullCampaignId = campaignId.includes('_') ? campaignId : campaignId;
  
  const url = `https://api.semrush.com/reports/v1/projects/${fullCampaignId}/tracking/`;
  
  const params = new URLSearchParams({
    key: apiKey,
    type: 'tracking_position_organic',
    action: 'report',
    display_limit: '50', // Top 50 Keywords
    display_sort: 'po_asc' // Sortiert nach Position (beste zuerst)
  });

  const fullUrl = `${url}?${params.toString()}`;
  
  console.log('[Semrush] API URL:', fullUrl);

  try {
    const response = await axios.get<SemrushApiResponse>(fullUrl, {
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
      console.warn('[Semrush] No keywords returned for campaign ID:', fullCampaignId);
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

    console.log('[Semrush] ✅ Successfully processed', top20Keywords.length, 'keywords for campaign ID:', fullCampaignId);

    return {
      keywords: top20Keywords,
      error: null
    };

  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(`[Semrush] Axios error fetching keywords for campaign ID ${fullCampaignId}:`, error.message);
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
