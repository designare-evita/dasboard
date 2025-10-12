// src/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { User } from '@/types'; // Import User-Typ für GET
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, role, domain, created_by } = body;

    if (!email || !password) {
      return NextResponse.json({ message: 'E-Mail und Passwort sind erforderlich' }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ message: 'Benutzer existiert bereits' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: { email, password: hashedPassword, role, domain, created_by },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) { // ✅ KORREKTUR: Wir verwenden die Variable 'error' für das Logging.
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
    if (userRole === 'SUPERADMIN') {
        users = await db.user.findMany({
            where: { role: { not: 'SUPERADMIN' } },
            select: { id: true, email: true, role: true, domain: true }
        });
    } else if (userRole === 'ADMIN') {
        users = await db.user.findMany({
            where: { created_by: userId },
            select: { id: true, email: true, role: true, domain: true }
        });
    } else {
        return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
    }
    return NextResponse.json(users);
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzer:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
