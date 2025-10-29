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
// KORRIGIERTE FUNKTION
// ========================================================================

/**
 * Funktion zum Abrufen von Keywords mit Rankings aus Semrush Position Tracking
 * @param trackingId Die Semrush Position Tracking ID (z.B. 1209491 aus der 'users' Tabelle)
 */
export async function getSemrushKeywords(trackingId: string) {
  if (!apiKey) {
    console.error('[Semrush] SEMRUSH_API_KEY is not set in environment variables.');
    return {
      keywords: [],
      error: 'Semrush API key is missing'
    };
  }

  // KORREKTUR: Prüft auf trackingId statt projectId
  if (!trackingId) {
    console.warn('[Semrush] No tracking ID provided for keywords');
    return {
      keywords: [],
      error: 'No tracking ID'
    };
  }

  // KORREKTUR: Loggt die trackingId
  console.log('[Semrush] Fetching keywords for tracking ID:', trackingId);

  // Semrush Position Tracking Keywords API
  // Dokumentation: https://developer.semrush.com/api/v3/analytics/keyword-reports/
  const params = new URLSearchParams({
    key: apiKey,
    
    // KORREKTUR: Der Typ 'project_tracking_keywords' war FALSCH und verursachte Fehler 400.
    // 'tracking_report' ist der korrekte Typ für den Position Tracking Report.
    type: 'tracking_report', 
    
    // KORREKTUR: Der API-Parameter heißt 'project_id', erwartet aber bei type='tracking_report'
    // die Tracking ID (z.B. 1209491), nicht die Projekt ID (z.B. 12920575).
    project_id: trackingId, 

    export_columns: 'Ph,Po,Pp,Nq,Ur,Tr',
    // Ph = Keyword (phrase)
    // Po = Position
    // Pp = Previous Position
    // Nq = Search Volume
    // Ur = URL
    // Tr = Traffic %
    display_limit: '20', // Top 20 Keywords
    display_sort: 'po_asc' // Sortiert nach Position (beste zuerst)
  });

  const url = `${SEMRUSH_API_URL}?${params.toString()}`;

  try {
    const response = await axios.get(url, {
      timeout: 15000 // 15 Sekunden Timeout für Keywords
    });

    if (typeof response.data !== 'string') {
      throw new Error('Unexpected response format from Semrush');
    }

    const lines = response.data.trim().split('\n');
    
    if (lines.length < 2) {
      // KORREKTUR: Log-Meldung
      console.warn('[Semrush] No keywords returned for tracking ID:', trackingId);
      return {
        keywords: [],
        error: 'No keywords found'
      };
    }

    // Parse CSV-ähnliche Daten (erste Zeile = Header, Rest = Daten)
    const keywords = lines.slice(1).map(line => {
      const values = line.split(';');
      // Sicherstellen, dass genügend Spalten vorhanden sind
      if (values.length < 6) return null; 
      
      return {
        keyword: values[0] || '',
        position: parseFloat(values[1]) || 0,
        previousPosition: values[2] ? parseFloat(values[2]) : null,
        searchVolume: parseInt(values[3]) || 0,
        url: values[4] || '',
        trafficPercent: parseFloat(values[5]) || 0
      };
    }).filter(kw => kw && kw.keyword); // Filtere ungültige Zeilen und leere Keywords

    console.log('[Semrush] Successfully fetched', keywords.length, 'keywords for tracking ID:', trackingId);

    return {
      keywords,
      error: null
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      // KORREKTUR: Log-Meldung
      console.error(`[Semrush] Axios error fetching keywords for tracking ID ${trackingId}:`, error.message);
      if (error.response) {
        console.error('[Semrush] Response status:', error.response.status);
        console.error('[Semrush] Response data:', error.response.data); // Sehr wichtig für Debugging!
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
