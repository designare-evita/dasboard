import { sql } from '@vercel/postgres';
import { User } from '@/types';

// ✅ KORREKTUR: Wir erstellen und exportieren ein 'db'-Objekt.
// Deine API-Routen versuchen, dieses Objekt zu importieren.
export const db = {
  // Wir machen die 'sql'-Funktion als 'db.query' verfügbar, um konsistent zu bleiben.
  query: sql,
};

// Funktion zum Erstellen der Tabellen
export async function createTables() {
  try {
    // Wir verwenden jetzt db.query für alle Datenbankoperationen
    await db.query`
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

    await db.query`
      CREATE TABLE IF NOT EXISTS landingpages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        url VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL CHECK (status IN ('Offen', 'Wartet auf Freigabe', 'Freigegeben', 'Online')),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Tabelle "landingpages" erfolgreich geprüft/erstellt.');
  } catch (error: unknown) {
    console.error('Fehler beim Erstellen der Tabellen:', error);
    throw new Error('Tabellen konnten nicht erstellt werden.');
  }
}

// Funktion, um einen Benutzer anhand seiner E-Mail zu finden
export async function getUserByEmail(email: string) {
  try {
    const { rows } = await db.query`SELECT * FROM users WHERE email=${email}`;
    return rows[0] as User;
  } catch (error: unknown) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    throw new Error('Benutzer konnte nicht gefunden werden.');
  }
}
