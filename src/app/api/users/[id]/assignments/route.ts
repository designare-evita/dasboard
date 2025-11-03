// src/app/api/users/[id]/assignments/route.ts
// KORRIGIERT: Jetzt MIT atomarer Transaktion (sql.begin)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres'; // Importiere das Haupt-SQL-Objekt

/**
 * Berechtigungsprüfung: Darf der eingeloggte Admin Zuweisungen ändern?
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

    // 1. Berechtigungsprüfung
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

    // 3. KORREKTUR: Datenbank-Operationen IN EINER TRANSAKTION
    // sql.begin() stellt sicher, dass alle Befehle darin
    // atomar ausgeführt werden (entweder alle oder keiner).
    await sql.begin(async (tx) => {
      // Schritt A: Alle alten Zuweisungen löschen (verwende den Transaktions-Client 'tx')
      await tx`
        DELETE FROM project_assignments
        WHERE user_id::text = ${targetUserId};
      `;

      console.log(
        `[PUT assignments] (TX) Alte Zuweisungen für ${targetUserId} gelöscht.`
      );

      // Schritt B: Neue Zuweisungen einfügen (nur wenn welche übergeben wurden)
      if (project_ids.length > 0) {
        // Bereite alle Insert-Promises vor
        const insertPromises = project_ids.map((projectId) => {
          // Kurze Validierung
          if (typeof projectId === 'string' && projectId.length === 36) {
            // Verwende den Transaktions-Client 'tx'
            return tx`
              INSERT INTO project_assignments (user_id, project_id)
              VALUES (${targetUserId}::uuid, ${projectId}::uuid)
              ON CONFLICT (user_id, project_id) DO NOTHING;
            `;
          }
          console.warn(
            `[PUT assignments] (TX) Ungültige Projekt-ID übersprungen: ${projectId}`
          );
          return Promise.resolve(); // Ungültige ID überspringen
        });

        // Führe alle Inserts parallel innerhalb der Transaktion aus
        await Promise.all(insertPromises);

        console.log(
          `[PUT assignments] (TX) ${project_ids.length} neue Zuweisungen verarbeitet.`
        );
      }
      
      // Wenn die Funktion hier ohne Fehler endet, wird die Transaktion
      // automatisch committet.
    });

    console.log(`[PUT assignments] ✅ Transaktion erfolgreich abgeschlossen.`);

    // 4. Erfolg zurückmelden
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
    // Wenn in sql.begin() ein Fehler auftritt, wird die Transaktion
    // automatisch zurückgerollt (ROLLBACK).
    console.error('❌ Fehler bei Zuweisungs-Update (Rollback wurde durchgeführt):', error);
    return NextResponse.json(
      {
        message: 'Fehler beim Speichern der Zuweisungen. Änderungen wurden zurückgerollt.',
        error:
          error instanceof Error ? error.message : 'Ein unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
