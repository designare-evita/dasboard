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
}
