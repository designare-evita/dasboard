// src/app/api/setup-google-cache/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Nur Superadmins dürfen Datenbank-Setup-Routen ausführen
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    console.log('Erstelle Google Data Cache Tabelle...');

    // Erstellt die Tabelle mit einem zusammengesetzten Primärschlüssel
    await sql`
      CREATE TABLE IF NOT EXISTS google_data_cache (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date_range VARCHAR(10) NOT NULL,
        data JSONB NOT NULL,
        last_fetched TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, date_range)
      );
    `;
    
    console.log('✅ Tabelle "google_data_cache" erfolgreich erstellt.');

    // Index für schnellere Abfragen
    await sql`
      CREATE INDEX IF NOT EXISTS idx_google_data_cache_user_id 
      ON google_data_cache(user_id);
    `;
    
    console.log('✅ Index für "google_data_cache" erstellt.');

    return NextResponse.json({
      message: '✅ "google_data_cache" Tabelle erfolgreich erstellt!'
    });

  } catch (error) {
    console.error('Fehler beim Erstellen der Cache-Tabelle:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Erstellen der Tabelle',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
