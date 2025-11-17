// src/types/index.ts

// Definiert die Struktur eines Benutzer-Objekts, wie es in der Datenbank gespeichert wird.
export interface User {
  id: string;
  email: string;
  password?: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'BENUTZER';
  mandant_id?: string | null;
  permissions?: string[];
  domain?: string;
  gsc_site_url?: string;
  ga4_property_id?: string;
  semrush_project_id?: string | null;
  semrush_tracking_id?: string | null;
  semrush_tracking_id_02?: string | null;
  createdByAdminId?: string;
  createdAt: Date;
  semrush_organic_keywords?: number;
  semrush_organic_traffic?: number;
  semrush_last_fetched?: string;
  favicon_url?: string;
  project_start_date?: Date | null;
  project_duration_months?: number | null;
  project_timeline_active?: boolean | null;
}

export interface Landingpage {
  id: number;
  url: string;
  status: 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';
  haupt_keyword?: string;
  weitere_keywords?: string;
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

// Re-export dashboard types
export type {
  KPI,
  KpiDatum,
  ChartPoint,
  ChartData,
  TopQueryData,
  ActiveKpi,
  KpiMetadata
} from './dashboard';

// Re-export ai-traffic types
export type {
  AiTrafficData,
  AiTrafficCardProps
} from './ai-traffic';
