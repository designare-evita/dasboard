// src/app/api/fix-semrush-columns/route.ts
// WICHTIG: Diese Route nach Verwendung wieder löschen!

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Nur Superadmins dürfen das Schema ändern
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const results: string[] = [];
    results.push('🔍 Starte Fix für Semrush-Felder...\n');

    // 1. Prüfe, ob die Tabelle existiert
    const { rows: tables } = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users';
    `;

    if (tables.length === 0) {
      return NextResponse.json({
        success: false,
        message: '❌ users-Tabelle nicht gefunden!'
      }, { status: 404 });
    }

    results.push('✅ users-Tabelle gefunden\n');

    // 2. Prüfe aktuelle Spalten
    const { rows: currentColumns } = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'users'
      AND column_name IN ('semrush_project_id', 'semrush_tracking_id');
    `;

    results.push(`📋 Aktuell gefundene Semrush-Spalten: ${currentColumns.length}\n`);
    
    if (currentColumns.length === 2) {
      results.push('✅ Beide Spalten existieren bereits!\n');
      results.push('ℹ️ Das Problem liegt vermutlich woanders.\n');
      
      // Zeige Beispieldaten
      const { rows: sampleData } = await sql`
        SELECT 
          email,
          domain,
          semrush_project_id,
          semrush_tracking_id
        FROM users
        WHERE domain LIKE '%aichelin%'
        LIMIT 1;
      `;
      
      if (sampleData.length > 0) {
        results.push('\n📊 Beispieldaten für aichelin.at:');
        results.push(`  Email: ${sampleData[0].email}`);
        results.push(`  Semrush Project ID: ${sampleData[0].semrush_project_id || '(leer)'}`);
        results.push(`  Semrush Tracking ID: ${sampleData[0].semrush_tracking_id || '(leer)'}`);
      }
      
      return NextResponse.json({
        success: true,
        message: '✅ Spalten existieren bereits',
        results: results,
        currentColumns: currentColumns
      });
    }

    // 3. Füge fehlende Spalten hinzu
    if (currentColumns.length < 2) {
      results.push('⚠️ Spalten fehlen, füge sie jetzt hinzu...\n');

      try {
        // Füge beide Spalten in einem Statement hinzu
        await sql`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS semrush_project_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS semrush_tracking_id VARCHAR(255);
        `;
        
        results.push('✅ Spalten erfolgreich hinzugefügt!\n');
      } catch (alterError) {
        results.push(`❌ Fehler beim Hinzufügen: ${alterError}\n`);
        throw alterError;
      }
    }

    // 4. Überprüfe das Ergebnis
    const { rows: finalColumns } = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users'
      AND column_name IN ('semrush_project_id', 'semrush_tracking_id')
      ORDER BY column_name;
    `;

    results.push(`\n📋 Finale Spalten-Anzahl: ${finalColumns.length}`);

    // 5. Teste einen UPDATE
    results.push('\n🧪 Teste UPDATE-Funktion...');
    
    const { rows: testUsers } = await sql`
      SELECT id FROM users WHERE domain LIKE '%aichelin%' LIMIT 1;
    `;

    if (testUsers.length > 0) {
      const testId = testUsers[0].id;
      try {
        await sql`
          UPDATE users 
          SET 
            semrush_project_id = 'TEST_PROJECT_ID',
            semrush_tracking_id = 'TEST_TRACKING_ID'
          WHERE id = ${testId};
        `;
        
        // Prüfe, ob es funktioniert hat
        const { rows: verifyTest } = await sql`
          SELECT semrush_project_id, semrush_tracking_id
          FROM users
          WHERE id = ${testId};
        `;
        
        if (verifyTest[0]?.semrush_project_id === 'TEST_PROJECT_ID') {
          results.push('✅ UPDATE-Test erfolgreich!\n');
          
          // Setze Testwerte zurück
          await sql`
            UPDATE users 
            SET 
              semrush_project_id = NULL,
              semrush_tracking_id = NULL
            WHERE id = ${testId};
          `;
          results.push('✅ Testwerte zurückgesetzt\n');
        } else {
          results.push('⚠️ UPDATE-Test nicht verifizierbar\n');
        }
      } catch (testError) {
        results.push(`❌ UPDATE-Test fehlgeschlagen: ${testError}\n`);
      }
    }

    return NextResponse.json({
      success: true,
      message: '✅ Fix erfolgreich abgeschlossen!',
      results: results,
      finalColumns: finalColumns,
      nextSteps: [
        '1. Gehe zum Admin-Bereich',
        '2. Bearbeite den Benutzer www.aichelin.at',
        '3. Gib die Semrush-Werte erneut ein',
        '4. Speichere die Änderungen',
        '5. Lade die Seite neu (F5)'
      ]
    });

  } catch (error) {
    console.error('[FIX SEMRUSH] Fehler:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler beim Fix',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
