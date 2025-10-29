// src/app/api/users/[id]/route.ts - KORRIGIERT für semrush_tracking_id_02

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
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    // Berechtigungsprüfung: Admins ODER der Benutzer selbst
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN';
    const isOwnProfile = session.user.id === id;

    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    console.log(`[GET /api/users/${id}] Benutzerdaten abrufen... (angefragt von: ${session.user.email})`);

    // ✅ KORRIGIERT: Keine ::text Casts bei VARCHAR/Text-Feldern
    const { rows } = await sql<User>`
      SELECT
        id::text as id,
        email,
        role,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id,
        semrush_tracking_id,
        semrush_tracking_id_02
      FROM users
      WHERE id = ${id}::uuid;
    `;

    if (rows.length === 0) {
      console.warn(`[GET /api/users/${id}] Benutzer nicht gefunden`);
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    
    console.log(`[GET /api/users/${id}] ✅ Benutzer gefunden:`, rows[0].email);
    console.log(`[GET /api/users/${id}] Semrush Tracking ID 02:`, rows[0].semrush_tracking_id_02);
    
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
    // Berechtigungsprüfung: Nur Admins dürfen Updates durchführen
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
        semrush_tracking_id_02,
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
    console.log(`[PUT /api/users/${id}] Semrush Project ID: ${semrush_project_id}`);
    console.log(`[PUT /api/users/${id}] Semrush Tracking ID: ${semrush_tracking_id}`);
    console.log(`[PUT /api/users/${id}] Semrush Tracking ID 02: ${semrush_tracking_id_02}`);

    // Passwort hashen, falls vorhanden
    let hashedPassword = null;
    if (password && password.trim().length > 0) {
      hashedPassword = await bcrypt.hash(password, 10);
      console.log(`  - [PUT /api/users/${id}] Passwort wird aktualisiert.`);
    }

    // ✅ KORRIGIERT: Unified UPDATE Query für alle Szenarien
    const { rows } = await sql<User>`
      UPDATE users
      SET 
        email = ${normalizedEmail},
        domain = ${domain || null},
        gsc_site_url = ${gsc_site_url || null},
        ga4_property_id = ${ga4_property_id || null},
        semrush_project_id = ${semrush_project_id || null},
        semrush_tracking_id = ${semrush_tracking_id || null},
        semrush_tracking_id_02 = ${semrush_tracking_id_02 || null},
        password = ${hashedPassword || null}
      WHERE id = ${id}::uuid
      RETURNING
        id::text as id, 
        email, 
        role, 
        domain, 
        gsc_site_url, 
        ga4_property_id, 
        semrush_project_id, 
        semrush_tracking_id,
        semrush_tracking_id_02;
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: "Update fehlgeschlagen. Benutzer nicht gefunden." }, { status: 404 });
    }

    console.log(`✅ [PUT /api/users/${id}] Benutzer erfolgreich aktualisiert:`, rows[0].email);
    console.log(`✅ [PUT /api/users/${id}] Semrush Tracking ID 02 nach Update:`, rows[0].semrush_tracking_id_02);
    
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
    // Berechtigungsprüfung: Nur Admins
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
