// src/app/api/admin/datamax-settings/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET: Alle User und deren DataMax-Status abrufen
export async function GET(req: Request) {
  try {
    const session = await auth();
    // Nur Admins/Superadmins dürfen das sehen
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    let query;
    
    // Superadmin sieht alle, Admin sieht nur eigene Mandanten-User
    if (session.user.role === 'SUPERADMIN') {
      query = sql`
        SELECT id::text as id, email, role, domain, data_max_enabled
        FROM users
        ORDER BY data_max_enabled ASC, email ASC
      `;
    } else {
      query = sql`
        SELECT id::text as id, email, role, domain, data_max_enabled
        FROM users
        WHERE mandant_id = ${session.user.mandant_id}
        ORDER BY data_max_enabled ASC, email ASC
      `;
    }

    const { rows } = await query;
    
    // Zähle User, bei denen es DEAKTIVIERT ist (da Default true ist)
    // Beachte: NULL wird als TRUE (aktiv) behandelt, wenn wir streng sein wollen,
    // oder wir prüfen explizit auf false. Hier: false = deaktiviert.
    const disabledCount = rows.filter(r => r.data_max_enabled === false).length;

    return NextResponse.json({ 
      users: rows,
      disabledCount
    });
    
  } catch (error) {
    console.error('DataMax Settings GET error:', error);
    return NextResponse.json({ users: [], disabledCount: 0 });
  }
}

// POST: Status für einen User umschalten
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, isEnabled } = body;

    if (!userId) {
      return NextResponse.json({ message: 'User ID required' }, { status: 400 });
    }

    // Update DB
    await sql`
      UPDATE users 
      SET data_max_enabled = ${isEnabled === true}
      WHERE id = ${userId}::uuid
    `;

    return NextResponse.json({ success: true, userId, isEnabled });

  } catch (error: any) {
    console.error('DataMax Settings POST error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
