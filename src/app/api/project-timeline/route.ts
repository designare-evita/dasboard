// src/app/api/setup-project-timeline/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    // Nur Superadmins dürfen Setup-Routen ausführen
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    // Fügt die Spalten zur 'users' Tabelle hinzu, falls sie nicht existieren
    await sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS project_start_date TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS project_duration_months INTEGER DEFAULT 6,
      ADD COLUMN IF NOT EXISTS project_timeline_active BOOLEAN DEFAULT FALSE;
    `;

    console.log('✅ Spalten für Projekt-Timeline zur Tabelle "users" hinzugefügt.');

    return NextResponse.json({
      message: '✅ Projekt-Timeline-Spalten (inkl. project_timeline_active) erfolgreich zur "users"-Tabelle hinzugefügt!',
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Fehler beim Hinzufügen der Spalten',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
