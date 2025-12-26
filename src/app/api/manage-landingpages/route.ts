// src/app/api/manage-landingpages/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; 

export async function GET() {
  const session = await auth();
  
  // 1. Berechtigungs-Check
  if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  // ==========================================
  // 2. DEMO-SCHUTZ (NEU)
  // ==========================================
  if (session.user.is_demo) {
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Demo Modus</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f3f4f6; }
            .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
            h1 { color: #1e40af; margin-bottom: 1rem; }
            p { color: #4b5563; margin-bottom: 1.5rem; }
            a { color: #2563eb; text-decoration: none; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Demo Modus aktiv</h1>
            <p>Aus Sicherheitsgründen ist das Landingpage-Management-Tool im Demo-Modus deaktiviert.</p>
            <a href="/dashboard">Zurück zum Dashboard</a>
          </div>
        </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
  // ==========================================

  // 3. Normales HTML-Tool ausgeben (Für echte Admins)
  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Landingpages Manager</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        h1 { color: #1a202c; font-size: 24px; }
        .badge {
          background: #ebf8ff;
          color: #3182ce;
          padding: 5px 12px;
          border-radius: 9999px;
          font-size: 14px;
          font-weight: 600;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .card {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          transition: transform 0.2s;
        }
        .card:hover { transform: translateY(-5px); }
        .card h2 { margin-bottom: 15px; color: #2d3748; font-size: 18px; }
        .card p { color: #718096; font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
        
        button {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary { background: #4c51bf; color: white; }
        .btn-primary:hover { background: #434190; }
        
        .btn-danger { background: #e53e3e; color: white; }
        .btn-danger:hover { background: #c53030; }
        
        .btn-warning { background: #d69e2e; color: white; }
        .btn-warning:hover { background: #b7791f; }

        .result-area {
          background: #1a202c;
          color: #a0aec0;
          padding: 20px;
          border-radius: 12px;
          font-family: monospace;
          white-space: pre-wrap;
          min-height: 200px;
          max-height: 500px;
          overflow-y: auto;
        }
        .log-entry { margin-bottom: 5px; border-bottom: 1px solid #2d3748; padding-bottom: 5px; }
        .log-success { color: #48bb78; }
        .log-error { color: #f56565; }
        .log-info { color: #4299e1; }

        .user-select {
          width: 100%;
          padding: 10px;
          margin-bottom: 15px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }
        .loading { opacity: 0.7; pointer-events: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>
            <h1>🛠️ Landingpages Manager</h1>
            <p style="color: #718096; margin-top: 5px;">System-Tools für Administratoren</p>
          </div>
          <span class="badge">ADMIN AREA</span>
        </div>

        <div class="grid">
          <div class="card">
            <h2>👤 Einzelner Kunde</h2>
            <p>Erstellt Test-Landingpages für einen spezifischen Kunden.</p>
            <select id="userSelect" class="user-select">
              <option value="">Lade Benutzer...</option>
            </select>
            <button class="btn-primary" onclick="createForUser()">Für Kunde erstellen</button>
          </div>

          <div class="card">
            <h2>🚀 Batch Operation</h2>
            <p>Erstellt Test-Landingpages für <strong>ALLE</strong> Kunden, die noch keine haben.</p>
            <button class="btn-warning" onclick="createForAllCustomers()">Batch Starten</button>
          </div>

          <div class="card">
            <h2>⚠️ Danger Zone</h2>
            <p>Löscht alle Landingpages aus der Datenbank.</p>
            <button class="btn-danger" onclick="deleteAllLandingpages()">Alles Löschen</button>
          </div>
        </div>

        <div class="result-area" id="console">
          <div class="log-info">> System bereit...</div>
        </div>
      </div>

      <script>
        const consoleDiv = document.getElementById('console');
        const userSelect = document.getElementById('userSelect');

        function log(msg, type = 'info') {
          const div = document.createElement('div');
          div.className = 'log-entry log-' + type;
          div.textContent = '> ' + msg;
          consoleDiv.insertBefore(div, consoleDiv.firstChild);
        }

        async function loadUsers() {
          try {
            const res = await fetch('/api/projects'); // Nutzt existierende API
            const data = await res.json();
            
            userSelect.innerHTML = '<option value="">Bitte Kunde wählen...</option>';
            
            if (data.projects) {
              data.projects.forEach(user => {
                const opt = document.createElement('option');
                opt.value = user.id;
                opt.textContent = user.email + ' (' + (user.domain || 'Keine Domain') + ')';
                userSelect.appendChild(opt);
              });
              log('Benutzerliste geladen: ' + data.projects.length + ' Kunden', 'success');
            }
          } catch (e) {
            log('Fehler beim Laden der Benutzer: ' + e.message, 'error');
          }
        }

        function showLoading() {
          document.body.classList.add('loading');
          log('Verarbeite Anfrage...', 'info');
        }

        function hideLoading() {
          document.body.classList.remove('loading');
        }

        function showResult(type, message, data) {
          hideLoading();
          log(message, type);
          if (data && data.details) {
            log(JSON.stringify(data.details, null, 2), 'info');
          }
        }

        async function createForUser() {
          const userId = userSelect.value;
          if (!userId) return alert('Bitte einen Benutzer wählen');

          showLoading();
          try {
            const response = await fetch('/api/create-test-landingpages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetUserId: userId })
            });
            const data = await response.json();
            
            if (response.ok) {
              showResult('success', '✅ Erstellt für ' + userId, data);
            } else {
              showResult('error', '❌ ' + data.message, data);
            }
          } catch (err) {
            showResult('error', 'Fehler beim Erstellen: ' + err.message);
          }
        }

        async function createForAllCustomers() {
          if (!confirm('Wirklich für ALLE Kunden Test-Landingpages erstellen?')) {
            return;
          }

          showLoading();
          try {
            const response = await fetch('/api/create-test-landingpages', {
              method: 'POST'
            });
            const data = await response.json();
            
            if (response.ok) {
              showResult('success', '✅ Batch-Erstellung abgeschlossen', data);
            } else {
              showResult('error', '❌ ' + data.message, data);
            }
          } catch (err) {
            showResult('error', 'Fehler beim Batch-Erstellen: ' + err.message);
          }
        }

        async function deleteAllLandingpages() {
          if (!confirm('⚠️ WARNUNG: Wirklich ALLE Landingpages löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
            return;
          }
          
          if (!confirm('Sind Sie ABSOLUT SICHER? Alle Landingpages werden gelöscht!')) {
            return;
          }

          showResult('error', '⛔ Diese Funktion ist aus Sicherheitsgründen deaktiviert. Bitte manuell in der Datenbank löschen.');
        }

        // Benutzer beim Laden laden
        loadUsers();
      </script>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
