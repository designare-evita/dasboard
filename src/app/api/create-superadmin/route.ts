import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

// Diese Route dient nur zum einmaligen Anlegen des Super-Admins.
// Nach der Verwendung sollte sie aus Sicherheitsgründen entfernt werden.
export async function GET() {
  try {
    const email = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error('SUPERADMIN_EMAIL oder SUPERADMIN_PASSWORD sind in den Environment Variables nicht gesetzt.');
    }

    // Passwort sicher verschlüsseln (hashen)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Benutzer in die Datenbank einfügen
    await sql`
      INSERT INTO users (email, password, role)
      VALUES (${email.toLowerCase()}, ${hashedPassword}, 'SUPERADMIN')
      ON CONFLICT (email) DO UPDATE SET password = ${hashedPassword};
    `;

    return NextResponse.json({ message: `Super-Admin ${email} erfolgreich angelegt/aktualisiert.` });

  } catch (error) {
    return NextResponse.json(
      { message: 'Fehler beim Erstellen des Super-Admins', error: (error as Error).message },
      { status: 500 }
    );
  }
}
