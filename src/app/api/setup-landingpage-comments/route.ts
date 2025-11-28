// src/app/api/setup-landingpage-comments/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    // Fügt die Spalte comment hinzu
    await sql`
      ALTER TABLE landingpages 
      ADD COLUMN IF NOT EXISTS comment TEXT;
    `;

    return NextResponse.json({
      message: '✅ Tabelle landingpages erfolgreich um "comment" erweitert.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Fehler beim Migrieren der Datenbank',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
