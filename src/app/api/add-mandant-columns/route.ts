// src/app/api/add-mandant-columns/route.ts
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('[MIGRATION] Versuche, Spalten mandant_id und permissions zur users-Tabelle hinzuzufügen...');

    // Transaktion starten
    await sql.query('BEGIN');

    // Spalte mandant_id hinzufügen, falls sie nicht existiert
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS mandant_id VARCHAR(255) NULL;
    `;
    console.log('[MIGRATION] Spalte mandant_id hinzugefügt (oder existierte bereits).');

    // Spalte permissions hinzufügen, falls sie nicht existiert
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';
    `;
    console.log('[MIGRATION] Spalte permissions hinzugefügt (oder existierte bereits).');

    // Transaktion abschließen
    await sql.query('COMMIT');

    console.log('[MIGRATION] ✅ Datenbank-Schema erfolgreich aktualisiert.');
    
    return NextResponse.json({ 
      message: 'Datenbank-Schema erfolgreich aktualisiert! Die Spalten "mandant_id" und "permissions" wurden hinzugefügt (oder existierten bereits). Sie sollten sich jetzt einloggen können.' 
    }, { status: 200 });

  } catch (error) {
    // Bei Fehler Transaktion zurückrollen
    await sql.query('ROLLBACK');
    console.error('[MIGRATION] ❌ Fehler beim Update des Schemas:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Aktualisieren des Datenbank-Schemas.',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
