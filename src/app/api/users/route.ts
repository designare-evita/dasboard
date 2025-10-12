// src/app/api/users/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres'; // Wir verwenden sql direkt
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
    // Holen der ID des erstellenden Admins aus der Session
    const createdByAdminId = session.user.id; 
    const { email, password, role, domain, gsc_site_url, ga4_property_id } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ message: 'E-Mail, Passwort und Rolle sind erforderlich' }, { status: 400 });
    }

    // KORREKTUR: Prisma-Befehl durch SQL ersetzt
    const { rows } = await sql<User>`SELECT * FROM users WHERE email = ${email}`;
    if (rows.length > 0) {
      return NextResponse.json({ message: 'Benutzer existiert bereits' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // KORREKTUR: Prisma-Befehl durch SQL ersetzt
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
    if (!session?.user?.id || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
        return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
    }

    try {
        let result;
        if (session.user.role === 'SUPERADMIN') {
            // Superadmin sieht alle Admins und Benutzer
            result = await sql`
                SELECT id, email, role, domain FROM users WHERE role != 'SUPERADMIN'
            `;
        } else { // ADMIN
            // Admin sieht nur die von ihm erstellten Benutzer
            result = await sql`
                SELECT id, email, role, domain FROM users WHERE "createdByAdminId" = ${session.user.id}
            `;
        }
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Fehler beim Abrufen der Benutzer:', error);
        return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
    }
}
