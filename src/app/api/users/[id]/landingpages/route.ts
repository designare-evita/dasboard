// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { sql } from '@vercel/postgres';
import { Landingpage } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET Handler: Holt alle relevanten Landingpages für einen
 * spezifischen Benutzer (identifiziert durch die ID in der URL).
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    // Await params in Next.js 15+
    const { id: userId } = await params;
    
    // 1. Authentifizierung prüfen
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    // Prüfen, ob der User eingeloggt ist UND
    // entweder der User selbst oder ein Admin die Daten abfragt.
    if (!session?.user || (session.user.id !== userId && session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert.' }, { status: 401 });
    }

    // 2. Benutzer-ID validieren
    if (!userId) {
      return NextResponse.json({ message: 'Benutzer-ID fehlt.' }, { status: 400 });
    }

    // 3. Benutzer finden und GSC-URL prüfen
    const { rows: userRows } = await sql`
      SELECT gsc_site_url, domain 
      FROM users 
      WHERE id::text = ${userId}
    `;

    if (userRows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden.' }, { status: 404 });
    }

    const user = userRows[0];

    // 4. Landingpages für diesen Benutzer laden
    // Zeige nur die Status, die im Redaktionsplan relevant sind
    const { rows: landingpages } = await sql<Landingpage>`
      SELECT 
        id,
        url,
        haupt_keyword,
        weitere_keywords,
        status,
        gsc_klicks,
        gsc_klicks_change,
        gsc_impressionen,
        gsc_impressionen_change,
        gsc_position,
        gsc_position_change,
        gsc_last_updated,
        gsc_last_range,
        created_at
      FROM landingpages
      WHERE user_id::text = ${userId}
      AND status IN ('Offen', 'In Prüfung', 'Freigegeben', 'Gesperrt')
      ORDER BY 
        CASE status
          WHEN 'In Prüfung' THEN 1
          WHEN 'Freigegeben' THEN 2
          WHEN 'Gesperrt' THEN 3
          WHEN 'Offen' THEN 4
        END,
        id DESC
    `;

    console.log(`[API Landingpages] ${landingpages.length} Landingpages für User ${userId} geladen`);

    // 5. Erfolgreiche Antwort mit den Daten zurückgeben
    return NextResponse.json(landingpages);

  } catch (error) {
    // Fehlerbehandlung
    console.error('Fehler in /api/users/[id]/landingpages:', error);
    return NextResponse.json(
      { message: 'Ein interner Serverfehler ist aufgetreten.' }, 
      { status: 500 }
    );
  }
}
