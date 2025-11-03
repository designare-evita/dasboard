// src/app/api/users/[id]/assignments/route.ts
// KORRIGIERT: Ohne sql.begin()

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres'; // Nur den Haupt-SQL-Import verwenden

/**
 * Berechtigungsprüfung: Darf der eingeloggte Admin Zuweisungen ändern?
 * (Kopiert aus /api/projects/[id]/assign/route.ts)
 */
async function hasAssignmentPermission(session: Session | null) {
  if (!session?.user) return false;
  if (session.user.role === 'SUPERADMIN') return true;
  if (
    session.user.role === 'ADMIN' &&
    session.user.permissions?.includes('kann_admins_verwalten')
  ) {
    return true;
  }
  return false;
}

/**
 * PUT - Aktualisiert ALLE Projektzuweisungen für einen bestimmten Admin-Benutzer
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Die ID des Admins, der bearbeitet wird
    const { id: targetUserId } = await params;
    const session = await getServerSession(authOptions);

    console.log(
      `[PUT /api/users/${targetUserId}/assignments] Start Zuweisungs-Update...`
    );

    // 1. Berechtigungsprüfung: Nur Superadmins oder Admins mit Recht
    if (!(await hasAssignmentPermission(session))) {
      console.warn(
        '[PUT assignments] ❌ Nicht autorisiert - Rolle:',
        session?.user?.role
      );
      return NextResponse.json(
        {
          message:
            'Nicht autorisiert. Nur Superadmins oder Admins mit "kann_admins_verwalten" dürfen dies.',
        },
        { status: 403 }
      );
    }

    // 2. Body parsen
    const body = await request.json();
    const { project_ids } = body as { project_ids: string[] };

    if (!Array.isArray(project_ids)) {
      return NextResponse.json(
        { message: 'Ein Array von "project_ids" ist erforderlich.' },
        { status: 400 }
      );
    }

    console.log(
      `[PUT assignments] Aktualisiere ${project_ids.length} Zuweisungen für Admin ${targetUserId}`
    );

    // 3. Datenbank-Operationen (ohne Transaktion)

    // Schritt A: Alle alten Zuweisungen für diesen Admin löschen
    await sql`
      DELETE FROM project_assignments
      WHERE user_id::text = ${targetUserId};
    `;

    console.log(
      `[PUT assignments] Alte Zuweisungen für ${targetUserId} gelöscht.`
    );

    // Schritt B: Neue Zuweisungen einfügen (nur wenn welche übergeben wurden)
    if (project_ids.length > 0) {
      // Wir führen alle Inserts parallel aus
      const insertPromises = project_ids.map((projectId) => {
        // Kurze Validierung
        if (typeof projectId === 'string' && projectId.length === 36) {
          return sql`
            INSERT INTO project_assignments (user_id, project_id)
            VALUES (${targetUserId}::uuid, ${projectId}::uuid)
            ON CONFLICT (user_id, project_id) DO NOTHING;
          `;
        }
        console.warn(
          `[PUT assignments] Ungültige Projekt-ID übersprungen: ${projectId}`
        );
        return Promise.resolve(); // Ungültige ID überspringen
      });

      await Promise.all(insertPromises);

      console.log(
        `[PUT assignments] ${project_ids.length} neue Zuweisungen verarbeitet.`
      );
    }

    console.log(`[PUT assignments] ✅ Erfolgreich gespeichert.`);

    // 4. Erfolg zurückmelden (wichtig: eine JSON-Antwort senden)
    return NextResponse.json(
      {
        message: 'Projektzuweisungen erfolgreich aktualisiert.',
        data: {
          updatedUserId: targetUserId,
          assignedCount: project_ids.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Fehler bei Zuweisungs-Update:', error);
    return NextResponse.json(
      {
        message: 'Fehler beim Speichern der Zuweisungen',
        error:
          error instanceof Error ? error.message : 'Ein unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
