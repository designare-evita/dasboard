// src/lib/database.ts

import { sql } from '@vercel/postgres';
import { User } from '@/types'; // Stelle sicher, dass User in @/types auch die neuen Felder hat

// Funktion zum Erstellen der Tabellen
export async function createTables() {
  try {
    // Users-Tabelle mit den neuen Spalten definieren
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('SUPERADMIN', 'ADMIN', 'BENUTZER')),
        domain VARCHAR(255),
        gsc_site_url VARCHAR(255),
        ga4_property_id VARCHAR(255),

        -- HIER DIE NEUEN SPALTEN --
        semrush_project_id VARCHAR(255),
        tracking_id VARCHAR(255),
        ---------------------------

        "createdByAdminId" UUID REFERENCES users(id),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        semrush_organic_keywords INTEGER,
        semrush_organic_traffic INTEGER,
        semrush_last_fetched TIMESTAMP WITH TIME ZONE
      );
    `;
    // Angepasste Log-Nachricht
    console.log('Tabelle "users" erfolgreich geprüft/erstellt (inkl. semrush_project_id & tracking_id).');

    // Projects-Tabelle (aus deiner hochgeladenen Datei übernommen)
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'Offen',
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Tabelle "projects" erfolgreich geprüft/erstellt.');

    // Landingpages-Tabelle (Achtung: Schema prüfen!)
    // Das Schema hier unterscheidet sich von dem, was in anderen API-Routen verwendet wird.
    // Eventuell muss dies auch angepasst werden, basierend auf src/app/api/users/[id]/landingpages/route.ts etc.
    // Aktuell übernehme ich es aus deiner hochgeladenen Datei:
    await sql`
      CREATE TABLE IF NOT EXISTS landingpages (
        id SERIAL PRIMARY KEY, -- ID ist SERIAL statt UUID in deiner Datei? Korrigiert zu SERIAL
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        haupt_keyword TEXT,
        weitere_keywords TEXT,
        suchvolumen INTEGER,
        aktuelle_position INTEGER,
        status VARCHAR(50) DEFAULT 'Offen', -- Status VARCHAR(50) und Default 'Offen'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(url, user_id) -- Wichtig: Unique Constraint hinzufügen
      );
    `;
    console.log('Tabelle "landingpages" erfolgreich geprüft/erstellt.');

    // Notifications-Tabelle (wird in Status-Updates benötigt)
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        related_landingpage_id INTEGER REFERENCES landingpages(id) ON DELETE SET NULL -- SET NULL statt CASCADE
      );
    `;
    console.log('Tabelle "notifications" erfolgreich geprüft/erstellt.');

    // Project Assignments Tabelle (wird benötigt)
    await sql`
      CREATE TABLE IF NOT EXISTS project_assignments (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- project_id referenziert users(id)
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Optional: Zeitstempel hinzugefügt
        PRIMARY KEY (user_id, project_id)
      );
    `;
     console.log('Tabelle "project_assignments" erfolgreich geprüft/erstellt.');

     // Landingpage Logs Tabelle (wird benötigt)
     await sql`
        CREATE TABLE IF NOT EXISTS landingpage_logs (
          id SERIAL PRIMARY KEY,
          landingpage_id INTEGER NOT NULL REFERENCES landingpages(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          user_email VARCHAR(255),
          action TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
     `;
     console.log('Tabelle "landingpage_logs" erfolgreich geprüft/erstellt.');


  } catch (error: unknown) {
    console.error('Fehler beim Erstellen der Tabellen:', error);
    throw new Error('Tabellen konnten nicht erstellt werden.');
  }
}

// Funktion, um einen Benutzer anhand seiner E-Mail zu finden (unverändert)
export async function getUserByEmail(email: string) {
  try {
    const { rows } = await sql`SELECT * FROM users WHERE email=${email}`;
    return rows[0] as User;
  } catch (error: unknown) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    throw new Error('Benutzer konnte nicht gefunden werden.');
  }
}
