// src/app/api/reset-password/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Nur Superadmins dürfen Passwörter zurücksetzen
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json({ 
        message: 'E-Mail und neues Passwort erforderlich' 
      }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ 
        message: 'Passwort muss mindestens 6 Zeichen lang sein' 
      }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('[RESET-PASSWORD] Passwort-Reset für:', normalizedEmail);

    // Prüfe, ob Benutzer existiert
    const { rows: existingUsers } = await sql`
      SELECT id, email, role FROM users WHERE email = ${normalizedEmail}
    `;

    if (existingUsers.length === 0) {
      console.log('[RESET-PASSWORD] ❌ Benutzer nicht gefunden');
      return NextResponse.json({ 
        message: 'Benutzer nicht gefunden' 
      }, { status: 404 });
    }

    const user = existingUsers[0];
    console.log('[RESET-PASSWORD] Benutzer gefunden:', user.email, 'Rolle:', user.role);

    // Neues Passwort hashen
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('[RESET-PASSWORD] Neues Hash erstellt, Länge:', hashedPassword.length);

    // Passwort in DB aktualisieren
    const { rows: updatedUsers } = await sql`
      UPDATE users
      SET password = ${hashedPassword}
      WHERE email = ${normalizedEmail}
      RETURNING id, email, role;
    `;

    if (updatedUsers.length === 0) {
      console.log('[RESET-PASSWORD] ❌ Update fehlgeschlagen');
      return NextResponse.json({ 
        message: 'Passwort-Update fehlgeschlagen' 
      }, { status: 500 });
    }

    console.log('[RESET-PASSWORD] ✅ Passwort erfolgreich zurückgesetzt');

    return NextResponse.json({ 
      message: `✅ Passwort für ${user.email} erfolgreich zurückgesetzt`,
      benutzer: {
        id: user.id,
        email: user.email,
        rolle: user.role
      },
      neuesPasswort: newPassword,
      hinweis: 'Bitte sofort einloggen und das Passwort ändern'
    }, { status: 200 });

  } catch (error) {
    console.error('[RESET-PASSWORD] Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Zurücksetzen des Passworts',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
