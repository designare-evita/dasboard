// src/app/api/landingpages/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server'; // KORRIGIERT: NextRequest importiert
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Helper-Funktion für Admin-Check
async function isAdminSession() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';
}

/**
 * NEU: Holt die Daten einer einzelnen Landingpage.
 * KORRIGIERT: 'req' ist jetzt 'NextRequest' statt 'Request'.
 */
export async function GET(
  req: NextRequest, // KORRIGIERT
  { params }: { params: { id: string } }
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const { id } = params; // params-Zugriff bleibt gleich (ist kein Promise)

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
 * NEU: Aktualisiert eine vorhandene Landingpage.
 * KORRIGIERT: 'req' ist jetzt 'NextRequest' statt 'Request'.
 */
export async function PUT(
  req: NextRequest, // KORRIGIERT
  { params }: { params: { id: string } }
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json(); // Das 'req.json()' ist der Promise-Teil
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
 * BEIBEHALTEN: Löscht eine Landingpage
 * KORRIGIERT: 'req' ist jetzt 'NextRequest' statt 'Request'.
 */
export async function DELETE(
  req: NextRequest, // KORRIGIERT
  { params }: { params: { id: string } }
) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  const { id } = params;

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
