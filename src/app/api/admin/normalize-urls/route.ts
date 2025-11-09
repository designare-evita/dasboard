import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Diese Route normalisiert alle URLs in der 'landingpages'-Tabelle 
 * auf Kleinschreibung. Sie ist idempotent und sicher, da sie 
 * potenzielle Duplikate (die durch die Umwandlung entstehen würden)
 * auflöst, bevor sie die Konvertierung durchführt.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  // 1. Sicherheit: Nur Superadmins dürfen dies.
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
  }

  const client = await sql.connect();
  
  try {
    await client.query('BEGIN');

    // Schritt 1: Identifiziere Duplikate, die durch Kleinschreibung entstehen würden.
    // Wir behalten den Eintrag, der als ERSTES erstellt wurde (MIN(id)) 
    // und löschen alle späteren Duplikate.
    const { rows: duplicates } = await client.query(`
      DELETE FROM landingpages
      WHERE id IN (
        SELECT id
        FROM (
          SELECT 
            id,
            ROW_NUMBER() OVER (
              PARTITION BY user_id, LOWER(url) 
              ORDER BY created_at ASC, id ASC
            ) as rn
          FROM landingpages
        ) s
        WHERE s.rn > 1
      );
    `);

    // Schritt 2: Wandle alle verbleibenden URLs in Kleinbuchstaben um.
    const { rows: updated } = await client.query(`
      UPDATE landingpages
      SET url = LOWER(url)
      WHERE url != LOWER(url);
    `);

    await client.query('COMMIT');

    return NextResponse.json({
      message: '✅ Normalisierung erfolgreich abgeschlossen.',
      duplicatesRemoved: duplicates.length,
      urlsNormalized: updated.length,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[NORMALIZE URLS] Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Fehler bei der Normalisierung. Rollback durchgeführt.',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
