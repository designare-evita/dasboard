// src/app/api/fix-project-assignments/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const results: string[] = [];
    results.push('🔍 Starte Diagnose der Project Assignments...\n');

    // 1. Prüfe, ob die Tabelle existiert
    const { rows: tables } = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'project_assignments';
    `;

    const tableExists = tables.length > 0;
    results.push(`📋 Tabelle "project_assignments" existiert: ${tableExists ? '✅ JA' : '❌ NEIN'}`);

    if (!tableExists) {
      results.push('\n🔧 Erstelle Tabelle "project_assignments"...');
      
      await sql`
        CREATE TABLE project_assignments (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, project_id)
        );
      `;
      
      results.push('✅ Tabelle "project_assignments" wurde erstellt');
      
      // Index für bessere Performance
      await sql`
        CREATE INDEX IF NOT EXISTS idx_project_assignments_user_id 
        ON project_assignments(user_id);
      `;
      
      await sql`
        CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id 
        ON project_assignments(project_id);
      `;
      
      results.push('✅ Indizes wurden erstellt');
    } else {
      // Prüfe die Spalten der existierenden Tabelle
      const { rows: columns } = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'project_assignments'
        ORDER BY ordinal_position;
      `;

      results.push('\n📋 Aktuelle Spalten:');
      columns.forEach(col => {
        results.push(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });

      // Prüfe, ob die Datentypen korrekt sind (UUID statt VARCHAR)
      const userIdCol = columns.find(c => c.column_name === 'user_id');
      const projectIdCol = columns.find(c => c.column_name === 'project_id');

      if (userIdCol && userIdCol.data_type !== 'uuid') {
        results.push('\n⚠️ WARNUNG: user_id ist kein UUID-Typ! Aktuell: ' + userIdCol.data_type);
        results.push('🔧 Tabelle wird neu erstellt mit korrekten Typen...');
        
        // Lösche alte Tabelle
        await sql`DROP TABLE IF EXISTS project_assignments CASCADE;`;
        
        // Erstelle neue Tabelle mit UUID
        await sql`
          CREATE TABLE project_assignments (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, project_id)
          );
        `;
        
        results.push('✅ Tabelle wurde mit UUID-Typen neu erstellt');
      } else {
        results.push('\n✅ Spaltentypen sind korrekt (UUID)');
      }
    }

    // 2. Teste eine Beispiel-Zuweisung
    results.push('\n🧪 Führe Test-Zuweisung durch...');
    
    const { rows: admins } = await sql`
      SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1;
    `;
    
    const { rows: projects } = await sql`
      SELECT id FROM users WHERE role = 'BENUTZER' LIMIT 1;
    `;

    if (admins.length > 0 && projects.length > 0) {
      const testAdminId = admins[0].id;
      const testProjectId = projects[0].id;
      
      try {
        await sql`
          INSERT INTO project_assignments (user_id, project_id)
          VALUES (${testAdminId}, ${testProjectId})
          ON CONFLICT (user_id, project_id) DO NOTHING;
        `;
        
        results.push(`✅ Test-Zuweisung erfolgreich (Admin: ${testAdminId}, Project: ${testProjectId})`);
        
        // Lösche Test-Eintrag wieder
        await sql`
          DELETE FROM project_assignments 
          WHERE user_id = ${testAdminId} AND project_id = ${testProjectId};
        `;
        
        results.push('✅ Test-Eintrag wurde wieder entfernt');
      } catch (testError) {
        results.push(`❌ Test-Zuweisung fehlgeschlagen: ${testError instanceof Error ? testError.message : 'Unbekannter Fehler'}`);
      }
    } else {
      results.push('⚠️ Keine Test-Daten verfügbar (benötigt mind. 1 Admin und 1 Benutzer)');
    }

    // 3. Zeige aktuelle Zuweisungen
    const { rows: currentAssignments } = await sql`
      SELECT 
        pa.user_id::text,
        pa.project_id::text,
        u1.email as admin_email,
        u2.email as project_email
      FROM project_assignments pa
      JOIN users u1 ON pa.user_id = u1.id
      JOIN users u2 ON pa.project_id = u2.id
      LIMIT 10;
    `;

    results.push(`\n📊 Aktuelle Zuweisungen: ${currentAssignments.length}`);
    if (currentAssignments.length > 0) {
      currentAssignments.forEach(a => {
        results.push(`  - ${a.admin_email} → ${a.project_email}`);
      });
    }

    // 4. Finale Struktur-Prüfung
    const { rows: finalColumns } = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'project_assignments'
      ORDER BY ordinal_position;
    `;

    return NextResponse.json({
      success: true,
      message: '✅ Diagnose und Reparatur abgeschlossen',
      results: results,
      finalStructure: finalColumns,
      assignmentsCount: currentAssignments.length
    });

  } catch (error) {
    console.error('Fehler bei der Diagnose/Reparatur:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler bei der Diagnose',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
