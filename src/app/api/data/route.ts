import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getSearchConsoleData, getGa4Data } from '@/lib/google-api';
import { authOptions } from '@/lib/auth'; // Korrekter Import

export async function GET() {
  // Session wird jetzt ausgelesen, um den Benutzer zu identifizieren
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    // Wenn niemand eingeloggt ist, wird der Zugriff verweigert
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }
  
  // ToDo: Die Kundendomain und GA4-ID dynamisch aus der Datenbank laden
  const customerSiteUrl = 'https://www.max-online.at/'; // Temporär hartcodiert
  const customerGa4PropertyId = 'properties/421293385'; // Temporär hartcodiert

  try {
    const [gscData, ga4Data] = await Promise.all([
      getSearchConsoleData(customerSiteUrl),
      getGa4Data(customerGa4PropertyId)
    ]);

    return NextResponse.json({ gscData, ga4Data });
  } catch (error) {
    return NextResponse.json(
      { message: 'Fehler beim Abrufen der Dashboard-Daten', error: (error as Error).message },
      { status: 500 }
    );
  }
}
