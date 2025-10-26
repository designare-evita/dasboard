// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;

    console.log('[/api/projects] GET Request');
    console.log('[/api/projects] User:', user?.email, 'Role:', user?.role);

    if (!user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Nur Admins und Superadmins dürfen Projekte sehen
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    let result;

    if (user.role === 'SUPERADMIN') {
      // Superadmins sehen alle Projekte (= alle Benutzer mit Rolle BENUTZER)
      console.log('[/api/projects] SUPERADMIN - Lade alle Projekte');
      
      result = await sql`
        SELECT 
          id::text as id, 
          email, 
          role, 
          domain,
          gsc_site_url,
          ga4_property_id
        FROM users
        WHERE role = 'BENUTZER'
        ORDER BY domain ASC NULLS LAST, email ASC
      `;

      console.log('[/api/projects] Gefunden:', result.rows.length, 'Projekte');

    } else if (user.role === 'ADMIN') {
      // Admins sehen nur ihre zugewiesenen Projekte
      console.log('[/api/projects] ADMIN - Lade zugewiesene Projekte');
      
      result = await sql`
        SELECT 
          u.id::text as id, 
          u.email, 
          u.role, 
          u.domain,
          u.gsc_site_url,
          u.ga4_property_id
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${user.id}
        AND u.role = 'BENUTZER'
        ORDER BY u.domain ASC NULLS LAST, u.email ASC
      `;

      console.log('[/api/projects] Gefunden:', result.rows.length, 'zugewiesene Projekte');
    } else {
      // Andere Rollen haben keinen Zugriff
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    // WICHTIG: Rückgabe im Format { projects: [...] } wie von der Homepage erwartet
    return NextResponse.json({ projects: result.rows }, { status: 200 });

  } catch (error) {
    console.error('[/api/projects] Fehler beim Laden der Projekte:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Laden der Projekte',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
