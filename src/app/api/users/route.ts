// src/app/api/users/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { User } from '@/types';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const createdByAdminId = session.user.id; 
    const { email, password, role, domain, gsc_site_url, ga4_property_id } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ message: 'E-Mail, Passwort und Rolle sind erforderlich' }, { status: 400 });
    }

    const { rows } = await sql<User>`SELECT * FROM users WHERE email = ${email}`;
    if (rows.length > 0) {
      return NextResponse.json({ message: 'Benutzer existiert bereits' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { rows: newUsers } = await sql<User>`
      INSERT INTO users (email, password, role, domain, gsc_site_url, ga4_property_id, "createdByAdminId") 
      VALUES (${email}, ${hashedPassword}, ${role}, ${domain}, ${gsc_site_url}, ${ga4_property_id}, ${createdByAdminId}) 
      RETURNING id, email, role, domain`;

    return NextResponse.json(newUsers[0], { status: 201 });

  } catch (error) {
    console.error('Fehler bei der Benutzererstellung:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  
  console.log('[/api/users] GET Request');
  console.log('[/api/users] User:', session?.user?.email, 'Role:', session?.user?.role);
  
  if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    let result;
    
    if (session.user.role === 'SUPERADMIN') {
      console.log('[/api/users] SUPERADMIN - Lade alle Benutzer außer SUPERADMIN');
      
      // Superadmin sieht alle Admins und Benutzer
      result = await sql`
        SELECT id::text as id, email, role, domain 
        FROM users 
        WHERE role != 'SUPERADMIN'
        ORDER BY role DESC, email ASC
      `;
      
      console.log('[/api/users] Gefunden:', result.rows.length, 'Benutzer');
      
    } else { // ADMIN
      console.log('[/api/users] ADMIN - Lade zugewiesene Projekte');
      
      // ✅ KORREKTUR: Admin sieht nur die ihm zugewiesenen Benutzer-Projekte
      result = await sql`
        SELECT 
          u.id::text as id, 
          u.email, 
          u.role, 
          u.domain 
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${session.user.id}
        AND u.role = 'BENUTZER'
        ORDER BY u.email ASC
      `;
      
      console.log('[/api/users] Gefunden:', result.rows.length, 'zugewiesene Projekte');
      
      // Debug: Falls keine Projekte gefunden wurden
      if (result.rows.length === 0) {
        const { rows: debugAssignments } = await sql`
          SELECT 
            pa.project_id::text,
            u.email,
            u.role
          FROM project_assignments pa
          LEFT JOIN users u ON pa.project_id = u.id
          WHERE pa.user_id::text = ${session.user.id}
        `;
        
        console.log('[/api/users] Debug - Alle Zuweisungen:', debugAssignments);
      }
    }
    
    return NextResponse.json(result.rows);
    
  } catch (error) {
    console.error('[/api/users] Fehler beim Abrufen der Benutzer:', error);
    return NextResponse.json({ 
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}
