// src/app/api/landingpages/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Helper-Funktion für Admin-Check
async function isAdminSession() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';
}

/**
 * KORREKTUR: params ist ein Promise in Next.js 15+
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const { rows } = await sql`
      SELECT id, domain, title, url, status 
      FROM landingpages 
      WHERE id = ${id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Landingpage nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('[API LANDINGPAGES GET /id]', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}


/**
 * KORREKTUR: params ist ein Promise in Next.js 15+
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();
  const { title, url, status } = body;

  if (!title || !url || !status) {
    return NextResponse.json({ message: 'Titel, URL und Status sind erforderlich' }, { status: 400 });
  }

  try {
    const { rows } = await sql`
      UPDATE landingpages
      SET 
        title = ${title},
        url = ${url},
        status = ${status}
      WHERE id = ${id}
      RETURNING id, title, url, status
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Landingpage nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Landingpage erfolgreich aktualisiert', landingpage: rows[0] });
  } catch (error) {
    console.error('[API LANDINGPAGES PUT /id]', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}


/**
 * KORREKTUR: params ist ein Promise in Next.js 15+
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    await sql`
      DELETE FROM landingpages 
      WHERE id = ${id}
    `;
    return NextResponse.json({ message: 'Landingpage erfolgreich gelöscht' });
  } catch (error) {
    console.error('[API LANDINGPAGES DELETE /id]', error);
    return NextResponse.json({ message: 'Serverfehler' }, { status: 500 });
  }
}
