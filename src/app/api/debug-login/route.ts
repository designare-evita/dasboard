// src/app/api/debug-login/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ✅ Typdefinitionen für bessere Type-Safety
interface PasswordCheck {
  gueltig: boolean;
  eingegebenesPasswortLaenge: number;
  mitTrimGueltig?: boolean;
}

interface BenutzerDetails {
  id: string;
  email: string;
  rolle: string;
  hashLaenge: number;
  hashPrefix: string;
}

interface Diagnostics {
  eingabeEmail: string;
  normalisierteEmail: string;
  benutzerGefunden: boolean;
  timestamp: string;
  fehler?: string;
  aehnlicheEmails?: string[];
  benutzerDetails?: BenutzerDetails;
  passwortCheck?: PasswordCheck;
  hinweis?: string;
  ergebnis?: string;
  empfehlung?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Nur Superadmins dürfen diese Diagnose verwenden
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ 
        message: 'E-Mail und Passwort erforderlich' 
      }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    console.log('[DEBUG-LOGIN] Diagnose gestartet');
    console.log('[DEBUG-LOGIN] Eingegebene E-Mail:', email);
    console.log('[DEBUG-LOGIN] Normalisierte E-Mail:', normalizedEmail);

    // Suche Benutzer in der Datenbank
    const { rows } = await sql`
      SELECT id, email, password, role 
      FROM users 
      WHERE email = ${normalizedEmail}
    `;

    const diagnostics: Diagnostics = {
      eingabeEmail: email,
      normalisierteEmail: normalizedEmail,
      benutzerGefunden: rows.length > 0,
      timestamp: new Date().toISOString()
    };

    if (rows.length === 0) {
      console.log('[DEBUG-LOGIN] ❌ Kein Benutzer gefunden');
      
      // Suche nach ähnlichen E-Mails
      const { rows: similar } = await sql`
        SELECT email, role 
        FROM users 
        WHERE email ILIKE ${`%${email.split('@')[0]}%`}
        LIMIT 5
      `;
      
      diagnostics.fehler = 'Kein Benutzer mit dieser E-Mail gefunden';
      diagnostics.aehnlicheEmails = similar.map(u => u.email);
      
      return NextResponse.json(diagnostics, { status: 404 });
    }

    const user = rows[0];
    console.log('[DEBUG-LOGIN] ✅ Benutzer gefunden:', user.email);
    console.log('[DEBUG-LOGIN] Rolle:', user.role);
    console.log('[DEBUG-LOGIN] Hash-Länge:', user.password?.length || 0);

    diagnostics.benutzerDetails = {
      id: user.id,
      email: user.email,
      rolle: user.role,
      hashLaenge: user.password?.length || 0,
      hashPrefix: user.password?.substring(0, 10) + '...'
    };

    // Teste Passwort
    if (!user.password) {
      console.log('[DEBUG-LOGIN] ❌ Kein Passwort-Hash in DB');
      diagnostics.fehler = 'Benutzer hat kein Passwort gesetzt';
      return NextResponse.json(diagnostics, { status: 500 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('[DEBUG-LOGIN] Passwort gültig:', isPasswordValid);

    // ✅ Initialisiere passwortCheck mit vollständigem Objekt
    diagnostics.passwortCheck = {
      gueltig: isPasswordValid,
      eingegebenesPasswortLaenge: password.length
    };

    if (!isPasswordValid) {
      // Teste auch mit Whitespace-Varianten
      const trimmedPassword = password.trim();
      const isTrimmedValid = await bcrypt.compare(trimmedPassword, user.password);
      
      // ✅ Jetzt ist passwortCheck definiert und kann erweitert werden
      diagnostics.passwortCheck.mitTrimGueltig = isTrimmedValid;
      
      if (isTrimmedValid) {
        diagnostics.hinweis = 'Passwort ist mit trim() gültig - möglicherweise Whitespace-Problem';
      }
    }

    if (isPasswordValid) {
      diagnostics.ergebnis = '✅ Login sollte funktionieren - E-Mail und Passwort sind korrekt';
    } else {
      diagnostics.ergebnis = '❌ Passwort stimmt nicht überein';
      diagnostics.empfehlung = 'Passwort für diesen Benutzer zurücksetzen';
    }

    return NextResponse.json(diagnostics, { status: 200 });

  } catch (error) {
    console.error('[DEBUG-LOGIN] Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Fehler bei der Diagnose',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
