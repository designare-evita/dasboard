// src/app/api/users/[id]/landingpages/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
// KORREKTUR: Importiere authOptions aus src/lib/auth.ts
import { authOptions } from '@/lib/auth'; 
// KORREKTUR: Importiere sql von @vercel/postgres
import { sql } from '@vercel/postgres'; 
// KORREKTUR: Importiere den Landingpage-Typ aus src/types/index.ts
import { Landingpage } from '@/types';

// Ein Typ, um die URL-Parameter (die [id]) zu beschreiben
interface RouteParams {
  params: { id: string };
}

/**
 * GET Handler: Holt alle relevanten Landingpages für einen
 * spezifischen Benutzer (identifiziert durch die ID in der URL).
 *
 * Diese Route wird sowohl von Admins (/admin/redaktionsplan)
 * als auch von Benutzern (/dashboard/freigabe) aufgerufen.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. Authentifizierung prüfen (mit NextAuth v4)
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert.' }, { status: 401 });
    }

    // 2. Benutzer-ID aus den Parametern holen (das ist der "targetUserId")
    const { id: targetUserId } = params;
    if (!targetUserId) {
      return NextResponse.json({ message: 'Benutzer-ID fehlt.' }, { status: 400 });
    }

    // 3. Berechtigungsprüfung
    const { role: sessionRole, id: sessionId } = session.user;
    const isAdmin = sessionRole === 'ADMIN' || sessionRole === 'SUPERADMIN';
    const isOwner = sessionId === targetUserId;

    // Zugriff verweigern, wenn kein Admin UND nicht der Eigentümer
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ message: 'Zugriff verweigert.' }, { status: 403 });
    }

    // Wenn ein Admin (nicht Superadmin) auf ein fremdes Projekt zugreift
    if (isAdmin && !isOwner && sessionRole === 'ADMIN') {
      const { rows: accessCheck } = await sql`
        SELECT 1 
        FROM project_assignments 
        WHERE user_id::text = ${sessionId} 
        AND project_id::text = ${targetUserId};
      `;
      if (accessCheck.length === 0) {
        return NextResponse.json({ message: 'Admin hat keinen Zugriff auf dieses Projekt' }, { status: 403 });
      }
    }
    // Superadmin (isAdmin && !isOwner) darf alles
    // Benutzer (isOwner) darf eigene

    // 4. Datenbankabfrage mit @vercel/postgres
    // Wir holen alle Felder, die im Landingpage-Typ definiert sind
    const { rows } = await sql`
      SELECT 
        id,
        url,
        status,
        haupt_keyword,
        weitere_keywords,
        user_id::text,
        created_at,
        gsc_klicks,
        gsc_klicks_change,
        gsc_impressionen,
        gsc_impressionen_change,
        gsc_position,
        gsc_position_change,
        gsc_last_updated,
        gsc_last_range
      FROM landingpages
      WHERE user_id::text = ${targetUserId}
      ORDER BY 
        -- Sortiert "In Prüfung" nach oben, dann "Offen", dann der Rest
        CASE 
          WHEN status = 'In Prüfung' THEN 1
          WHEN status = 'Offen' THEN 2
          WHEN status = 'Freigegeben' THEN 3
          WHEN status = 'Gesperrt' THEN 4
          ELSE 5
        END,
        created_at DESC;
    `;
    
    // Wir typisieren die Rückgabe als Landingpage-Array
    const landingpages: Landingpage[] = rows as Landingpage[];

    // 5. Erfolgreiche Antwort mit den Daten zurückgeben
    return NextResponse.json(landingpages);

  } catch (error) {
    // 6. Fehlerbehandlung
    console.error(`Fehler in /api/users/${params.id}/landingpages:`, error);
    return NextResponse.json({ 
      message: 'Ein interner Serverfehler ist aufgetreten.',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// HINWEIS: POST / PUT / DELETE sind in dieser Route nicht implementiert
// und werden von der Komponente auch nicht erwartet.
// Die Komponente verwendet /api/landingpages/[id]/status für Updates.
