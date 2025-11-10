// src/app/api/update-landingpages-gsc/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Diese Route aktualisiert die 'landingpages'-Tabelle, um die GSC-Datenfelder hinzuzufügen
 * und die veralteten Spalten 'suchvolumen' und 'aktuelle_position' zu entfernen.
 * * Nur für SUPERADMINS.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Stellt sicher, dass nur ein Super Admin diese Aktion ausführen kann
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert. Nur für Super Admins.' }, { status: 401 });
    }

    console.log('START: Aktualisiere Schema für Tabelle `landingpages`...');

    // 1. Neue GSC-Spalten hinzufügen (IF NOT EXISTS ist sicher)
    await sql`ALTER TABLE landingpages ADD COLUMN IF NOT EXISTS gsc_klicks INTEGER;`;
    await sql`ALTER TABLE landingpages ADD COLUMN IF NOT EXISTS gsc_klicks_change INTEGER;`;
    await sql`ALTER TABLE landingpages ADD COLUMN IF NOT EXISTS gsc_impressionen INTEGER;`;
    await sql`ALTER TABLE landingpages ADD COLUMN IF NOT EXISTS gsc_impressionen_change INTEGER;`;
    await sql`ALTER TABLE landingpages ADD COLUMN IF NOT EXISTS gsc_position DECIMAL(5, 2);`;
    await sql`ALTER TABLE landingpages ADD COLUMN IF NOT EXISTS gsc_position_change DECIMAL(5, 2);`;
    await sql`ALTER TABLE landingpages ADD COLUMN IF NOT EXISTS gsc_last_updated TIMESTAMP WITH TIME ZONE;`;
    await sql`ALTER TABLE landingpages ADD COLUMN IF NOT EXISTS gsc_last_range VARCHAR(10);`;

    console.log('✅ Neue Spalten erfolgreich hinzugefügt.');

    // 2. Veraltete Spalten entfernen (IF EXISTS ist sicher)
    await sql`ALTER TABLE landingpages DROP COLUMN IF EXISTS suchvolumen;`;
    await sql`ALTER TABLE landingpages DROP COLUMN IF EXISTS aktuelle_position;`;

    console.log('✅ Veraltete Spalten erfolgreich entfernt.');

    // 3. Optional: Index für die neuen Daten hinzufügen (für schnellere Abfragen)
    await sql`CREATE INDEX IF NOT EXISTS idx_landingpages_gsc_last_updated ON landingpages(gsc_last_updated);`;

    console.log('✅ Index erstellt.');
    console.log('FERTIG: Schema-Update für `landingpages` abgeschlossen.');

    return NextResponse.json({
      message: "✅ Schema der 'landingpages'-Tabelle erfolgreich aktualisiert.",
      added: [
        "gsc_klicks",
        "gsc_klicks_change",
        "gsc_impressionen",
        "gsc_impressionen_change",
        "gsc_position",
        "gsc_position_change",
        "gsc_last_updated",
        "gsc_last_range"
      ],
      removed: [
        "suchvolumen",
        "aktuelle_position"
      ]
    }, { status: 200 });

  } catch (error) {
    console.error("Fehler beim Aktualisieren des 'landingpages'-Schemas:", error);
    return NextResponse.json({ 
      message: "Fehler beim Schema-Update.",
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
