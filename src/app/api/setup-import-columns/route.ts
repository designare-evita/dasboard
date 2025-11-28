// src/app/api/setup-import-columns/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    // Nur zur Sicherheit: Nur Admins/Superadmins dürfen das Schema ändern
    if (session?.user?.role !== 'SUPERADMIN' && session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    // Fügt die fehlenden Spalten hinzu, falls sie noch nicht existieren
    await sql`
      ALTER TABLE landingpages 
      ADD COLUMN IF NOT EXISTS suchvolumen INTEGER,
      ADD COLUMN IF NOT EXISTS aktuelle_position INTEGER;
    `;

    return NextResponse.json({
      message: '✅ Tabelle "landingpages" erfolgreich um "suchvolumen" und "aktuelle_position" erweitert.',
    });
  } catch (error) {
    console.error('Migrations-Fehler:', error);
    return NextResponse.json(
      {
        message: 'Fehler beim Migrieren der Datenbank',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
