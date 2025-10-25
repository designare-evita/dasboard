// src/app/api/test-semrush/route.ts

import { NextResponse } from 'next/server';
// Passe den Pfad ggf. an, er sollte so stimmen
import { getSemrushDomainOverview } from '../../../lib/semrush-api'; 
import axios from 'axios';

/**
 * Dies ist ein temporärer Endpunkt, um die Semrush-API-Verbindung zu testen.
 */
export async function GET() {
  const testDomain = 'google.com'; // Teste mit einer bekannten Domain
  const testDatabase = 'de';

  console.log(`[TEST] Rufe Semrush-Daten für ${testDomain} ab...`);

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
      // Manchmal sendet Semrush bei einem Fehler auch eine Text-Antwort
      // (z.B. "ERROR :: API KEY INVALID")
      if (lines.length === 1 && lines[0].includes('ERROR')) {
         throw new Error(`Semrush API returned an error: ${lines[0]}`);
      }
      throw new Error('Invalid data format from Semrush');
    }

    const headers = lines[0].split(';');
    const values = lines[1].split(';');

    // 5. Daten als strukturiertes Objekt zurückgeben
    return {
      organicKeywords: parseInt(values[0], 10) || 0,
      organicTraffic: parseInt(values[1], 10) || 0,
    };

  } catch (error: unknown) {
    
    let errorMessage = 'Could not fetch Semrush data';

    // Typprüfung: Ist es ein Axios-Fehler?
    if (axios.isAxiosError(error) && error.response) {
      // Ja, wir haben eine Antwort von Semrush (z.B. 401, 403)
      console.error(`[SEMRUSH API ERROR] Status: ${error.response.status}`);
      // Semrush sendet Fehler oft als Text, nicht JSON
      console.error(`[SEMRUSH API ERROR] Data: ${error.response.data}`);
      
      // Die 'data'-Eigenschaft enthält oft die genaue Fehlermeldung
      errorMessage = `Semrush API Error: ${String(error.response.data) || error.message}`;

    } else if (error instanceof Error) {
      // Allgemeiner Fehler (z.B. Netzwerk, DNS, oder der 'throw' von oben)
      console.error(`[SEMRUSH GENERIC ERROR] ${error.message}`);
      errorMessage = error.message;
    } else {
      // Unbekannter Fehler
      console.error('[SEMRUSH UNKNOWN ERROR]', error);
      errorMessage = 'An unknown error occurred';
    }

    // Den detaillierten Fehler zurückgeben
    return {
      organicKeywords: null,
      organicTraffic: null,
      error: errorMessage, 
    };
  }
}
