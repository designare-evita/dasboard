// src/app/api/users/[id]/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ✨ KORREKTUR für Next.js 15+: params ist ein Promise
type RouteHandlerParams = {
  params: Promise<{ id: string }>;
};

// Handler zum Abrufen eines einzelnen Benutzers
export async function GET(request: Request, { params }: RouteHandlerParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { id } = await params; // ✨ Wichtig: params mit await auflösen
    const { rows } = await sql`
      SELECT id, email, role, domain, gsc_site_url, ga4_property_id 
      FROM users 
      WHERE id = ${id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Aktualisieren eines Benutzers
export async function PUT(request: Request, { params }: RouteHandlerParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { id } = await params; // ✨ Wichtig: params mit await auflösen
    const body = await request.json();
    const { email, role, domain, gsc_site_url, ga4_property_id, password } = body;

    if (!email) {
      return NextResponse.json({ message: 'E-Mail ist erforderlich' }, { status: 400 });
    }
    
    const { rows: existingUsers } = await sql`SELECT role FROM users WHERE id = ${id}`;
    if (existingUsers.length === 0) {
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }
    const finalRole = role || existingUsers[0].role;

    let updateQuery;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery = sql`
        UPDATE users
        SET email = ${email}, role = ${finalRole}, domain = ${domain}, gsc_site_url = ${gsc_site_url}, ga4_property_id = ${ga4_property_id}, password = ${hashedPassword}
        WHERE id = ${id}
        RETURNING id, email, role, domain, gsc_site_url, ga4_property_id;
      `;
    } else {
      updateQuery = sql`
        UPDATE users
        SET email = ${email}, role = ${finalRole}, domain = ${domain}, gsc_site_url = ${gsc_site_url}, ga4_property_id = ${ga4_property_id}
        WHERE id = ${id}
        RETURNING id, email, role, domain, gsc_site_url, ga4_property_id;
      `;
    }

    const { rows } = await updateQuery;

    if (rows.length === 0) {
      return NextResponse.json({ message: "Update fehlgeschlagen. Benutzer nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Benutzers:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Löschen eines Benutzers
export async function DELETE(request: Request, { params }: RouteHandlerParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { id } = await params; // ✨ Wichtig: params mit await auflösen
    const result = await sql`
      DELETE FROM users WHERE id = ${id};
    `;

    if (result.rowCount === 0) {
        return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Benutzers:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
