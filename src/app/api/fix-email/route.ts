// src/app/api/fix-email/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET-Handler für Browser-Zugriff (zeigt Formular)
export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>E-Mail korrigieren</title>
      <style>
        body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
        input, button { width: 100%; padding: 12px; margin: 8px 0; font-size: 16px; }
        button { background: #4f46e5; color: white; border: none; cursor: pointer; border-radius: 6px; }
        button:hover { background: #4338ca; }
        #result { margin-top: 20px; padding: 15px; border-radius: 6px; }
        .success { background: #d1fae5; border: 1px solid #10b981; }
        .error { background: #fee2e2; border: 1px solid #ef4444; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
        pre { background: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto; }
        label { display: block; margin-top: 10px; font-weight: 500; }
      </style>
    </head>
    <body>
      <h1>📧 E-Mail-Adresse korrigieren</h1>
      
      <div class="warning">
        <strong>⚠️ Achtung:</strong> Nur für Superadmins. Diese Funktion ändert die E-Mail-Adresse eines Benutzers in der Datenbank.
      </div>
      
      <form id="fixForm">
        <label for="oldEmail">Aktuelle E-Mail (in der Datenbank):</label>
        <input 
          type="email" 
          id="oldEmail" 
          placeholder="z.B. felix-kernstock@max-online.at" 
          value="felix-kernstock@max-online.at"
          required 
        />
        
        <label for="newEmail">Neue E-Mail:</label>
        <input 
          type="email" 
          id="newEmail" 
          placeholder="z.B. felix.kernstock@max-online.at" 
          value="felix.kernstock@max-online.at"
          required 
        />
        
        <button type="submit">E-Mail ändern</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        document.getElementById('fixForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '<p>Ändere E-Mail-Adresse...</p>';
          
          try {
            const response = await fetch('/api/fix-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                oldEmail: document.getElementById('oldEmail').value,
                newEmail: document.getElementById('newEmail').value
              })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              resultDiv.className = 'success';
              resultDiv.innerHTML = '<h3>✅ E-Mail erfolgreich geändert!</h3><pre>' + 
                JSON.stringify(data, null, 2) + '</pre>' +
                '<p><strong>Der Benutzer kann sich jetzt mit der neuen E-Mail einloggen.</strong></p>';
            } else {
              resultDiv.className = 'error';
              resultDiv.innerHTML = '<h3>❌ Fehler beim Ändern</h3><pre>' + 
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
    
    // Nur Superadmins dürfen E-Mails ändern
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { oldEmail, newEmail } = await request.json();

    if (!oldEmail || !newEmail) {
      return NextResponse.json({ 
        message: 'Alte und neue E-Mail-Adresse erforderlich' 
      }, { status: 400 });
    }

    const normalizedOldEmail = oldEmail.toLowerCase().trim();
    const normalizedNewEmail = newEmail.toLowerCase().trim();
    
    console.log('[FIX-EMAIL] E-Mail-Änderung:');
    console.log('  Alt:', normalizedOldEmail);
    console.log('  Neu:', normalizedNewEmail);

    // Prüfe, ob Benutzer mit alter E-Mail existiert
    const { rows: existingUsers } = await sql`
      SELECT id, email, role FROM users WHERE email = ${normalizedOldEmail}
    `;

    if (existingUsers.length === 0) {
      console.log('[FIX-EMAIL] ❌ Benutzer mit alter E-Mail nicht gefunden');
      
      // Suche nach ähnlichen E-Mails
      const { rows: similar } = await sql`
        SELECT email FROM users 
        WHERE email ILIKE ${`%${oldEmail.split('@')[0]}%`}
        LIMIT 5
      `;
      
      return NextResponse.json({ 
        message: 'Benutzer mit der alten E-Mail-Adresse nicht gefunden',
        aehnlicheEmails: similar.map(u => u.email)
      }, { status: 404 });
    }

    const user = existingUsers[0];
    console.log('[FIX-EMAIL] Benutzer gefunden:', user.email, 'Rolle:', user.role, 'ID:', user.id);

    // Prüfe, ob neue E-Mail bereits existiert
    const { rows: duplicateCheck } = await sql`
      SELECT id, email FROM users WHERE email = ${normalizedNewEmail}
    `;

    if (duplicateCheck.length > 0) {
      console.log('[FIX-EMAIL] ❌ Neue E-Mail bereits vergeben');
      return NextResponse.json({ 
        message: 'Die neue E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet' 
      }, { status: 409 });
    }

    // E-Mail in DB aktualisieren
    const { rows: updatedUsers } = await sql`
      UPDATE users
      SET email = ${normalizedNewEmail}
      WHERE email = ${normalizedOldEmail}
      RETURNING id, email, role;
    `;

    if (updatedUsers.length === 0) {
      console.log('[FIX-EMAIL] ❌ Update fehlgeschlagen');
      return NextResponse.json({ 
        message: 'E-Mail-Update fehlgeschlagen' 
      }, { status: 500 });
    }

    console.log('[FIX-EMAIL] ✅ E-Mail erfolgreich geändert');
    console.log('  Neue E-Mail in DB:', updatedUsers[0].email);

    return NextResponse.json({ 
      message: `✅ E-Mail erfolgreich von ${normalizedOldEmail} zu ${normalizedNewEmail} geändert`,
      benutzer: {
        id: updatedUsers[0].id,
        email: updatedUsers[0].email,
        rolle: updatedUsers[0].role
      },
      hinweis: 'Der Benutzer kann sich jetzt mit der neuen E-Mail einloggen'
    }, { status: 200 });

  } catch (error) {
    console.error('[FIX-EMAIL] Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Ändern der E-Mail',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
