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
 * Priorität: 1. Project ID, 2. Domain
 */
export async function getSemrushData(params: {
  domain?: string;
  projectId?: string;
  trackingId?: string;
  database?: string;
}) {
  const { domain, projectId, trackingId, database = 'de' } = params;

  console.log('[Semrush] Getting data with params:', { domain, projectId, trackingId, database });

  // Strategie 1: Verwende Project ID wenn vorhanden (präziser)
  if (projectId) {
    console.log('[Semrush] Using Project ID strategy');
    const projectData = await getSemrushProjectData(projectId);
    if (!('error' in projectData) || projectData.organicKeywords !== null) {
      return projectData;
    }
    console.warn('[Semrush] Project ID strategy failed, falling back to domain');
  }

  // Strategie 2: Verwende Domain als Fallback
  if (domain) {
    console.log('[Semrush] Using Domain strategy');
    return await getSemrushDomainOverview(domain, database);
  }

  // Keine Daten verfügbar
  console.warn('[Semrush] No valid parameters provided (need domain or projectId)');
  return {
    organicKeywords: null,
    organicTraffic: null,
    error: 'No domain or project ID provided'
  };
}
