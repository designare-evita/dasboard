// src/app/api/test-semrush/route.ts

import { NextResponse } from 'next/server';
// Passe den Pfad ggf. an, er sollte so stimmen
import { getSemrushDomainOverview } from '../../../lib/semrush-api'; 

/**
 * Dies ist ein temporärer Endpunkt, um die Semrush-API-Verbindung zu testen.
 */
export async function GET() {
  const testDomain = 'google.com'; // Teste mit einer bekannten Domain
  const testDatabase = 'de';

  console.log(`[TEST] Rufe Semrush-Daten für ${testDomain} ab...`);

  try {
    const data = await getSemrushDomainOverview(testDomain, testDatabase);

    // Prüfen, ob Semrush selbst einen Fehler gemeldet hat
    if (data.error) {
      console.error('[TEST] Semrush hat einen Fehler zurückgegeben:', data.error);
      return NextResponse.json(
        { 
          ok: false, 
          message: 'Semrush API hat einen Fehler gemeldet', 
          details: data.error 
        },
        { status: 500 }
      );
    }

    // Erfolg!
    console.log('[TEST] Erfolgreich Daten von Semrush erhalten:', data);
    return NextResponse.json({
      ok: true,
      domain: testDomain,
      data: data,
    });

  } catch (error: any) {
    // Fängt allgemeine Fehler ab (z.B. API-Key fehlt)
    console.error('[TEST] Ein schwerwiegender Fehler ist aufgetreten:', error.message);
    return NextResponse.json(
      { 
        ok: false, 
        message: 'Schwerwiegender Fehler beim Abruf',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
