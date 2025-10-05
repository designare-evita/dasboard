import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getSearchConsoleData, getGa4Data } from '@/lib/google-api';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/database'; // Wir benötigen diese Funktion

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // 1. Benutzerdaten aus der Datenbank abrufen, basierend auf der E-Mail des eingeloggten Benutzers
    const user = await getUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json({ message: 'Benutzer nicht in der Datenbank gefunden' }, { status: 404 });
    }
    
    let siteUrl: string;
    let propertyId: string;

    // 2. Prüfen, welche Rolle der Benutzer hat
    if (user.role === 'BENUTZER') {
      // Wenn es ein KUNDE ist, verwenden wir seine persönlichen IDs aus der Datenbank
      if (!user.gsc_site_url || !user.ga4_property_id) {
        throw new Error('Konfiguration für diesen Kunden ist unvollständig.');
      }
      siteUrl = user.gsc_site_url;
      propertyId = `properties/${user.ga4_property_id}`;
    } else {
      // Wenn es ein ADMIN oder SUPERADMIN ist, zeigen wir weiterhin die Test-Daten an
      siteUrl = 'https://max-online.at/'; 
      propertyId = 'properties/421293385';
    }

    // 3. Google APIs mit den dynamischen Daten aufrufen
    const [gscData, ga4Data] = await Promise.all([
      getSearchConsoleData(siteUrl),
      getGa4Data(propertyId)
    ]);

    return NextResponse.json({ gscData, ga4Data });

  } catch (error) {
    console.error('[API /data] Fehler:', error);
    return NextResponse.json(
      { message: 'Fehler beim Abrufen der Dashboard-Daten', error: (error as Error).message },
      { status: 500 }
    );
  }
}
