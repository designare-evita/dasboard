// src/app/api/setup-email-debounce/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await auth();
    // Nur Superadmins dürfen Setup-Routen ausführen
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    // Fügt die Spalte zur 'users' Tabelle hinzu, falls sie nicht existiert
    // Diese Spalte speichert, wann der ADMIN zuletzt über eine AKTION dieses KUNDEN benachrichtigt wurde.
    await sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_admin_notification_sent TIMESTAMP WITH TIME ZONE;
    `;

    console.log('✅ Spalte "last_admin_notification_sent" zur Tabelle "users" hinzugefügt.');

    return NextResponse.json({
      message: '✅ Spalte "last_admin_notification_sent" erfolgreich zur "users"-Tabelle hinzugefügt!',
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Fehler beim Hinzufügen der Spalte',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
