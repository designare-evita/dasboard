import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    // Erweitert die Spalte date_range von VARCHAR(10) auf VARCHAR(50)
    await sql`
      ALTER TABLE google_data_cache 
      ALTER COLUMN date_range TYPE VARCHAR(50);
    `;

    return NextResponse.json({
      message: '✅ Tabelle google_data_cache erfolgreich aktualisiert (date_range -> VARCHAR(50)).',
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
