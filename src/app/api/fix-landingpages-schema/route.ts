// src/app/api/fix-landingpages-schema/route.ts

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

    // Prüfe die aktuelle Tabellenstruktur
    const { rows: columns } = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'landingpages'
      ORDER BY ordinal_position;
    `;

    console.log('Aktuelle Spalten:', columns);

    // Falls user_id fehlt, füge sie hinzu
    const hasUserId = columns.some(col => col.column_name === 'user_id');
    
    if (!hasUserId) {
      console.log('⚠️ Spalte user_id fehlt - wird hinzugefügt...');
      
      await sql`
        ALTER TABLE landingpages 
        ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
      `;
      
      console.log('✅ Spalte user_id wurde hinzugefügt');
    }

    // Erstelle den UNIQUE Index
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS landingpages_url_user_id_key 
      ON landingpages(url, user_id);
    `;

    // Hole die neue Struktur
    const { rows: newColumns } = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'landingpages'
      ORDER BY ordinal_position;
    `;

    return NextResponse.json({
      message: 'Schema erfolgreich geprüft/repariert',
      before: columns,
      after: newColumns,
      wasFixed: !hasUserId
    });

  } catch (error) {
    console.error('Fehler beim Reparieren des Schemas:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Reparieren',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
