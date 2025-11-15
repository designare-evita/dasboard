// src/types/index.ts

// Definiert die Struktur eines Benutzer-Objekts, wie es in der Datenbank gespeichert wird.
export interface User {
  id: string;
  email: string;
  password?: string; // Das Passwort sollte nie an das Frontend gesendet werden
  role: 'SUPERADMIN' | 'ADMIN' | 'BENUTZER';
  mandant_id?: string | null; // NEU: Das "Label" / die Gruppe
  permissions?: string[]; // NEU: Die "Klasse" / Berechtigungen
  domain?: string;
  gsc_site_url?: string; // NEU: Feld für die GSC URL
  ga4_property_id?: string; // NEU: Feld für die GA4 ID
  semrush_project_id?: string | null;
  semrush_tracking_id?: string | null;
  semrush_tracking_id_02?: string | null;
  createdByAdminId?: string;
  createdAt: Date;
  semrush_organic_keywords?: number;
  semrush_organic_traffic?: number;
  semrush_last_fetched?: string; // Kommt als String/Date von der DB
  favicon_url?: string;

  // ✅ NEU: Felder für Projekt-Timeline
  project_start_date?: Date | null;
  project_duration_months?: number | null;
}

export interface Landingpage {
  id: number;
  url: string;
  status: 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';
  haupt_keyword?: string;
  weitere_keywords?: string;

  // GSC-Felder:
  gsc_klicks: number | null;
  gsc_klicks_change: number | null;
  gsc_impressionen: number | null;
  gsc_impressionen_change: number | null;
  gsc_position: number | string | null; 
  gsc_position_change: number | string | null; 
  gsc_last_updated: string | null;
  gsc_last_range: string | null;
}

export type LandingpageStatus = Landingpage['status'];
