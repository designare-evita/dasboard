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

// GET-Handler für Browser-Zugriff (zeigt Formular)
export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login-Diagnose</title>
      <style>
        body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
        input, button { width: 100%; padding: 12px; margin: 8px 0; font-size: 16px; }
        button { background: #4f46e5; color: white; border: none; cursor: pointer; border-radius: 6px; }
        button:hover { background: #4338ca; }
        #result { margin-top: 20px; padding: 15px; border-radius: 6px; }
        .success { background: #d1fae5; border: 1px solid #10b981; }
        .error { background: #fee2e2; border: 1px solid #ef4444; }
        pre { background: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>🔍 Login-Diagnose</h1>
      <p>Teste, ob E-Mail und Passwort korrekt sind.</p>
      
      <form id="diagForm">
        <input type="email" id="email" placeholder="E-Mail-Adresse" required />
        <input type="password" id="password" placeholder="Passwort" required />
        <button type="submit">Diagnose starten</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        document.getElementById('diagForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '<p>Diagnose läuft...</p>';
          
          try {
            const response = await fetch('/api/debug-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: document.getElementById('email').value,
                password: document.getElementById('password').value
              })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              resultDiv.className = 'success';
              resultDiv.innerHTML = '<h3>✅ Diagnose erfolgreich</h3><pre>' + 
                JSON.stringify(data, null, 2) + '</pre>';
            } else {
              resultDiv.className = 'error';
              resultDiv.innerHTML = '<h3>❌ Problem gefunden</h3><pre>' + 
                JSON.stringify(data, null, 2) + '</pre>';
            }
          } catch (err) {
            resultDiv.className = 'error';
            resultDiv.innerHTML = '<h3>❌ Fehler</h3><p>' + err.message + '</p>';
          }
        });
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// POST-Handler für API-Aufrufe
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
