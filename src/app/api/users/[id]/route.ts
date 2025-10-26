// src/app/api/users/[id]/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User } from '@/types';

// HINWEIS: Der separate 'RouteHandlerParams' Typ wurde entfernt.

// Handler zum Abrufen eines einzelnen Benutzers
export async function GET(
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

    console.log(`[GET /api/users/${id}] Benutzerdaten abrufen...`);

    const { rows } = await sql<User>`
      SELECT
        id::text as id,
        email,
        role,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id,
        semrush_tracking_id
      FROM users
      WHERE id = ${id}::uuid;
    `;

    if (rows.length === 0) {
      console.warn(`[GET /api/users/${id}] Benutzer nicht gefunden`);
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    console.log(`[GET /api/users/${id}] Benutzer gefunden:`, rows[0].email);
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error(`[GET /api/users/${id}] Fehler:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Aktualisieren eines Benutzers
export async function PUT(
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
    const body = await request.json();

    const {
        email,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id,
        semrush_tracking_id,
        password
    } = body;

    if (!email) {
      return NextResponse.json({ message: 'E-Mail ist erforderlich' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // E-Mail-Konfliktprüfung
    const { rows: emailCheck } = await sql`
      SELECT id FROM users
      WHERE email = ${normalizedEmail} AND id::text != ${id};
    `;
    if (emailCheck.length > 0) {
      return NextResponse.json({
        message: 'Diese E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet'
      }, { status: 409 });
    }

    // Benutzer-Existenzprüfung
    const { rows: existingUsers } = await sql`SELECT role FROM users WHERE id = ${id}::uuid`;
    if (existingUsers.length === 0) {
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }
    
    console.log(`[PUT /api/users/${id}] Update-Anfrage...`);

    // Dynamisches Update-Set
    const updateFields = [
      `email = ${normalizedEmail}`,
      `domain = ${domain || null}`,
      `gsc_site_url = ${gsc_site_url || null}`,
      `ga4_property_id = ${ga4_property_id || null}`,
      `semrush_project_id = ${semrush_project_id || null}`,
      `semrush_tracking_id = ${semrush_tracking_id || null}`
    ];

    if (password && password.trim().length > 0) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push(`password = ${hashedPassword}`);
      console.log(`  - [PUT /api/users/${id}] Passwort wird aktualisiert.`);
    }

    const setClause = updateFields.join(', ');
    const updateQueryString = `
      UPDATE users
      SET ${setClause}
      WHERE id = $1::uuid
      RETURNING
        id::text as id, email, role, domain, 
        gsc_site_url, ga4_property_id, 
        semrush_project_id, semrush_tracking_id;
    `;

    const { rows } = await sql.query<User>(updateQueryString, [id]);

    if (rows.length === 0) {
      return NextResponse.json({ message: "Update fehlgeschlagen. Benutzer nicht gefunden." }, { status: 404 });
    }

    console.log(`✅ [PUT /api/users/${id}] Benutzer erfolgreich aktualisiert:`, rows[0].email);
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
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
