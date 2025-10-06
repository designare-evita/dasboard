import { sql } from '@vercel/postgres';
import { User } from '@/types'; 

// Funktion zum Erstellen der Tabellen
export async function createTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('SUPERADMIN', 'ADMIN', 'BENUTZER')),
        domain VARCHAR(255),
        gsc_site_url VARCHAR(255),
        ga4_property_id VARCHAR(255),
        "createdByAdminId" UUID REFERENCES users(id),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Tabelle "users" erfolgreich geprüft/erstellt.');

    // Der Rest der Datei bleibt unverändert...
    // ...
  } catch (error) {
    console.error('Fehler beim Erstellen der Tabellen:', error);
    throw new Error('Tabellen konnten nicht erstellt werden.');
  }
}

// Funktion, um einen Benutzer anhand seiner E-Mail zu finden
export async function getUserByEmail(email: string) {
  try {
    const user = await sql`SELECT * FROM users WHERE email=${email}`;
    return user.rows[0] as User;
  } catch (error) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    throw new Error('Benutzer konnte nicht gefunden werden.');
  }
}
