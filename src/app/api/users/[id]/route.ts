// src/app/api/users/[id]/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

// Handler zum Abrufen eines einzelnen Benutzers
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { email, role, domain, gsc_site_url, ga4_property_id, password } = body;

    // Validierung: Pflichtfelder prüfen
    if (!email) {
      return NextResponse.json({ message: 'E-Mail ist erforderlich' }, { status: 400 });
    }

    // Wenn role nicht angegeben ist, aktuellen Wert beibehalten
    let finalRole = role;
    if (!finalRole) {
      const { rows: currentUser } = await sql`
        SELECT role FROM users WHERE id = ${id}
      `;
      if (currentUser.length > 0) {
        finalRole = currentUser[0].role;
      }
    }

    let updateQuery;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery = sql`
        UPDATE users
        SET 
          email = ${email},
          role = ${finalRole},
          domain = ${domain},
          gsc_site_url = ${gsc_site_url},
          ga4_property_id = ${ga4_property_id},
          password = ${hashedPassword}
        WHERE id = ${id}
        RETURNING id, email, role, domain, gsc_site_url, ga4_property_id;
      `;
    } else {
      updateQuery = sql`
        UPDATE users
        SET 
          email = ${email},
          role = ${finalRole},
          domain = ${domain},
          gsc_site_url = ${gsc_site_url},
          ga4_property_id = ${ga4_property_id}
        WHERE id = ${id}
        RETURNING id, email, role, domain, gsc_site_url, ga4_property_id;
      `;
    }

    const { rows } = await updateQuery;

    if (rows.length === 0) {
      return NextResponse.json({ message: "Benutzer nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Benutzers:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Löschen eines Benutzers
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
