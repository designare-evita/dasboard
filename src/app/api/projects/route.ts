// src/app/api/projects/route.ts
// Liste aller "Projekte" (= Benutzer mit Rolle BENUTZER)

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User } from '@/types';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;

    let result;
    
    if (role === 'SUPERADMIN') {
      // Superadmin sieht alle BENUTZER als "Projekte"
      result = await sql<User>`
        SELECT id, email, domain, gsc_site_url, ga4_property_id, "createdByAdminId", "createdAt"
        FROM users 
        WHERE role = 'BENUTZER'
        ORDER BY "createdAt" DESC
      `;
    } else if (role === 'ADMIN') {
      // Admin sieht nur seine eigenen BENUTZER als "Projekte"
      result = await sql<User>`
        SELECT id, email, domain, gsc_site_url, ga4_property_id, "createdByAdminId", "createdAt"
        FROM users 
        WHERE role = 'BENUTZER' AND "createdByAdminId" = ${id}
        ORDER BY "createdAt" DESC
      `;
    } else {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Fehler beim Abrufen der Projekte:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
