import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getSearchConsoleData, getGa4Data } from '@/lib/google-api';
import { authOptions } from '@/lib/auth';

export async function GET() {
  console.log('[API /data] Route aufgerufen.'); // LOG 1

  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      console.error('[API /data] FEHLER: Keine gültige Session gefunden. Zugriff verweigert.'); // LOG 2
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    console.log(`[API /data] Session gefunden für Benutzer: ${session.user.email}`); // LOG 3
    
    // ToDo: Diese Werte später dynamisch aus der Datenbank laden
    const customerSiteUrl = 'https://www.max-online.at/'; 
    const customerGa4PropertyId = 'properties/421293385'; 

    console.log(`[API /data] Rufe Google-Daten ab für GSC: ${customerSiteUrl} und GA4: ${customerGa4PropertyId}`); // LOG 4

    const [gscData, ga4Data] = await Promise.all([
      getSearchConsoleData(customerSiteUrl),
      getGa4Data(customerGa4PropertyId)
    ]);

    console.log('[API /data] Daten von Google erfolgreich abgerufen. Sende Antwort.'); // LOG 5
    return NextResponse.json({ gscData, ga4Data });

  } catch (error) {
    // Dieser Block fängt alle Fehler ab, die oben auftreten
    console.error('[API /data] Ein schwerwiegender Fehler ist im try-Block aufgetreten:', error); // LOG 6
    return NextResponse.json(
      { message: 'Fehler beim Abrufen der Dashboard-Daten', error: (error as Error).message },
      { status: 500 }
    );
  }
}
