// src/app/api/update-schema/route.ts

import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // KORREKTUR: Der Datentyp wurde von INTEGER auf UUID geändert, um mit der 'id'-Spalte übereinzustimmen.
    await sql`
      ALTER TABLE users ADD COLUMN created_by UUID REFERENCES users(id);
    `;
    return NextResponse.json({ message: "Schema erfolgreich aktualisiert: 'created_by' Spalte vom Typ UUID hinzugefügt." }, { status: 200 });
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Schemas:", error);
    // Wir fangen auch den Fall ab, dass die Spalte bereits existiert
    if (error instanceof Error && error.message.includes("already exists")) {
        return NextResponse.json({ message: "Schema bereits aktuell, 'created_by' Spalte existiert schon." }, { status: 200 });
    }
    return NextResponse.json({ error }, { status: 500 });
  }
}
