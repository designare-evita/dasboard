// src/app/api/users/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User } from '@/types';

// GET-Funktion (unverändert)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const { rows } = await sql<User>`SELECT id, email, role, domain FROM users ORDER BY email ASC`;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ message: 'Fehler beim Abrufen der Benutzer' }, { status: 500 });
  }
}

// POST-Funktion (angepasst)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { email, password, domain, gsc_site_url, ga4_property_id, role } = await request.json();

    if (!email || !password || !role) {
      return NextResponse.json({ message: 'Fehlende erforderliche Felder' }, { status: 400 });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const creatorId = session.user.id;

    await sql`
      INSERT INTO users (email, password, domain, gsc_site_url, ga4_property_id, role, created_by) 
      VALUES (${email}, ${hashedPassword}, ${domain}, ${gsc_site_url}, ${ga4_property_id}, ${role}, ${creatorId})
    `;
    
    return NextResponse.json({ message: 'Benutzer erfolgreich erstellt' }, { status: 201 });

  } catch (error: unknown) { // HIER IST DIE KORREKTUR: 'any' wurde durch 'unknown' ersetzt
    // Wir müssen den Typ von 'error' prüfen, bevor wir auf Eigenschaften zugreifen
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return NextResponse.json({ message: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.' }, { status: 409 });
    }
    console.error("Fehler beim Erstellen des Benutzers:", error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
