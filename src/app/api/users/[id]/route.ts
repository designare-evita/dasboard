// src/app/api/users/[id]/route.ts (KORRIGIERT)

import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User } from '@/types';

// Handler zum Abrufen eines einzelnen Benutzers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // Dies ist die projectId/userId aus der URL
  try {
    const session = await getServerSession(authOptions);

    // --- START KORREKTUR ---
    // Berechtigungsprüfung:
    // 1. Ist der Benutzer überhaupt angemeldet?
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht authentifiziert' }, { status: 401 });
    }

    // 2. Ist der Benutzer Admin ODER der Eigentümer des angeforderten Profils?
    const isOwner = session.user.id === id;
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN';

    // Wenn der Benutzer weder Admin noch der Eigentümer ist, Zugriff verweigern.
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }
    // --- ENDE KORREKTUR ---

    // Wenn wir hier sind, ist der Benutzer berechtigt.
    console.log(`[GET /api/users/${id}] Benutzerdaten abrufen... (Berechtigt als ${isAdmin ? 'Admin' : 'Eigentümer'})`);

    const { rows } = await sql<User>`
      SELECT
        id::text as id,
        email,
        role,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id::text as semrush_project_id,
        semrush_tracking_id::text as semrush_tracking_id
      FROM users
      WHERE id = ${id}::uuid;
    `;

    if (rows.length === 0) {
      console.warn(`[GET /api/users/${id}] Benutzer nicht gefunden`);
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }

    console.log(`✅ [GET /api/users/${id}] Benutzerdaten erfolgreich abgerufen`);
    return NextResponse.json(rows[0]);

  } catch (error) {
    console.error(`[GET /api/users/${id}] Fehler:`, error);
    return NextResponse.json({
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

// Handler zum Aktualisieren eines Benutzers (PUT)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    // Berechtigungsprüfung: Nur Admins oder Superadmins
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    console.log(`[PUT /api/users/${id}] Benutzer aktualisieren...`);
    const body = await request.json();
    const { 
      email, 
      password, 
      role, 
      domain, 
      gsc_site_url, 
      ga4_property_id, 
      semrush_project_id, 
      semrush_tracking_id 
    } = body;

    // Dynamische Query-Erstellung
    const updateFields: string[] = [];
    const values: (string | number | null)[] = [];
    let valueIndex = 1;

    // Nur Felder hinzufügen, die auch im Body übergeben wurden
    if (email !== undefined) {
      updateFields.push(`email = $${valueIndex++}`);
      values.push(email);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push(`password_hash = $${valueIndex++}`);
      values.push(hashedPassword);
    }
    if (role !== undefined) {
      updateFields.push(`role = $${valueIndex++}`);
      values.push(role);
    }
    if (domain !== undefined) {
      updateFields.push(`domain = $${valueIndex++}`);
      values.push(domain);
    }
    if (gsc_site_url !== undefined) {
      updateFields.push(`gsc_site_url = $${valueIndex++}`);
      values.push(gsc_site_url);
    }
    if (ga4_property_id !== undefined) {
      updateFields.push(`ga4_property_id = $${valueIndex++}`);
      values.push(ga4_property_id);
    }
    if (semrush_project_id !== undefined) {
      updateFields.push(`semrush_project_id = $${valueIndex++}::integer`);
      values.push(semrush_project_id || null); // Erlaube Null/Leer
    }
    if (semrush_tracking_id !== undefined) {
      updateFields.push(`semrush_tracking_id = $${valueIndex++}::integer`);
      values.push(semrush_tracking_id || null); // Erlaube Null/Leer
    }

    if (updateFields.length === 0) {
      console.warn(`[PUT /api/users/${id}] Keine Felder zum Aktualisieren angegeben`);
      return NextResponse.json({ message: 'Keine Felder zum Aktualisieren angegeben' }, { status: 400 });
    }

    // ID als letzten Parameter hinzufügen
    values.push(id);
    const idIndex = valueIndex;

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${idIndex}::uuid
      RETURNING id::text as id, email, role, domain, gsc_site_url, ga4_property_id, semrush_project_id, semrush_tracking_id;
    `;

    // DEBUG: Logge die finale Query (ohne Werte)
    // console.log(`[PUT /api/users/${id}] Query: ${query}`);
    // console.log(`[PUT /api/users/${id}] Values:`, values);

    const { rows } = await sql.query(query, values);

    if (rows.length === 0) {
      console.warn(`[PUT /api/users/${id}] Benutzer nicht gefunden`);
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }

    console.log(`✅ [PUT /api/users/${id}] Benutzer erfolgreich aktualisiert`);
    return NextResponse.json({
      ...rows[0],
      message: 'Benutzer erfolgreich aktualisiert'
    });

  } catch (error) {
    console.error(`[PUT /api/users/${id}] Fehler:`, error);
    return NextResponse.json({
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

// Handler zum Löschen eines Benutzers
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    // Berechtigungsprüfung
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }
    console.log(`[DELETE /api/users/${id}] Lösche Benutzer...`);

    const result = await sql`
      DELETE FROM users WHERE id = ${id}::uuid;
    `;

    if (result.rowCount === 0) {
      console.warn(`[DELETE /api/users/${id}] Benutzer nicht gefunden`);
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }

    console.log(`✅ [DELETE /api/users/${id}] Benutzer erfolgreich gelöscht`);
    return NextResponse.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (error) {
    console.error(`[DELETE /api/users/${id}] Fehler:`, error);
    return NextResponse.json({
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
