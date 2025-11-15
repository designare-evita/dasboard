// src/app/api/debug-users/route.ts

import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth

export async function GET() {
  // Stellt sicher, dass nur ein Super Admin diese Aktion ausführen kann
  const session = await auth(); // KORRIGIERT: auth() aufgerufen
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert. Nur für Super Admins.' }, { status: 401 });
  }

  try {
    // Liest die wichtigen Spalten aller Benutzer aus der Datenbank
    const { rows } = await sql`
      SELECT id, email, role FROM users;
    `;

    return NextResponse.json({
      message: "Debug-Informationen erfolgreich abgerufen.",
      userCount: rows.length,
      users: rows,
    }, { status: 200 });

  } catch (error) {
    console.error("Fehler bei der Benutzer-Diagnose:", error);
    return NextResponse.json({ message: "Bei der Diagnose ist ein Fehler aufgetreten." }, { status: 500 });
  }
}
