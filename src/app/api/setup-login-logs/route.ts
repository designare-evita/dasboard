// src/app/api/setup-login-logs/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    // Nur Superadmins dürfen Setup-Routen ausführen
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    // Erstellt die neue Tabelle für Login-Ereignisse
    await sql`
      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Wer hat sich eingeloggt
        user_email VARCHAR(255), -- E-Mail zum Zeitpunkt des Logins
        user_role VARCHAR(50),   -- Rolle zum Zeitpunkt des Logins
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Index für schnelleres Sortieren nach Datum
    await sql`
      CREATE INDEX IF NOT EXISTS idx_login_logs_timestamp 
      ON login_logs(timestamp DESC);
    `;

    return NextResponse.json({
      message: '✅ Tabelle "login_logs" erfolgreich erstellt!',
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Fehler beim Erstellen der Tabelle "login_logs"',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
