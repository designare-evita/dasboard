// src/app/api/manage-landingpages/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

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
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }
        .header h1 {
          color: #1a202c;
          font-size: 32px;
          margin-bottom: 10px;
        }
        .header p {
          color: #718096;
          font-size: 16px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 768px) {
          .grid { grid-template-columns: 1fr; }
        }
        .card {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .card h2 {
          color: #1a202c;
          font-size: 20px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .select, .button {
          width: 100%;
          padding: 12px 16px;
          font-size: 16px;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
          margin-top: 10px;
        }
        .select:focus {
          outline: none;
          border-color: #667eea;
        }
        .button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          cursor: pointer;
          font-weight: 600;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
        }
        .button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .button-secondary {
          background: #48bb78;
        }
        .button-danger {
          background: #f56565;
        }
        #result {
          margin-top: 20px;
          padding: 20px;
          border-radius: 8px;
          display: none;
        }
        .success {
          background: #c6f6d5;
          border: 2px solid #48bb78;
          color: #22543d;
        }
        .error {
          background: #fed7d7;
          border: 2px solid #f56565;
          color: #742a2a;
        }
        .info {
          background: #bee3f8;
          border: 2px solid #4299e1;
          color: #2c5282;
        }
        pre {
          background: #f7fafc;
          padding: 15px;
          border-radius: 8px;
          overflow-x: auto;
          margin-top: 10px;
          border: 1px solid #e2e8f0;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }
        .stat {
          background: #f7fafc;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
        }
        .stat-value {
          font-size: 32px;
          font-weight: bold;
          color: #667eea;
        }
        .stat-label {
          color: #718096;
          font-size: 14px;
          margin-top: 5px;
        }
        .loading {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 Landingpages Manager</h1>
          <p>Verwalten und debuggen Sie Landingpages für Ihre Kunden</p>
        </div>

        <div class="grid">
          <!-- Debug: Alle Landingpages anzeigen -->
          <div class="card">
            <h2>🔍 Debug-Informationen</h2>
            <button class="button" onclick="debugLandingpages()">
              Alle Landingpages anzeigen
            </button>
            <p style="color: #718096; font-size: 14px; margin-top: 10px;">
              Zeigt alle Landingpages, User-Zuordnungen und Status-Verteilung
            </p>
          </div>

          <!-- Test-Landingpages erstellen -->
          <div class="card">
            <h2>➕ Test-Daten erstellen</h2>
            <select id="userSelect" class="select">
              <option value="">Lade Benutzer...</option>
            </select>
            <button class="button button-secondary" onclick="createTestPages()" id="createBtn" disabled>
              5 Test-Landingpages erstellen
            </button>
            <p style="color: #718096; font-size: 14px; margin-top: 10px;">
              Erstellt 5 Beispiel-Landingpages mit verschiedenen Status
            </p>
          </div>
        </div>

        <!-- Batch-Operationen -->
        <div class="card" style="margin-bottom: 20px;">
          <h2>⚡ Batch-Operationen</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
            <button class="button button-secondary" onclick="createForAllCustomers()">
              Für ALLE Kunden erstellen
            </button>
            <button class="button button-danger" onclick="deleteAllLandingpages()">
              ALLE Landingpages löschen
            </button>
          </div>
          <p style="color: #e53e3e; font-size: 13px; margin-top: 10px; font-weight: 600;">
            ⚠️ Vorsicht: Batch-Operationen betreffen alle Kunden!
          </p>
        </div>

        <!-- Ergebnis-Anzeige -->
        <div id="result"></div>
      </div>

      <script>
        let users = [];

        // Benutzer laden beim Start
        async function loadUsers() {
          try {
            const response = await fetch('/api/users');
            const data = await response.json();
            users = data.filter(u => u.role === 'BENUTZER');
            
            const select = document.getElementById('userSelect');
            select.innerHTML = '<option value="">-- Kunde auswählen --</option>' +
              users.map(u => \`<option value="\${u.id}">\${u.domain || u.email}</option>\`).join('');
            
            document.getElementById('createBtn').disabled = false;
          } catch (err) {
            showResult('error', 'Fehler beim Laden der Benutzer: ' + err.message);
          }
        }

        function showResult(type, message, data = null) {
          const resultDiv = document.getElementById('result');
          resultDiv.className = type;
          resultDiv.style.display = 'block';
          
          let html = '<strong>' + message + '</strong>';
          if (data) {
            html += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
          }
          resultDiv.innerHTML = html;
          
          // Scroll zu Ergebnis
          resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function showLoading() {
          const resultDiv = document.getElementById('result');
          resultDiv.className = 'info';
          resultDiv.style.display = 'block';
          resultDiv.innerHTML = '<div class="loading"></div> <strong>Lädt...</strong>';
        }

        async function debugLandingpages() {
          showLoading();
          try {
            const response = await fetch('/api/debug-landingpages');
            const data = await response.json();
            
            if (response.ok) {
              showResult('success', \`✅ Debug-Informationen geladen\`, data);
            } else {
              showResult('error', \`❌ \${data.message}\`, data);
            }
          } catch (err) {
            showResult('error', 'Fehler beim Debug: ' + err.message);
          }
        }

        async function createTestPages() {
          const userId = document.getElementById('userSelect').value;
          if (!userId) {
            showResult('error', 'Bitte wählen Sie einen Kunden aus');
            return;
          }

          showLoading();
          try {
            const response = await fetch(\`/api/create-test-landingpages?userId=\${userId}\`);
            const data = await response.json();
            
            if (response.ok) {
              showResult('success', \`✅ \${data.created} Test-Landingpages erstellt für \${data.user.email}\`, data);
            } else {
              showResult('error', \`❌ \${data.message}\`, data);
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
              showResult('success', \`✅ Batch-Erstellung abgeschlossen\`, data);
            } else {
              showResult('error', \`❌ \${data.message}\`, data);
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
