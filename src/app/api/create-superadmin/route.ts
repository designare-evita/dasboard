import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const email = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error('SUPERADMIN_EMAIL oder SUPERADMIN_PASSWORD nicht in Vercel gesetzt.');
    }

    console.log(`[Super-Admin Setup] Versuche, Admin mit E-Mail zu erstellen: ${email}`);

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(`[Super-Admin Setup] Passwort wurde erfolgreich gehasht.`);

    const result = await sql`
      INSERT INTO users (email, password, role)
      VALUES (${email.toLowerCase()}, ${hashedPassword}, 'SUPERADMIN')
      ON CONFLICT (email) DO UPDATE SET password = ${hashedPassword};
    `;

    if (result.rowCount > 0) {
      console.log(`[Super-Admin Setup] Benutzer ${email} wurde erfolgreich in der Datenbank erstellt/aktualisiert.`);
      return NextResponse.json({ message: `Super-Admin ${email} erfolgreich angelegt/aktualisiert.` });
    } else {
      console.log(`[Super-Admin Setup] Benutzer ${email} existierte bereits und wurde nicht geändert.`);
      return NextResponse.json({ message: `Super-Admin ${email} existierte bereits.` });
    }

  } catch (error) {
    console.error('[Super-Admin Setup] Ein schwerwiegender Fehler ist aufgetreten:', error);
    return NextResponse.json(
      { message: 'Fehler beim Erstellen des Super-Admins', error: (error as Error).message },
      { status: 500 }
    );
  }
}
