// src/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  // Der '@ts-ignore'-Kommentar wurde hier entfernt
  if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { email, password, domain, gsc_site_url, ga4_property_id } = await request.json();

    if (!email || !password || !domain || !gsc_site_url || !ga4_property_id) {
      return NextResponse.json({ message: 'Alle Felder sind erforderlich' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Der '@ts-ignore'-Kommentar wurde hier entfernt
    const adminId = session.user.id; 

    await sql`
      INSERT INTO users (email, password, role, domain, gsc_site_url, ga4_property_id, "createdByAdminId")
      VALUES (${email.toLowerCase()}, ${hashedPassword}, 'BENUTZER', ${domain}, ${gsc_site_url}, ${ga4_property_id}, ${adminId})
    `;

    return NextResponse.json({ message: 'Benutzer erfolgreich erstellt' }, { status: 201 });
  } catch (error) {
    console.error('Fehler beim Erstellen des Benutzers:', error);
    // Geben Sie eine spezifischere Fehlermeldung bei doppelten E-Mails zurück
    if (error instanceof Error && error.message.includes('duplicate key value violates unique constraint "users_email_key"')) {
      return NextResponse.json({ message: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Fehler beim Erstellen des Benutzers' }, { status: 500 });
  }
}
