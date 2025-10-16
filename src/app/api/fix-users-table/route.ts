// src/app/api/fix-users-table/route.ts

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

    // 1. Prüfe die aktuelle Tabellenstruktur
    const { rows: columns } = await sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `;

    results.push('📋 Aktuelle Spalten in der users-Tabelle:');
    columns.forEach(col => {
      results.push(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // 2. Prüfe, ob created_at fehlt
    const hasCreatedAt = columns.some(col => col.column_name === 'created_at');
    
    if (!hasCreatedAt) {
      results.push('\n⚠️ Spalte "created_at" fehlt - wird hinzugefügt...');
      
      await sql`
        ALTER TABLE users 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      `;
      
      results.push('✅ Spalte "created_at" wurde hinzugefügt');
    } else {
      results.push('\n✅ Spalte "created_at" existiert bereits');
    }

    // 3. Prüfe, ob createdByAdminId existiert
    const hasCreatedBy = columns.some(col => col.column_name === 'createdByAdminId');
    
    if (!hasCreatedBy) {
      results.push('\n⚠️ Spalte "createdByAdminId" fehlt - wird hinzugefügt...');
      
      await sql`
        ALTER TABLE users 
        ADD COLUMN "createdByAdminId" UUID REFERENCES users(id);
      `;
      
      results.push('✅ Spalte "createdByAdminId" wurde hinzugefügt');
    } else {
      results.push('\n✅ Spalte "createdByAdminId" existiert bereits');
    }

    // 4. Teste direkte Abfrage
    results.push('\n🔍 Teste direkte Abfrage...');
    const testId = '3c157e01-7674-4630-9d3a-245ddd86cdba';
    
    try {
      const { rows: testResult } = await sql`
        SELECT id, email, role FROM users WHERE id::text = ${testId};
      `;
      
      if (testResult.length > 0) {
        results.push(`✅ Test erfolgreich! Benutzer gefunden: ${testResult[0].email}`);
      } else {
        results.push(`❌ Test fehlgeschlagen: Kein Benutzer mit ID ${testId} gefunden`);
      }
    } catch (testError) {
      results.push(`❌ Test-Fehler: ${testError instanceof Error ? testError.message : 'Unbekannter Fehler'}`);
    }

    // 5. Hole die neue Struktur
    const { rows: newColumns } = await sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `;

    return NextResponse.json({
      message: '✅ Diagnose abgeschlossen',
      results: results,
      columnsBefore: columns,
      columnsAfter: newColumns,
      changes: {
        createdAtAdded: !hasCreatedAt,
        createdByAdminIdAdded: !hasCreatedBy
      }
    });

  } catch (error) {
    console.error('Fehler bei der Diagnose/Reparatur:', error);
    return NextResponse.json(
      { 
        message: 'Fehler bei der Diagnose',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
