// src/app/api/search-user/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET-Handler für Browser-Zugriff
export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Benutzer suchen</title>
      <style>
        body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
        input, button { padding: 12px; margin: 8px 0; font-size: 16px; }
        button { background: #4f46e5; color: white; border: none; cursor: pointer; border-radius: 6px; margin-left: 8px; }
        button:hover { background: #4338ca; }
        #result { margin-top: 20px; }
        .user-card { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .user-card h3 { margin: 0 0 10px 0; color: #1f2937; }
        .user-detail { display: flex; margin: 8px 0; }
        .user-detail strong { min-width: 120px; color: #6b7280; }
        .user-detail span { color: #111827; font-family: monospace; }
        .role-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .role-admin { background: #dbeafe; color: #1e40af; }
        .role-benutzer { background: #d1fae5; color: #065f46; }
        .role-superadmin { background: #fce7f3; color: #9f1239; }
        .search-box { display: flex; align-items: center; margin-bottom: 20px; }
        .search-box input { flex: 1; }
        pre { background: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>🔍 Benutzer suchen</h1>
      
      <div class="search-box">
        <input 
          type="text" 
          id="searchTerm" 
          placeholder="Suchbegriff (z.B. felix, kernstock, max-online)" 
          value="felix"
        />
        <button onclick="searchUsers()">Suchen</button>
        <button onclick="loadAllUsers()" style="background: #6b7280;">Alle anzeigen</button>
      </div>
      
      <div id="result"></div>
      
      <script>
        async function searchUsers() {
          const searchTerm = document.getElementById('searchTerm').value;
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '<p>Suche läuft...</p>';
          
          try {
            const response = await fetch('/api/search-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ searchTerm })
            });
            
            const data = await response.json();
            
            if (response.ok && data.users && data.users.length > 0) {
              resultDiv.innerHTML = '<h2>Gefundene Benutzer (' + data.users.length + ')</h2>' +
                data.users.map(user => \`
                  <div class="user-card">
                    <h3>\${user.email}</h3>
                    <div class="user-detail">
                      <strong>ID:</strong>
                      <span>\${user.id}</span>
                    </div>
                    <div class="user-detail">
                      <strong>Rolle:</strong>
                      <span class="role-badge role-\${user.role.toLowerCase()}">\${user.role}</span>
                    </div>
                    <div class="user-detail">
                      <strong>Domain:</strong>
                      <span>\${user.domain || '-'}</span>
                    </div>
                    <div class="user-detail">
                      <strong>E-Mail (raw):</strong>
                      <span>"\${user.email}"</span>
                    </div>
                    <div class="user-detail">
                      <strong>Länge:</strong>
                      <span>\${user.email.length} Zeichen</span>
                    </div>
                  </div>
                \`).join('');
            } else if (response.ok && data.users && data.users.length === 0) {
              resultDiv.innerHTML = '<p style="color: #6b7280;">Keine Benutzer gefunden.</p>';
            } else {
              resultDiv.innerHTML = '<p style="color: #ef4444;">Fehler: ' + (data.message || 'Unbekannter Fehler') + '</p>';
            }
          } catch (err) {
            resultDiv.innerHTML = '<p style="color: #ef4444;">Fehler: ' + err.message + '</p>';
          }
        }
        
        async function loadAllUsers() {
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '<p>Lade alle Benutzer...</p>';
          
          try {
            const response = await fetch('/api/search-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ searchTerm: '' })
            });
            
            const data = await response.json();
            
            if (response.ok && data.users) {
              resultDiv.innerHTML = '<h2>Alle Benutzer (' + data.users.length + ')</h2>' +
                data.users.map(user => \`
                  <div class="user-card">
                    <h3>\${user.email}</h3>
                    <div class="user-detail">
                      <strong>ID:</strong>
                      <span>\${user.id}</span>
                    </div>
                    <div class="user-detail">
                      <strong>Rolle:</strong>
                      <span class="role-badge role-\${user.role.toLowerCase()}">\${user.role}</span>
                    </div>
                    <div class="user-detail">
                      <strong>Domain:</strong>
                      <span>\${user.domain || '-'}</span>
                    </div>
                  </div>
                \`).join('');
            } else {
              resultDiv.innerHTML = '<p style="color: #ef4444;">Fehler beim Laden</p>';
            }
          } catch (err) {
            resultDiv.innerHTML = '<p style="color: #ef4444;">Fehler: ' + err.message + '</p>';
          }
        }
        
        // Automatisch suchen beim Laden
        searchUsers();
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// POST-Handler
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchTerm } = await request.json();

    console.log('[SEARCH-USER] Suche nach:', searchTerm);

    let users;
    
    if (!searchTerm || searchTerm.trim() === '') {
      // Alle Benutzer anzeigen
      const { rows } = await sql`
        SELECT id::text as id, email, role, domain, gsc_site_url, ga4_property_id
        FROM users
        ORDER BY role DESC, email ASC
      `;
      users = rows;
    } else {
      // Suche nach Begriff
      const searchPattern = `%${searchTerm}%`;
      const { rows } = await sql`
        SELECT id::text as id, email, role, domain, gsc_site_url, ga4_property_id
        FROM users
        WHERE 
          email ILIKE ${searchPattern} OR
          domain ILIKE ${searchPattern} OR
          id::text ILIKE ${searchPattern}
        ORDER BY role DESC, email ASC
      `;
      users = rows;
    }

    console.log('[SEARCH-USER] Gefunden:', users.length, 'Benutzer');

    return NextResponse.json({ 
      users,
      count: users.length,
      searchTerm 
    }, { status: 200 });

  } catch (error) {
    console.error('[SEARCH-USER] Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Fehler bei der Suche',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
