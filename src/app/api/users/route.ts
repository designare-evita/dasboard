import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { User } from '@/types';

// GET-Funktion bleibt unverändert...
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error 'role' ist eine benutzerdefinierte Eigenschaft des Session-Benutzers
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    // Zeigt jetzt alle Benutzer außer dem Superadmin an
    const { rows } = await sql<User>`SELECT id, email, domain, role FROM users WHERE role != 'SUPERADMIN'`;
    return NextResponse.json(rows);
  } catch (error: unknown) {
    console.error('Fehler beim Abrufen der Benutzer:', error);
    return NextResponse.json({ message: 'Fehler beim Abrufen der Benutzer' }, { status: 500 });
  }
}

// POST-Funktion angepasst
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  // @ts-expect-error 'role' ist eine benutzerdefinierte Eigenschaft des Session-Benutzers
  if (!session?.user || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nur Super-Admins können neue Benutzer erstellen.' }, { status: 403 });
  }
  
  try {
      const { email, password, role, domain, gsc_site_url, ga4_property_id } = await request.json();

      if (!email || !password || !role) {
          return NextResponse.json({ message: 'E-Mail, Passwort und Rolle sind erforderlich' }, { status: 400 });
      }

      // Prüfen, ob die Rolle gültig ist (nur 'ADMIN' oder 'BENUTZER')
      if (role !== 'ADMIN' && role !== 'BENUTZER') {
          return NextResponse.json({ message: 'Ungültige Rolle' }, { status: 400 });
      }

      // Kundenspezifische Felder sind nur für die Rolle 'BENUTZER' erforderlich
      if (role === 'BENUTZER' && (!domain || !gsc_site_url || !ga4_property_id)) {
          return NextResponse.json({ message: 'Für Kunden müssen Domain, GSC Site URL und GA4 Property ID angegeben werden.' }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      await sql`
          INSERT INTO users (email, password, role, domain, gsc_site_url, ga4_property_id)
          VALUES (${email.toLowerCase()}, ${hashedPassword}, ${role}, ${domain || null}, ${gsc_site_url || null}, ${ga4_property_id || null})
      `;
      
      return NextResponse.json({ message: `Benutzer mit der Rolle ${role} erfolgreich erstellt` }, { status: 201 });

  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') { 
        return NextResponse.json({ message: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.' }, { status: 409 });
    }
    console.error('Fehler beim Erstellen des Benutzers:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
