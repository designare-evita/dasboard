import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User } from '@/types';

// NEU: GET-Funktion zum Abrufen der Benutzerliste
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    let users;
    if (session.user.role === 'SUPERADMIN') {
      // Super-Admin sieht alle Benutzer mit der Rolle 'BENUTZER'
      console.log('Abrufen aller Kunden für Super-Admin');
      const data = await sql<User>`SELECT id, email, domain, role, "createdAt" FROM users WHERE role = 'BENUTZER' ORDER BY "createdAt" DESC`;
      users = data.rows;
    } else {
      // Normaler Admin sieht nur die Kunden, die er selbst erstellt hat
      console.log(`Abrufen der Kunden für Admin ID: ${session.user.id}`);
      const data = await sql<User>`SELECT id, email, domain, role, "createdAt" FROM users WHERE "createdByAdminId" = ${session.user.id} ORDER BY "createdAt" DESC`;
      users = data.rows;
    }
    return NextResponse.json(users);
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzerliste:', error);
    return NextResponse.json({ message: 'Fehler beim Abrufen der Benutzerliste' }, { status: 500 });
  }
}


// Bestehende POST-Funktion zum Erstellen von Benutzern
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { email, password, domain, gsc_site_url, ga4_property_id } = await request.json();

    if (!email || !password || !domain || !gsc_site_url || !ga4_property_id) {
      return NextResponse.json({ message: 'Alle Felder sind erforderlich' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const adminId = session.user.id; 

    await sql`
      INSERT INTO users (email, password, role, domain, gsc_site_url, ga4_property_id, "createdByAdminId")
      VALUES (${email.toLowerCase()}, ${hashedPassword}, 'BENUTZER', ${domain}, ${gsc_site_url}, ${ga4_property_id}, ${adminId})
    `;

    return NextResponse.json({ message: 'Benutzer erfolgreich erstellt' }, { status: 201 });
  } catch (error) {
    console.error('Fehler beim Erstellen des Benutzers:', error);
    if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint "users_email_key"')) {
      return NextResponse.json({ message: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Fehler beim Erstellen des Benutzers' }, { status: 500 });
  }
}

