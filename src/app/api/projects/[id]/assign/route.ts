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
  const { id: projectId } = await params;
  const session = await getServerSession(authOptions);
  
  // Sicherheitscheck: Nur Superadmins dürfen das
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
  }

  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ message: 'Benutzer-ID fehlt' }, { status: 400 });
    }

    await sql`
      INSERT INTO project_assignments (user_id, project_id)
      VALUES (${userId}, ${projectId})
      ON CONFLICT (user_id, project_id) DO NOTHING;
    `;

    return NextResponse.json({ message: 'Admin erfolgreich zugewiesen.' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Ein Fehler ist aufgetreten.' }, { status: 500 });
  }
}

// Entfernt die Zuweisung eines Benutzers (Admin) von einem Projekt
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const session = await getServerSession(authOptions);

  // Sicherheitscheck: Nur Superadmins dürfen das
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
  }
  
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ message: 'Benutzer-ID fehlt' }, { status: 400 });
    }

    await sql`
      DELETE FROM project_assignments
      WHERE user_id = ${userId} AND project_id = ${projectId};
    `;

    return NextResponse.json({ message: 'Zuweisung erfolgreich entfernt.' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Ein Fehler ist aufgetreten.' }, { status: 500 });
  }
}
