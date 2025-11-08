// src/lib/database.ts

import { sql } from '@vercel/postgres';
import { User } from '@/types'; 

// Funktion zum Erstellen ALLER Tabellen (Idempotent)
export async function createTables() {
  try {
    
    // 1. Users-Tabelle (Primärtabelle)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('SUPERADMIN', 'ADMIN', 'BENUTZER')),
        
        mandant_id VARCHAR(255) NULL, 
        permissions TEXT[] DEFAULT '{}', 

        domain VARCHAR(255),
        gsc_site_url VARCHAR(255),
        ga4_property_id VARCHAR(255),
        semrush_project_id VARCHAR(255),
        semrush_tracking_id VARCHAR(255),       // Für Kampagne 1
        semrush_tracking_id_02 VARCHAR(255),    // Für Kampagne 2
        favicon_url TEXT NULL,
        
        "createdByAdminId" UUID REFERENCES users(id),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- Nützlich für Cache-Updates
      );
    `;
    console.log('Tabelle "users" erfolgreich geprüft/erstellt.');

    // 2. Landingpages-Tabelle
    await sql`
      CREATE TABLE IF NOT EXISTS landingpages (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        haupt_keyword TEXT,
        weitere_keywords TEXT,
        status VARCHAR(50) DEFAULT 'Offen',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        -- GSC-Daten-Spalten
        gsc_klicks INTEGER,
        gsc_klicks_change INTEGER,
        gsc_impressionen INTEGER,
        gsc_impressionen_change INTEGER,
        gsc_position DECIMAL(5, 2),
        gsc_position_change DECIMAL(5, 2),
        gsc_last_updated TIMESTAMP WITH TIME ZONE,
        gsc_last_range VARCHAR(10),

        UNIQUE(url, user_id)
      );
    `;
    console.log('Tabelle "landingpages" erfolgreich geprüft/erstellt.');

    // 3. Landingpage Logs-Tabelle
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

    // 4. Notifications-Tabelle
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        related_landingpage_id INTEGER REFERENCES landingpages(id) ON DELETE SET NULL
      );
    `;
    console.log('Tabelle "notifications" erfolgreich geprüft/erstellt.');

    // 5. Project Assignments-Tabelle (Admin -> Kunde)
    await sql`
      CREATE TABLE IF NOT EXISTS project_assignments (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,     -- Der Admin (user_id)
        project_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- Der Kunde (project_id, der auch ein User ist)
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, project_id)
      );
    `;
     console.log('Tabelle "project_assignments" erfolgreich geprüft/erstellt.');

    // 6. Semrush Cache-Tabelle
    await sql`
      CREATE TABLE IF NOT EXISTS semrush_keywords_cache (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign VARCHAR(50) NOT NULL,
        keywords_data JSONB NOT NULL,
        last_fetched TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, campaign)
      );
    `;
    console.log('Tabelle "semrush_keywords_cache" erfolgreich geprüft/erstellt.');

    // 7. Google Data Cache-Tabelle
    await sql`
      CREATE TABLE IF NOT EXISTS google_data_cache (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date_range VARCHAR(10) NOT NULL,
        data JSONB NOT NULL,
        last_fetched TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, date_range)
      );
    `;
    console.log('Tabelle "google_data_cache" erfolgreich geprüft/erstellt.');

    // 8. ✅ NEU: Mandanten/Label Logo-Tabelle
    await sql`
      CREATE TABLE IF NOT EXISTS mandanten_logos (
        mandant_id VARCHAR(255) PRIMARY KEY,
        logo_url TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Tabelle "mandanten_logos" erfolgreich geprüft/erstellt.');


    // (Indizes für Performance hinzufügen)
    await sql`CREATE INDEX IF NOT EXISTS idx_landingpages_user_id ON landingpages(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_google_data_cache_user_id ON google_data_cache(user_id);`;

    console.log('Alle Indizes geprüft/erstellt.');


  } catch (error: unknown) {
    console.error('Fehler beim Erstellen der Tabellen:', error);
    throw new Error('Tabellen konnten nicht erstellt werden.');
  }
}

// Funktion zum Abrufen eines Benutzers anhand seiner E-Mail (unverändert)
export async function getUserByEmail(email: string) {
  try {
    const { rows } = await sql`SELECT * FROM users WHERE email=${email}`;
    return rows[0] as User;
  } catch (error: unknown) {
    console.error('Fehler beim Abrufen des Benutzers:', error);
    throw new Error('Benutzer konnte nicht gefunden werden.');
  }
}
