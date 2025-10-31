// src/lib/semrush-api.ts
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
// KORRIGIERTE FUNKTION (VERSUCH 3)
// ========================================================================

/**
 * Funktion zum Abrufen von Keywords mit Rankings aus Semrush Position Tracking
 * Verwendet die Semrush Projects API (v1) für Position Tracking
 * @param campaignId Die Semrush Campaign ID (z.B. 1209491)
 * @param trackedUrl Optional - Die getrackte URL mit Mask (z.B. "*.aichelin.at/*")
 */
export async function getSemrushKeywords(campaignId: string, trackedUrl?: string) {
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

  // Semrush Projects API für Position Tracking
  const baseUrl = `https://api.semrush.com/reports/v1/projects/${campaignId}/tracking/`;
  
  const params = new URLSearchParams({
    key: apiKey,
    type: 'tracking_position_organic', // Organic Position Tracking Report
    action: 'report',
    display_limit: '20', // Top 20 Keywords
    display_sort: 'po_asc', // Sortiert nach Position (beste zuerst)
  });

  if (trackedUrl) {
    params.append('url', trackedUrl);
  }

  const url = `${baseUrl}?${params.toString()}`;
  
  console.log('[Semrush] API URL:', url);

  try {
    const response = await axios.get(url, {
      timeout: 15000, 
      headers: {
        'Accept': 'application/json'
      }
    });

    // Projects API gibt JSON zurück (nicht CSV)
    // Wir deklarieren 'data' als 'unknown' für eine sichere Typprüfung
    const data: unknown = response.data;

    // Typsichere Prüfung, ob 'data' ein Objekt ist und 'data.data' ein Array enthält
    if (
      typeof data !== 'object' ||
      data === null ||
      !('data' in data) ||
      !Array.isArray((data as { data: unknown }).data) ||
      (data as { data: unknown[] }).data.length === 0
    ) {
      console.warn('[Semrush] No keywords returned or invalid data format for campaign ID:', campaignId);
      return {
        keywords: [],
        error: 'No keywords found'
      };
    }

    // Jetzt wissen wir, dass data.data ein Array ist.
    // Wir casten es für die map-Funktion sicher.
    const rawItems = (data as { data: SemrushApiKeywordItem[] }).data;

    // Parse JSON-Daten von Projects API
    const keywords = rawItems.map((item: SemrushApiKeywordItem): ProcessedKeyword => { // <-- KORREKTUR 1
      return {
        keyword: item.keyword || item.phrase || '',
        // String() sorgt dafür, dass null/undefined nicht zu NaN wird, bevor parseFloat aufgerufen wird
        position: parseFloat(String(item.position)) || 0,
        previousPosition: item.previous_position ? parseFloat(String(item.previous_position)) : null,
        searchVolume: parseInt(String(item.search_volume)) || 0,
        url: item.url || '',
        trafficPercent: parseFloat(String(item.traffic_percent)) || 0
      };
    }).filter((kw: ProcessedKeyword) => kw.keyword); // <-- KORREKTUR 2

    console.log('[Semrush] ✅ Successfully fetched', keywords.length, 'keywords for campaign ID:', campaignId);

    return {
      keywords,
      error: null
    };

  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(`[Semrush] Axios error fetching keywords for campaign ID ${campaignId}:`, error.message);
      if (error.response) {
        console.error('[Semrush] Response status:', error.response.status);
        console.error('[Semrush] Response data:', error.response.data);
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
