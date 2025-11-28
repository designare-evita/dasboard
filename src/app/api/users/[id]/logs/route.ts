// src/app/api/users/[id]/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { sql } from '@vercel/postgres';

type LogEntry = {
    id: number;
    user_email: string | null; // Wer hat die Aktion ausgeführt
    action: string;
    timestamp: string;
    landingpage_url: string; // URL der betroffenen Landingpage
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params; // Die ID des Benutzers, dessen Logs wir sehen wollen
    const session = await auth(); // KORRIGI'G'ERT: auth() aufgerufen

    // Prüfen, ob der anfragende Benutzer Admin oder Superadmin ist
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
    }

    // Berechtigungsprüfung: Admin darf nur Logs von Projekten sehen, denen er zugewiesen ist
    if (session.user.role === 'ADMIN') {
        const { rows: accessCheck } = await sql`
          SELECT 1
          FROM project_assignments
          WHERE user_id::text = ${session.user.id}
          AND project_id::text = ${targetUserId};
        `;
        if (accessCheck.length === 0) {
          return NextResponse.json({
            message: 'Sie haben keinen Zugriff auf die Logs dieses Projekts'
          }, { status: 403 });
        }
    }
    // SUPERADMIN hat immer Zugriff

    // Hole alle Logs von Landingpages, die dem targetUserId gehören
    const { rows } = await sql<LogEntry>`
      SELECT
        log.id,
        log.user_email,
        log.action,
        log.timestamp,
        lp.url as landingpage_url
      FROM landingpage_logs log
      JOIN landingpages lp ON log.landingpage_id = lp.id
      WHERE lp.user_id::text = ${targetUserId}
      ORDER BY log.timestamp DESC
      LIMIT 100; -- Begrenzung auf die letzten 100 Einträge
    `;

    return NextResponse.json(rows);

  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzer-Logs:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
