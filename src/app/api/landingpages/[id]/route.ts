// src/app/api/landingpages/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth

// Helper-Funktion für Admin-Check
async function isAdminSession() {
  const session = await auth(); // KORRIGIERT: auth() aufgerufen
  return session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';
}

/**
 * GET - Landingpage Details abrufen
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const { rows } = await sql`
      SELECT 
        lp.id,
        lp.url,
        lp.haupt_keyword,
        lp.weitere_keywords,
        lp.suchvolumen,
        lp.aktuelle_position,
        lp.status,
        lp.created_at,
        lp.user_id::text,
        u.domain,
        u.email as user_email
      FROM landingpages lp
      LEFT JOIN users u ON lp.user_id = u.id
      WHERE lp.id = ${id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Landingpage nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('[API LANDINGPAGES GET /id]', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}

/**
 * PUT - Landingpage aktualisieren
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();
  const { url, haupt_keyword, weitere_keywords, suchvolumen, aktuelle_position, status } = body;

  try {
    const { rows } = await sql`
      UPDATE landingpages
      SET 
        url = ${url},
        haupt_keyword = ${haupt_keyword},
        weitere_keywords = ${weitere_keywords},
        suchvolumen = ${suchvolumen},
        aktuelle_position = ${aktuelle_position},
        status = ${status}
      WHERE id = ${id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Landingpage nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Landingpage erfolgreich aktualisiert', 
      landingpage: rows[0] 
    });
  } catch (error) {
    console.error('[API LANDINGPAGES PUT /id]', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}

/**
 * DELETE - Landingpage löschen (nur für Admin/Superadmin)
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    // Nur Admin und Superadmin dürfen löschen
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      console.warn('[DELETE Landingpage] Zugriff verweigert für:', session?.user?.email);
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { id } = await context.params;

    console.log('[DELETE Landingpage] Lösche Landingpage:', id);
    console.log('[DELETE Landingpage] Angefordert von:', session.user.email, 'Rolle:', session.user.role);

    // Lade Landingpage-Details für Logging und Berechtigungsprüfung
    const { rows: landingpages } = await sql`
      SELECT 
        lp.*,
        u.email as user_email,
        u.domain as user_domain
      FROM landingpages lp
      INNER JOIN users u ON lp.user_id = u.id
      WHERE lp.id = ${id};
    `;

    if (landingpages.length === 0) {
      console.warn('[DELETE Landingpage] Nicht gefunden:', id);
      return NextResponse.json({ message: 'Landingpage nicht gefunden' }, { status: 404 });
    }

    const landingpage = landingpages[0];

    // Admin-Berechtigungsprüfung: Nur bei zugewiesenen Projekten
    if (session.user.role === 'ADMIN') {
      const { rows: accessCheck } = await sql`
        SELECT 1 
        FROM project_assignments 
        WHERE user_id::text = ${session.user.id} 
        AND project_id::text = ${landingpage.user_id};
      `;

      if (accessCheck.length === 0) {
        console.warn('[DELETE Landingpage] Admin hat keinen Zugriff auf Projekt');
        return NextResponse.json({ 
          message: 'Sie haben keine Berechtigung, Landingpages dieses Projekts zu löschen' 
        }, { status: 403 });
      }
    }

    // Lösche die Landingpage
    await sql`
      DELETE FROM landingpages 
      WHERE id = ${id};
    `;

    console.log('[DELETE Landingpage] ✅ Erfolgreich gelöscht:', landingpage.url);

    // Optional: Benachrichtigung an den Kunden senden
    try {
      await sql`
        INSERT INTO notifications (user_id, message, type)
        VALUES (
          ${landingpage.user_id},
          ${`Ihre Landingpage "${landingpage.url}" wurde vom Admin gelöscht.`},
          'warning'
        );
      `;
      console.log('[DELETE Landingpage] Benachrichtigung an Kunde gesendet');
    } catch (notifError) {
      console.error('[DELETE Landingpage] Fehler beim Senden der Benachrichtigung:', notifError);
      // Nicht kritisch, fahre fort
    }

    return NextResponse.json({ 
      message: 'Landingpage erfolgreich gelöscht',
      deleted: {
        id: landingpage.id,
        url: landingpage.url,
        customer: landingpage.user_domain || landingpage.user_email
      }
    });

  } catch (error) {
    console.error('[DELETE Landingpage] Fehler:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Löschen der Landingpage',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
