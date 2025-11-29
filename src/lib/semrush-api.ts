// src/lib/semrush-api.ts
import axios, { AxiosError } from 'axios';

const apiKey = process.env.SEMRUSH_API_KEY;

// --- Interfaces für Typensicherheit ---

interface SemrushKeywordData {
  Ph?: string;                                      // Keyword Phrase
  Fi?: Record<string, number | string>;             // Position (Dictionary Key = Date)
  Be?: Record<string, number | string>;             // Previous Position
  Nq?: string;                                      // Search Volume
  Lu?: Record<string, string | Record<string, string>>; // Landing Page URL
  Tr?: Record<string, number | Record<string, number>>; // Traffic %
}

interface SemrushApiResponse {
  data?: Record<string, SemrushKeywordData>;
}

export interface ProcessedKeyword {
  keyword: string;
  position: number;
  previousPosition: number | null;
  searchVolume: number;
  url: string;
  trafficPercent: number;
}

interface SemrushResult {
  keywords: ProcessedKeyword[];
  error: string | null;
}

// --- Hauptfunktion ---

export async function getSemrushKeywords(
  campaignId: string,
  domainOrContext?: string | Record<string, unknown>
): Promise<SemrushResult> {
  // 1. Validierung
  if (!apiKey) {
    console.error('[Semrush] ❌ API Key fehlt in Environment Variables.');
    return { keywords: [], error: 'Configuration Error: API Key missing' };
  }

  if (!campaignId) {
    console.warn('[Semrush] ⚠️ Keine Campaign ID übergeben.');
    return { keywords: [], error: 'Invalid Project ID' };
  }

  // Domain extrahieren und säubern
  let domain = 'example.com';
  if (typeof domainOrContext === 'string') {
    domain = domainOrContext;
  } else if (typeof domainOrContext === 'object' && domainOrContext !== null) {
    const obj = domainOrContext as Record<string, unknown>;
    domain = (obj.domain || obj.Domain || obj.url || 'example.com') as string;
  }

  // Domain Normalisierung: "https://www.google.com" -> "google.com"
  const cleanDomain = domain
    .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
    .split('/')[0];

  console.log(`[Semrush] 🚀 Starte Abfrage für Projekt: ${campaignId} (Domain: ${cleanDomain})`);

  // 2. Request Konfiguration (Single Source of Truth)
  // Wir nutzen die Wildcard-Strategie (*.domain/*), da diese Rankings für
  // Root, WWW und Subdomains einfängt. Das ist der Standard für SEO-Dashboards.
  const endpoint = `https://api.semrush.com/reports/v1/projects/${campaignId}/tracking/`;
  
  const params = {
    key: apiKey,
    type: 'tracking_position_organic',
    action: 'report',
    url: `*.${cleanDomain}/*`, // Wildcard Strategy (Best Practice)
    display_limit: '50',
    sort_field: 'position',    // Direkt sortiert von API holen
    sort_order: 'asc'
  };

  try {
    const response = await axios.get<SemrushApiResponse>(endpoint, {
      params,
      timeout: 10000, // 10s Timeout
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DataPeak Dashboard/1.0'
      }
    });

    const data = response.data;

    // API liefert manchmal leeres "data" Objekt oder null
    if (!data?.data || Object.keys(data.data).length === 0) {
      console.warn(`[Semrush] ℹ️ Keine Keywords für ${cleanDomain} gefunden (oder Projekt leer).`);
      return { keywords: [], error: null }; // Kein Fehler, einfach keine Daten
    }

    // 3. Datenverarbeitung
    const keywords: ProcessedKeyword[] = [];
    const today = new Date();
    // Semrush Keys sind oft YYYYMMDD
    const dateKey = today.toISOString().slice(0, 10).replace(/-/g, '');

    for (const kwData of Object.values(data.data)) {
      const keyword = kwData.Ph;
      if (!keyword) continue;

      // Position parsen
      let currentPosition = 0;
      if (kwData.Fi) {
        // Nimm den neuesten verfügbaren Wert
        const posValues = Object.values(kwData.Fi);
        const latestPos = posValues[posValues.length - 1]; // Letzter Eintrag ist meist aktuell
        currentPosition = typeof latestPos === 'number' ? latestPos : parseFloat(String(latestPos));
      }

      // Filter: Nur Rankings in Top 100 und gültig
      if (!currentPosition || isNaN(currentPosition) || currentPosition > 100) continue;

      // Vorherige Position
      let previousPosition: number | null = null;
      if (kwData.Be) {
         const prevValues = Object.values(kwData.Be);
         const latestPrev = prevValues[prevValues.length - 1];
         previousPosition = typeof latestPrev === 'number' ? latestPrev : parseFloat(String(latestPrev));
      }

      // Suchvolumen
      const searchVolume = kwData.Nq ? parseInt(kwData.Nq, 10) : 0;

      // Landing Page URL extrahieren
      let landingUrl = '';
      if (kwData.Lu) {
        // Versuche erst exaktes Datum, sonst ersten verfügbaren Wert
        const urls = kwData.Lu as Record<string, any>;
        const urlVal = urls[dateKey] || Object.values(urls)[0];
        if (typeof urlVal === 'string') landingUrl = urlVal;
        else if (typeof urlVal === 'object') landingUrl = Object.values(urlVal)[0] as string;
      }

      // Traffic %
      let trafficPercent = 0;
      if (kwData.Tr) {
        const tr = kwData.Tr as Record<string, any>;
        const trVal = tr[dateKey] || Object.values(tr)[0];
        const numVal = typeof trVal === 'object' ? Object.values(trVal)[0] : trVal;
        if (typeof numVal === 'number') trafficPercent = numVal * 100;
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

    // Sortierung sicherstellen (falls API Sortierung nicht griff)
    keywords.sort((a, b) => a.position - b.position);

    console.log(`[Semrush] ✅ Erfolg! ${keywords.length} Keywords geladen.`);
    return { keywords: keywords.slice(0, 50), error: null }; // Limit sicherstellen

  } catch (error: unknown) {
    let errorMessage = 'Unknown Semrush Error';
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const apiMsg = (error.response?.data as any)?.message || JSON.stringify(error.response?.data);
      
      if (status === 403) errorMessage = 'API Key ungültig oder abgelaufen.';
      else if (status === 404) errorMessage = 'Projekt-ID nicht gefunden (Überprüfe Konfiguration).';
      else if (status === 429) errorMessage = 'Rate Limit erreicht (Zu viele Anfragen).';
      else errorMessage = `API Fehler (${status}): ${apiMsg}`;
      
      console.error(`[Semrush] ❌ Axios Fehler: ${errorMessage}`);
    } else {
      console.error('[Semrush] ❌ Code Fehler:', error);
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    return { keywords: [], error: errorMessage };
  }
}
