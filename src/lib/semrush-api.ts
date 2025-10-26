// src/lib/semrush-api.ts
import axios from 'axios';

// Basis-URL für die Semrush API
const SEMRUSH_API_URL = 'https://api.semrush.com/';

// API-Schlüssel aus der Umgebungsvariable holen
const apiKey = process.env.SEMRUSH_API_KEY;

/**
 * Eine grundlegende Funktion zum Abrufen von Domain-Übersichtsdaten von Semrush.
 * @param domain Die Domain, für die Daten abgerufen werden sollen (z.B. "example.com")
 * @param database Die Semrush-Datenbank (z.B. "de" für Deutschland, "us" für USA)
 */
export async function getSemrushDomainOverview(domain: string, database: string = 'de') {
  // Prüfen, ob der API-Key in Vercel gesetzt ist
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

  console.log('[Semrush] Fetching data for domain:', cleanDomain, 'database:', database);

  // Zusammenstellen der Anfrage-URL
  const params = new URLSearchParams({
    key: apiKey,
    type: 'domain_ranks', // KORRIGIERT: domain_ranks statt domain_rank
    domain: cleanDomain,
    database: database,
    // Spalten: Or = Organic Keywords, Ot = Organic Traffic
    export_columns: 'Or,Ot', 
  });

  const url = `${SEMRUSH_API_URL}?${params.toString()}`;

  try {
    // API-Anfrage mit axios senden
    const response = await axios.get(url, {
      timeout: 10000 // 10 Sekunden Timeout
    });

    // Semrush gibt bei Erfolg Text/CSV zurück, kein JSON
    if (typeof response.data !== 'string') {
      throw new Error('Unexpected response format from Semrush');
    }

    // Die Antwort ist CSV-ähnlich, mit Semikolons getrennt
    // Beispiel-Antwort: "Domain;Or;Ot\nexample.com;12345;67890"
    const lines = response.data.trim().split('\n');
    
    if (lines.length < 2) {
      console.warn('[Semrush] No data returned for domain:', cleanDomain);
      return {
        organicKeywords: null,
        organicTraffic: null,
        error: 'No data available'
      };
    }

    // Header überspringen, Werte parsen
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

    console.log('[Semrush] ✅ Data fetched successfully - Keywords:', organicKeywords, 'Traffic:', organicTraffic);

    // Daten als strukturiertes Objekt zurückgeben
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
    
    // Platzhalter zurückgeben, damit das Dashboard nicht bricht
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'Could not fetch Semrush data',
    };
  }
}

// Hier können wir später weitere Funktionen hinzufügen (z.B. für Keyword-Positionen)
