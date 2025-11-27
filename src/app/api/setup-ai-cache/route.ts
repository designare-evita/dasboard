// src/app/api/setup-ai-cache/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  // Nur Superadmins dürfen die DB ändern
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
  }

  try {
    // Erstellt die Tabelle für KI-Antworten
    await sql`
      CREATE TABLE IF NOT EXISTS ai_analysis_cache (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date_range VARCHAR(50) NOT NULL,
        input_hash VARCHAR(64) NOT NULL, -- Eindeutiger Fingerabdruck der Eingabedaten
        response TEXT NOT NULL,          -- Die generierte HTML/Text Antwort
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Index für schnelles Lesen erstellen
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup 
      ON ai_analysis_cache(user_id, date_range, input_hash);
    `;

    return NextResponse.json({ 
      message: '✅ Tabelle "ai_analysis_cache" erfolgreich erstellt.' 
    });
  } catch (error) {
    return NextResponse.json(
      { 
        message: 'Fehler beim Erstellen der Tabelle', 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
