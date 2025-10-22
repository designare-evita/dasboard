// src/app/api/landingpages/[id]/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

type LogEntry = {
    id: number;
    user_email: string | null;
    action: string;
    timestamp: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: landingpageId } = await params;
    const session = await getServerSession(authOptions);

    // Prüfen, ob der Benutzer eingeloggt ist UND Admin oder Superadmin ist
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
    }

    // Berechtigungsprüfung (optional, aber empfohlen: Prüfen, ob der Admin Zugriff auf das Projekt hat)
    // ... (ähnliche Logik wie in der Status-Update-Route oder GET-Route für Landingpages)

    const { rows } = await sql<LogEntry>`
      SELECT id, user_email, action, timestamp
      FROM landingpage_logs
      WHERE landingpage_id = ${landingpageId}
      ORDER BY timestamp DESC
      LIMIT 50; -- Begrenzung, um nicht zu viele Logs auf einmal zu laden
    `;

    return NextResponse.json(rows);

  } catch (error) {
    console.error('Fehler beim Abrufen der Landingpage-Logs:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
