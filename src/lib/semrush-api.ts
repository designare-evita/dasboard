
import axios from 'axios';

// Basis-URL für die Semrush API
const SEMRUSH_API_URL = 'https://api.semrush.com/';

// 1. API-Schlüssel aus der Umgebungsvariable holen
const apiKey = process.env.SEMRUSH_API_KEY;

/**
 * Eine grundlegende Funktion zum Abrufen von Domain-Übersichtsdaten von Semrush.
 * * @param domain Die Domain, für die Daten abgerufen werden sollen (z.B. "example.com")
 * @param database Die Semrush-Datenbank (z.B. "de" für Deutschland, "us" für USA)
 */
export async function getSemrushDomainOverview(domain: string, database: string = 'de') {
  // 2. Prüfen, ob der API-Key in Vercel gesetzt ist
  if (!apiKey) {
    console.error('SEMRUSH_API_KEY is not set in environment variables.');
    throw new Error('Semrush API key is missing');
  }

  // 3. Zusammenstellen der Anfrage-URL
  const params = new URLSearchParams({
    key: apiKey,
    type: 'domain_rank', // Der Typ des Berichts, den wir abfragen
    domain: domain,
    database: database,
    // Spalten, die wir anfordern (Beispiel: Organische Keywords, Organischer Traffic)
    export_columns: 'Or,Ot', 
  });

  const url = `${SEMRUSH_API_URL}?${params.toString()}`;

  try {
    // 4. API-Anfrage mit axios senden
    const response = await axios.get(url);

    // Semrush gibt bei Erfolg Text/CSV zurück, kein JSON.
    // Wir müssen die Antwort parsen.
    if (typeof response.data !== 'string') {
      throw new Error('Unexpected response format from Semrush');
    }

    // Die Antwort ist oft CSV-ähnlich, mit Semikolons getrennt.
    // Beispiel-Antwort: "Organische Keywords;Organischer Traffic\n12345;67890"
    const lines = response.data.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('Invalid data from Semrush');
    }

    const headers = lines[0].split(';');
    const values = lines[1].split(';');

    // 5. Daten als strukturiertes Objekt zurückgeben
    return {
      organicKeywords: parseInt(values[0], 10) || 0,
      organicTraffic: parseInt(values[1], 10) || 0,
    };

  } catch (error) {
    console.error(`Error fetching Semrush data for ${domain}:`, error);
    // Einen Platzhalter oder Fehlerstatus zurückgeben, damit der Rest des Dashboards nicht bricht
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: 'Could not fetch Semrush data',
    };
  }
}

// Hier können wir später weitere Funktionen hinzufügen (z.B. für Keyword-Positionen)
