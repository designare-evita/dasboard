import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getSearchConsoleData, getGa4Data } from '@/lib/google-api';
import { authOptions } from '@/lib/auth'; 

// HINWEIS: Wir müssen die authOptions exportieren.
// Öffnen Sie 'src/app/api/auth/[...nextauth]/route.ts' und ändern Sie 'const handler = NextAuth(...)'
// zu 'export const authOptions = { ... }; const handler = NextAuth(authOptions);'

export async function GET() {
  // const session = await getServerSession(authOptions);

  // if (!session || !session.user) {
  //   return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  // }
  
  // ToDo: Die Kundendomain und GA4-ID dynamisch aus der Datenbank laden,
  // basierend auf der session.user.email
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
