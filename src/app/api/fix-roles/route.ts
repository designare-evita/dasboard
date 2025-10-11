// src/app/api/fix-roles/route.ts

import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const result = await sql`
      UPDATE users 
      SET role = 'BENUTZER' 
      WHERE role = 'USER';
    `;
    
    const updatedCount = result.rowCount;

    return NextResponse.json({ message: `Reparatur erfolgreich! ${updatedCount} Benutzerrolle(n) wurden von 'USER' zu 'BENUTZER' korrigiert.` }, { status: 200 });
  } catch (error) {
    console.error("Fehler bei der Reparatur der Benutzerrollen:", error);
    return NextResponse.json({ message: "Bei der Reparatur ist ein Fehler aufgetreten." }, { status: 500 });
  }
}
