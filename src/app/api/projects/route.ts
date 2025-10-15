// src/app/api/projects/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    let projects;

    // ✨ Logik für die Zugriffsrechte
    if (user.role === 'SUPERADMIN') {
      // Superadmins sehen alles
      const { rows } = await sql`SELECT * FROM projects;`;
      projects = rows;
    } else if (user.role === 'ADMIN') {
      // Admins sehen nur ihre zugewiesenen Projekte
      const { rows } = await sql`
        SELECT p.*
        FROM projects p
        INNER JOIN project_assignments pa ON p.id = pa.project_id
        WHERE pa.user_id = ${user.id};
      `;
      projects = rows;
    } else {
      // Normale Benutzer sehen vielleicht nur das Projekt, dem sie als "Kunde" zugeordnet sind
      const { rows } = await sql`SELECT * FROM projects WHERE user_id = ${user.id};`;
      projects = rows;
    }

    return NextResponse.json(projects, { status: 200 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Fehler beim Laden der Projekte' }, { status: 500 });
  }
}
