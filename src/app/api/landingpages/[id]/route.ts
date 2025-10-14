// src/app/api/landingpages/[id]/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

// PUT: Status einer Landingpage aktualisieren (z.B. auf 'approved')
export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const landingpageId = context.params.id;

  if (!session?.user) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const { status } = await request.json();
  if (!status || !['approved', 'pending', 'rejected'].includes(status)) {
    return NextResponse.json({ message: 'Ungültiger Status' }, { status: 400 });
  }

  try {
    // Sicherheits-Check: Wir stellen sicher, dass die Landingpage, die geändert wird,
    // auch wirklich dem angemeldeten Benutzer gehört.
    const { rows } = await sql`
      UPDATE landingpages
      SET status = ${status}
      WHERE id = ${landingpageId} AND user_id = ${session.user.id}
      RETURNING id;
    `;

    // Wenn die Abfrage keine Zeile zurückgibt, wurde nichts geändert (entweder ID falsch oder keine Berechtigung)
    if (rows.length === 0) {
      return NextResponse.json({ message: 'Landingpage nicht gefunden oder keine Berechtigung' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Status erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Landingpage-Status:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
