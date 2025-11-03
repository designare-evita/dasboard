// src/app/api/setup-database/route.ts

import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await sql`
      CREATE TABLE IF NOT EXISTS landingpages (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          haupt_keyword TEXT,
          weitere_keywords TEXT,
          suchvolumen INTEGER,
          aktuelle_position INTEGER,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    return NextResponse.json({ 
      message: "Tabelle 'landingpages' erfolgreich geprüft/erstellt!", 
      result 
    }, { status: 200 });
    
  } catch (error) {
    console.error('Fehler beim Erstellen der Tabelle:', error);
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
