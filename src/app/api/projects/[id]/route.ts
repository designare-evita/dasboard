// src/app/api/projects/[id]/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Handler zum Abrufen eines einzelnen Projekts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { rows } = await sql`
      SELECT * FROM projects 
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;
    
    if (rows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }
    
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Abrufen des Projekts:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Aktualisieren eines Projekts
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, status } = body;

    // Prüfen ob Projekt dem User gehört
    const { rows: existingProject } = await sql`
      SELECT * FROM projects 
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;

    if (existingProject.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const { rows } = await sql`
      UPDATE projects
      SET 
        name = ${name},
        description = ${description},
        status = ${status},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${session.user.id}
      RETURNING *;
    `;

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Projekts:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Löschen eines Projekts
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const result = await sql`
      DELETE FROM projects 
      WHERE id = ${id} AND user_id = ${session.user.id};
    `;

    if (result.rowCount === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Projekt erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Projekts:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
