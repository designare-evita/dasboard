// src/lib/semrush-api.ts (KORRIGIERT - Version 10.0)
import axios from 'axios';

// Basis-URL für die Semrush API
const SEMRUSH_API_URL = 'https://api.semrush.com/';

// Neue Position Tracking API URL
const SEMRUSH_POSITION_TRACKING_API = 'https://api.semrush.com/reports/v1/projects/';

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

  } catch (error) {
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

  } catch (error) {
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
// 🔥 KORRIGIERTE FUNKTION - Position Tracking API V1
// ========================================================================

/**
 * Funktion zum Abrufen von Keywords mit Rankings aus Semrush Position Tracking
 * KORRIGIERT: Verwendet die Projects Position Tracking API V1
 * 
 * @param trackingId Die Semrush Position Tracking Campaign ID (z.B. "1209491")
 * 
 * API-Dokumentation:
 * https://developer.semrush.com/api/v3/projects/position-tracking/
 * 
 * Endpunkt-Struktur:
 * GET https://api.semrush.com/reports/v1/projects/{project_id}/tracking/
 *     ?key={api_key}
 *     &action=report
 *     &type=tracking_position_organic
 *     &url=*.domain.com/*
 *     &display_limit=20
 */
export async function getSemrushKeywords(trackingId: string) {
  if (!apiKey) {
    console.error('[Semrush] SEMRUSH_API_KEY is not set in environment variables.');
    return {
      keywords: [],
      error: 'Semrush API key is missing'
    };
  }

  if (!trackingId) {
    console.warn('[Semrush] No tracking ID provided for keywords');
    return {
      keywords: [],
      error: 'No tracking ID'
    };
  }

  console.log('[Semrush] Fetching keywords for tracking/campaign ID:', trackingId);

  // ✅ KORRIGIERTE URL-STRUKTUR
  // Die Position Tracking API V1 verwendet einen anderen Endpunkt
  const url = `${SEMRUSH_POSITION_TRACKING_API}${trackingId}/tracking/`;
  
  const params = new URLSearchParams({
    key: apiKey,
    action: 'report',
    type: 'tracking_position_organic', // ✅ Korrekter Report-Typ
    url: '*', // Wildcard für alle URLs (kann auch spezifischer sein: *.domain.com/*)
    display_limit: '20', // Top 20 Keywords
    display_sort: 'position_asc' // Sortiert nach Position (beste zuerst)
  });

  const fullUrl = `${url}?${params.toString()}`;
  
  console.log('[Semrush] API URL:', fullUrl);

  try {
    const response = await axios.get(fullUrl, {
      timeout: 15000, // 15 Sekunden Timeout
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('[Semrush] Response status:', response.status);
    console.log('[Semrush] Response data type:', typeof response.data);

    // Die Position Tracking API V1 gibt JSON zurück (nicht CSV)
    const data = response.data;

    if (!data || typeof data !== 'object') {
      console.error('[Semrush] Unexpected response format:', typeof data);
      return {
        keywords: [],
        error: 'Unexpected response format from Semrush'
      };
    }

    // Die Response-Struktur kann variieren, aber typischerweise:
    // { "total": 123, "data": [ { "keyword": "...", "position": 1, ... }, ... ] }
    
    const keywordsData = data.data || data.keywords || [];
    
    if (!Array.isArray(keywordsData)) {
      console.error('[Semrush] Keywords data is not an array:', keywordsData);
      return {
        keywords: [],
        error: 'Invalid keywords data structure'
      };
    }

    if (keywordsData.length === 0) {
      console.warn('[Semrush] No keywords returned for tracking ID:', trackingId);
      return {
        keywords: [],
        error: 'No keywords found'
      };
    }

    // Transformiere die API-Response in unser Format
    const keywords = keywordsData.map((item: any) => {
      return {
        keyword: item.keyword || item.phrase || '',
        position: parseFloat(item.position || item.pos || 0),
        previousPosition: item.prev_position || item.prev_pos ? parseFloat(item.prev_position || item.prev_pos) : null,
        searchVolume: parseInt(item.search_volume || item.volume || 0),
        url: item.url || '',
        trafficPercent: parseFloat(item.traffic || item.traffic_percent || 0)
      };
    }).filter(kw => kw.keyword); // Filtere leere Keywords

    console.log('[Semrush] ✅ Successfully fetched', keywords.length, 'keywords for tracking ID:', trackingId);

    return {
      keywords,
      error: null
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[Semrush] Axios error fetching keywords for tracking ID ${trackingId}:`, error.message);
      if (error.response) {
        console.error('[Semrush] Response status:', error.response.status);
        console.error('[Semrush] Response data:', error.response.data);
        
        // Detaillierte Fehlerbehandlung
        const errorData = error.response.data;
        let errorMessage = 'Could not fetch Semrush keywords';
        
        if (typeof errorData === 'string') {
          if (errorData.includes('not found') || errorData.includes('404')) {
            errorMessage = `Campaign/Project ${trackingId} not found. Please verify the tracking ID.`;
          } else if (errorData.includes('unauthorized') || errorData.includes('401')) {
            errorMessage = 'Invalid API key or unauthorized access';
          } else if (errorData.includes('query type not found') || errorData.includes('400')) {
            errorMessage = 'Invalid API request parameters';
          }
        }
        
        return {
          keywords: [],
          error: errorMessage
        };
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
