// src/app/api/update-schema/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gsc_site_url VARCHAR(255);`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ga4_property_id VARCHAR(255);`;

    return NextResponse.json({ message: 'Datenbankschema erfolgreich aktualisiert!' });
  } catch (error) {
    return NextResponse.json(
      { message: 'Fehler beim Aktualisieren des Schemas', error: (error as Error).message },
      { status: 500 }
    );
  }
}
