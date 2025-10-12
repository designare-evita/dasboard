// src/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { User } from '@/types';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, role, domain, created_by } = body;

    if (!email || !password) {
      return NextResponse.json({ message: 'E-Mail und Passwort sind erforderlich' }, { status: 400 });
    }

    // ✅ KORREKTUR: Prisma-Befehl durch SQL-Abfrage ersetzt
    const { rows } = await db.query<User>(`SELECT * FROM users WHERE email = $1`, [email]);
    const existingUser = rows[0];

    if (existingUser) {
      return NextResponse.json({ message: 'Benutzer existiert bereits' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ KORREKTUR: Prisma-Befehl durch SQL-Abfrage ersetzt
    const { rows: newUsers } = await db.query<User>(
      `INSERT INTO users (email, password, role, domain, "createdByAdminId") 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, role, domain`,
      [email, hashedPassword, role, domain, created_by]
    );

    return NextResponse.json(newUsers[0], { status: 201 });

  } catch (error) {
    console.error('Fehler bei der Benutzererstellung:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    try {
        let users;
        // Superadmin sieht alle außer sich selbst
        if (userRole === 'SUPERADMIN') {
            users = await db.query(`
                SELECT id, email, role, domain FROM users WHERE role != 'SUPERADMIN'
            `);
        // Admin sieht nur die von ihm erstellten Benutzer
        } else if (userRole === 'ADMIN') {
            users = await db.query(`
                SELECT id, email, role, domain FROM users WHERE "createdByAdminId" = $1
            `, [userId]);
        } else {
            return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
        }
        return NextResponse.json(users.rows);
    } catch (error) {
        console.error('Fehler beim Abrufen der Benutzer:', error);
        return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
    }
}
