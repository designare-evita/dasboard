// src/app/api/users/[id]/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User } from '@/types';

// Der zweite Parameter ist ein Kontextobjekt, das die Parameter enthält.
type RouteContext = {
  params: {
    id: string;
  };
};

// Holt die Daten für einen einzelnen Benutzer
export async function GET(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const { id } = context.params; // ID aus context.params holen

  try {
    const { rows } = await sql<User>`
      SELECT id, email, role, domain, gsc_site_url, ga4_property_id 
      FROM users 
      WHERE id = ${id}`;
      
    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Aktualisiert die Daten eines Benutzers
export async function PUT(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const { id } = context.params; // ID aus context.params holen
  const body = await request.json();
  const { email, domain, gsc_site_url, ga4_property_id } = body;

  try {
    await sql`
      UPDATE users 
      SET email = ${email}, domain = ${domain}, gsc_site_url = ${gsc_site_url}, ga4_property_id = ${ga4_property_id}
      WHERE id = ${id}
    `;
    return NextResponse.json({ message: 'Benutzer erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Benutzers:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Löscht einen Benutzer
export async function DELETE(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const { id } = context.params; // ID aus context.params holen

  try {
    const userToDelete = await sql`SELECT email FROM users WHERE id = ${id}`;
    if (userToDelete.rows[0]?.email === session.user.email) {
      return NextResponse.json({ message: 'Sie können sich nicht selbst löschen.' }, { status: 403 });
    }

    await sql`DELETE FROM users WHERE id = ${id}`;
    return NextResponse.json({ message: 'Benutzer erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Benutzers:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
