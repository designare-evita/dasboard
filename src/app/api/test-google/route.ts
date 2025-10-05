import { NextResponse } from 'next/server';
import { getSearchConsoleData, getGa4Data } from '@/lib/google-api';

export async function GET() {
  try {
    // --- BITTE HIER IHRE TESTDATEN EINTRAGEN ---
    const testSiteUrl = 'sc-domain:max-online.at'; // Wichtig: Für Domain-Properties 'sc-domain:' voranstellen
    const testGa4PropertyId = 'properties/314388177'; // Ersetzen Sie dies mit der echten ID Ihrer GA4-Testproperty
    // -----------------------------------------

    console.log(`Starte Test für GSC: ${testSiteUrl}`);
    const gscData = await getSearchConsoleData(testSiteUrl);
    console.log('GSC Daten erfolgreich abgerufen.');

    console.log(`Starte Test für GA4: ${testGa4PropertyId}`);
    const ga4Data = await getGa4Data(testGa4PropertyId);
    console.log('GA4 Daten erfolgreich abgerufen.');

    return NextResponse.json({
      message: 'Test erfolgreich!',
      searchConsoleData: gscData,
      ga4Data: ga4Data,
    });

  } catch (error) {
    console.error('Ein Fehler ist beim Test aufgetreten:', error);
    // Wir schicken den Fehler auch an das Frontend, um ihn im Browser zu sehen
    return NextResponse.json(
      { message: 'Test fehlgeschlagen!', error: (error as Error).message },
      { status: 500 }
    );
  }
}
