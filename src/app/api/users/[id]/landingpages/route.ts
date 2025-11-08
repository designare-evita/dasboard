// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse } from 'next/server';
// Annahme: Du nutzt NextAuth/Auth.js für die Authentifizierung
import { auth } from '@/auth'; 
// Annahme: Du nutzt Prisma als ORM
import { prisma } from '@/lib/db'; 

// --- DAS IST DIE WICHTIGE KORREKTUR ---
// Wir importieren die Typen sicher aus der zentralen Datei,
// NICHT aus der React-Komponente.
import { Landingpage } from '@/types';

// Ein Typ, um die URL-Parameter (die [id]) zu beschreiben
interface RouteParams {
  params: { id: string };
}

/**
 * GET Handler: Holt alle relevanten Landingpages für einen
 * spezifischen Benutzer (identifiziert durch die ID in der URL).
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    // 1. Authentifizierung prüfen (Sehr empfohlen)
    // Stellt sicher, dass der anfragende Benutzer eingeloggt ist
    // und die Berechtigung hat, diese Daten zu sehen.
    const session = await auth();
    
    // Prüfen, ob der User eingeloggt ist UND
    // entweder der User selbst oder ein Admin die Daten abfragt.
    if (!session?.user || (session.user.id !== params.id && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert.' }, { status: 401 });
    }

    // 2. Benutzer-ID aus den Parametern holen
    const { id: userId } = params;

    if (!userId) {
      return NextResponse.json({ message: 'Benutzer-ID fehlt.' }, { status: 400 });
    }

    // 3. (Annahme) Finde den Benutzer, um seine GSC-URL zu erhalten
    // Diese Logik basiert auf deinen Typ-Definitionen.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gsc_site_url: true, mandant_id: true } // Nur die nötigen Felder laden
    });

    if (!user) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden.' }, { status: 404 });
    }

    // 4. (Annahme) Finde die Landingpages basierend auf der Benutzer-Property
    // PASSE DIESE LOGIK AN DEIN DATENBANK-SCHEMA AN.
    // Beispiel: Finde alle Pages, die zur GSC-URL des Users gehören ODER die gleiche mandant_id haben.
    
    // Hier ist eine Beispiel-Logik. Du musst sie anpassen:
    const whereClause: any = {};
    if (user.gsc_site_url) {
       // Filtere basierend auf der Domain/URL des Benutzers
      whereClause.url = { startsWith: user.gsc_site_url };
    } else if (user.mandant_id) {
      // Oder filtere über eine Mandanten-ID
      // (Dafür müsste das Landingpage-Modell auch eine mandant_id haben)
      // whereClause.mandant_id = user.mandant_id;
      
      // Wenn du keine Property zum Filtern hast, musst du die Abfrage anpassen.
      // Fürs Erste geben wir einen Fehler zurück, wenn GSC fehlt.
      return NextResponse.json({ message: 'Für diesen Benutzer ist keine GMB-Site-URL konfiguriert.' }, { status: 400 });
    }
    
    // Zeige nur die Status, die im Redaktionsplan relevant sind
    whereClause.status = {
      in: ['In Prüfung', 'Freigegeben', 'Gesperrt']
    };

    const landingpages: Landingpage[] = await prisma.landingpage.findMany({
      where: whereClause,
      orderBy: [
        // Sortiere, um "In Prüfung" oben anzuzeigen
        { status: 'desc' }, // 'In Prüfung' kommt alphabetisch nach 'Gesperrt'/'Freigegeben'
        { id: 'desc' }      // Neueste zuerst
      ]
    });

    // 5. Erfolgreiche Antwort mit den Daten zurückgeben
    return NextResponse.json(landingpages);

  } catch (error) {
    // Fehlerbehandlung
    console.error(`Fehler in /api/users/${params.id}/landingpages:`, error);
    return NextResponse.json({ message: 'Ein interner Serverfehler ist aufgetreten.' }, { status: 500 });
  }
}

// Hinweis: POST, PUT, DELETE sind hier wahrscheinlich nicht nötig,
// da deine Komponente die Status-Updates an
// /api/landingpages/[id]/status sendet, was korrekt ist.
