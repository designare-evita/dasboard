import { NextResponse } from 'next/server';

// Dies ist die Haupt-API-Route für das Dashboard.
// Später werden wir hier die Funktionen aus den /lib-Dateien aufrufen.
export async function GET() {
  try {
    // Vorerst senden wir nur eine Erfolgsmeldung zurück.
    return NextResponse.json({
      message: 'Daten-API funktioniert!',
      data: null,
    });

  } catch (error) {
    return NextResponse.json(
      { message: 'Ein Fehler ist aufgetreten', error: (error as Error).message },
      { status: 500 }
    );
  }
}
