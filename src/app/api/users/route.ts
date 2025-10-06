import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { User } from '@/types';

// Holt alle Benutzer (für die Admin-Übersicht)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error 'role' ist eine benutzerdefinierte Eigenschaft des Session-Benutzers
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { rows } = await sql<User>`SELECT id, email, domain FROM users WHERE role = 'BENUTZER'`;
    return NextResponse.json(rows);
  } catch (error: unknown) { // 'any' durch 'unknown' ersetzen
    console.error('Fehler beim Abrufen der Benutzer:', error);
    return NextResponse.json({ message: 'Fehler beim Abrufen der Benutzer' }, { status: 500 });
  }
}

// Erstellt einen neuen Benutzer (Kunden)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error 'role' ist eine benutzerdefinierte Eigenschaft des Session-Benutzers
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }
  
  try {
      const { email, password, domain, gsc_site_url, ga4_property_id } = await request.json();

      if (!email || !password || !domain || !gsc_site_url || !ga4_property_id) {
          return NextResponse.json({ message: 'Alle Felder sind erforderlich' }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      await sql`
          INSERT INTO users (email, password, role, domain, gsc_site_url, ga4_property_id)
          VALUES (${email.toLowerCase()}, ${hashedPassword}, 'BENUTZER', ${domain}, ${gsc_site_url}, ${ga4_property_id})
      `;
      
      return NextResponse.json({ message: 'Benutzer erfolgreich erstellt' }, { status: 201 });

  } catch (error: unknown) { // 'any' durch 'unknown' ersetzen
    // Spezifischere Fehlerbehandlung für doppelte E-Mails
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') { 
        return NextResponse.json({ message: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.' }, { status: 409 });
    }
    console.error('Fehler beim Erstellen des Benutzers:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
