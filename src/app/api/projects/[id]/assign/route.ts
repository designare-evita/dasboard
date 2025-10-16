// src/app/api/projects/[id]/assign/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

// Weist einen Benutzer (Admin) einem Projekt zu
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await getServerSession(authOptions);
    
    console.log('[POST /api/projects/[id]/assign] Start');
    console.log('[POST] Session User:', session?.user?.email, 'Role:', session?.user?.role);
    console.log('[POST] Project ID:', projectId);
    
    // Sicherheitscheck: Nur Superadmins dürfen das
    if (session?.user?.role !== 'SUPERADMIN') {
      console.warn('[POST] ❌ Nicht autorisiert - Rolle:', session?.user?.role);
      return NextResponse.json({ message: 'Nicht autorisiert. Nur Superadmins dürfen Projekte zuweisen.' }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;
    
    console.log('[POST] User ID (Admin):', userId);

    if (!userId) {
      console.error('[POST] ❌ Benutzer-ID fehlt im Request Body');
      return NextResponse.json({ message: 'Benutzer-ID fehlt' }, { status: 400 });
    }

    if (!projectId) {
      console.error('[POST] ❌ Projekt-ID fehlt in URL');
      return NextResponse.json({ message: 'Projekt-ID fehlt' }, { status: 400 });
    }

    // Validiere, dass beide IDs existieren
    const { rows: adminCheck } = await sql`
      SELECT id, email, role FROM users WHERE id::text = ${userId};
    `;
    
    if (adminCheck.length === 0) {
      console.error('[POST] ❌ Admin nicht gefunden:', userId);
      return NextResponse.json({ message: 'Admin-Benutzer nicht gefunden' }, { status: 404 });
    }

    if (adminCheck[0].role !== 'ADMIN') {
      console.error('[POST] ❌ Benutzer ist kein Admin:', adminCheck[0].email, 'Rolle:', adminCheck[0].role);
      return NextResponse.json({ message: 'Der Benutzer muss ein Admin sein' }, { status: 400 });
    }

    const { rows: projectCheck } = await sql`
      SELECT id, email, role FROM users WHERE id::text = ${projectId};
    `;
    
    if (projectCheck.length === 0) {
      console.error('[POST] ❌ Projekt nicht gefunden:', projectId);
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }

    if (projectCheck[0].role !== 'BENUTZER') {
      console.error('[POST] ❌ Projekt ist kein Benutzer:', projectCheck[0].email, 'Rolle:', projectCheck[0].role);
      return NextResponse.json({ message: 'Das Projekt muss ein Benutzer sein' }, { status: 400 });
    }

    console.log('[POST] ✅ Validierung erfolgreich');
    console.log('[POST] Admin:', adminCheck[0].email);
    console.log('[POST] Projekt:', projectCheck[0].email);

    // Führe die Zuweisung durch
    await sql`
      INSERT INTO project_assignments (user_id, project_id)
      VALUES (${userId}::uuid, ${projectId}::uuid)
      ON CONFLICT (user_id, project_id) DO NOTHING;
    `;

    console.log('[POST] ✅ Zuweisung erfolgreich erstellt');

    return NextResponse.json({ 
      message: 'Admin erfolgreich zugewiesen.',
      admin: adminCheck[0].email,
      project: projectCheck[0].email
    }, { status: 200 });

  } catch (error) {
    console.error('[POST] ❌ Fehler bei der Zuweisung:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[POST] Error Message:', errorMessage);
    console.error('[POST] Error Stack:', errorStack);
    
    return NextResponse.json({ 
      message: 'Fehler bei der Zuweisung',
      error: errorMessage,
      details: errorStack
    }, { status: 500 });
  }
}

// Entfernt die Zuweisung eines Benutzers (Admin) von einem Projekt
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await getServerSession(authOptions);
    
    console.log('[DELETE /api/projects/[id]/assign] Start');
    console.log('[DELETE] Session User:', session?.user?.email, 'Role:', session?.user?.role);
    console.log('[DELETE] Project ID:', projectId);

    // Sicherheitscheck: Nur Superadmins dürfen das
    if (session?.user?.role !== 'SUPERADMIN') {
      console.warn('[DELETE] ❌ Nicht autorisiert');
      return NextResponse.json({ message: 'Nicht autorisiert. Nur Superadmins dürfen Zuweisungen entfernen.' }, { status: 403 });
    }
    
    const body = await request.json();
    const { userId } = body;
    
    console.log('[DELETE] User ID (Admin):', userId);
    
    if (!userId) {
      console.error('[DELETE] ❌ Benutzer-ID fehlt');
      return NextResponse.json({ message: 'Benutzer-ID fehlt' }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM project_assignments
      WHERE user_id::text = ${userId} AND project_id::text = ${projectId}
      RETURNING user_id, project_id;
    `;

    if (result.rowCount === 0) {
      console.warn('[DELETE] ⚠️ Keine Zuweisung zum Löschen gefunden');
      return NextResponse.json({ message: 'Keine Zuweisung gefunden' }, { status: 404 });
    }

    console.log('[DELETE] ✅ Zuweisung erfolgreich entfernt');

    return NextResponse.json({ message: 'Zuweisung erfolgreich entfernt.' }, { status: 200 });

  } catch (error) {
    console.error('[DELETE] ❌ Fehler:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
    
    return NextResponse.json({ 
      message: 'Fehler beim Entfernen der Zuweisung',
      error: errorMessage
    }, { status: 500 });
  }
}
