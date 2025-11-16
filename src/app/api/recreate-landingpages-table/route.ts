// src/app/api/recreate-landingpages-table/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth

export async function GET() {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen
    
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Lösche die alte (falsche) Tabelle
    await sql`DROP TABLE IF EXISTS landingpages CASCADE;`;
    console.log('✅ Alte Tabelle gelöscht');

    // Erstelle die neue (korrekte) Tabelle
    await sql`
      CREATE TABLE landingpages (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        haupt_keyword TEXT,
        weitere_keywords TEXT,
        suchvolumen INTEGER,
        aktuelle_position INTEGER,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(url, user_id)
      );
    `;
    console.log('✅ Neue Tabelle erstellt');

    // Erstelle Index für bessere Performance
    await sql`
      CREATE INDEX idx_landingpages_user_id ON landingpages(user_id);
    `;
    console.log('✅ Index erstellt');

    // Prüfe die neue Struktur
    const { rows: columns } = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'landingpages'
      ORDER BY ordinal_position;
    `;

    return NextResponse.json({
      message: '✅ Landingpages-Tabelle erfolgreich neu erstellt!',
      structure: columns
    });

  } catch (error) {
    console.error('Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Erstellen der Tabelle',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
