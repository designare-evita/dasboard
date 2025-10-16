// src/app/api/debug-assignments/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const results: Record<string, unknown> = {
      currentUser: {
        email: session.user.email,
        role: session.user.role,
        id: session.user.id
      }
    };

    // 1. Alle Admins
    const { rows: admins } = await sql`
      SELECT id::text as id, email, role 
      FROM users 
      WHERE role = 'ADMIN'
      ORDER BY email;
    `;
    results.admins = admins;

    // 2. Alle Benutzer (Projekte)
    const { rows: projects } = await sql`
      SELECT id::text as id, email, domain, role 
      FROM users 
      WHERE role = 'BENUTZER'
      ORDER BY email;
    `;
    results.projects = projects;

    // 3. Alle Zuweisungen
    const { rows: allAssignments } = await sql`
      SELECT 
        pa.user_id::text as admin_id,
        pa.project_id::text as project_id,
        u1.email as admin_email,
        u1.role as admin_role,
        u2.email as project_email,
        u2.role as project_role,
        u2.domain as project_domain
      FROM project_assignments pa
      LEFT JOIN users u1 ON pa.user_id = u1.id
      LEFT JOIN users u2 ON pa.project_id = u2.id
      ORDER BY u1.email, u2.email;
    `;
    results.allAssignments = allAssignments;

    // 4. Wenn der aktuelle Benutzer ein Admin ist, zeige seine Zuweisungen
    if (session.user.role === 'ADMIN') {
      const { rows: myAssignments } = await sql`
        SELECT 
          pa.project_id::text as project_id,
          u.email as project_email,
          u.domain as project_domain,
          u.role as project_role,
          u.gsc_site_url,
          u.ga4_property_id
        FROM project_assignments pa
        INNER JOIN users u ON pa.project_id = u.id
        WHERE pa.user_id::text = ${session.user.id}
        ORDER BY u.email;
      `;
      
      results.myAssignments = myAssignments;

      // Test die Query, die in /api/data verwendet wird
      const { rows: dataApiQuery } = await sql`
        SELECT 
          u.id::text as id, 
          u.email, 
          u.domain, 
          u.gsc_site_url, 
          u.ga4_property_id 
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${session.user.id}
        AND u.role = 'BENUTZER'
        ORDER BY u.email ASC;
      `;
      
      results.dataApiQueryResult = dataApiQuery;
    }

    // 5. Zeige Tabellen-Schema
    const { rows: tableSchema } = await sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'project_assignments'
      ORDER BY ordinal_position;
    `;
    results.tableSchema = tableSchema;

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('Debug-Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Debugging',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
