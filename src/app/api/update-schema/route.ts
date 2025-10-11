// src/app/api/update-schema/route.ts

import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fügt die Spalte 'created_by' zur 'users'-Tabelle hinzu, falls sie nicht existiert
    await sql`
      ALTER TABLE users ADD COLUMN created_by INTEGER REFERENCES users(id);
    `;
    return NextResponse.json({ message: "Schema erfolgreich aktualisiert: 'created_by' Spalte hinzugefügt." }, { status: 200 });
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Schemas:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
