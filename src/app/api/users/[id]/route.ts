// src/app/api/users/[id]/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

// Handler zum Abrufen eines einzelnen Benutzers
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { rows } = await sql`
      SELECT id, email, role, domain, gsc_site_url, ga4_property_id 
      FROM users 
      WHERE id = ${params.id}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error(`Fehler beim Abrufen des Benutzers ${params.id}:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Aktualisieren eines Benutzers
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { email, role, domain, gsc_site_url, ga4_property_id, password } = body;

    let hashedPassword;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }
    
    // KORREKTUR: Prisma-Befehl durch SQL ersetzt
    const { rows } = await sql`
      UPDATE users
      SET 
        email = ${email},
        role = ${role},
        domain = ${domain},
        gsc_site_url = ${gsc_site_url},
        ga4_property_id = ${ga4_property_id}
        ${password ? sql`, password = ${hashedPassword}` : sql``}
      WHERE id = ${params.id}
      RETURNING id, email, role, domain;
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error(`Fehler beim Aktualisieren des Benutzers ${params.id}:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Löschen eines Benutzers
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // KORREKTUR: Prisma-Befehl durch SQL ersetzt
    const result = await sql`
      DELETE FROM users WHERE id = ${params.id};
    `;

    if (result.rowCount === 0) {
        return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (error) {
    console.error(`Fehler beim Löschen des Benutzers ${params.id}:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
