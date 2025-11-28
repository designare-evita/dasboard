import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    // Fügt die Spalte updated_at hinzu, falls noch nicht vorhanden
    await sql`
      ALTER TABLE landingpages 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `;

    // Setzt updated_at initial auf created_at, wo es NULL ist
    await sql`
      UPDATE landingpages 
      SET updated_at = created_at 
      WHERE updated_at IS NULL;
    `;

    return NextResponse.json({
      message: '✅ Tabelle landingpages erfolgreich um "updated_at" erweitert.',
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
