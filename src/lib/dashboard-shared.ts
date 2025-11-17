// src/lib/dashboard-shared.ts

import { DateRangeOption } from "@/components/DateRangeSelector";

// --- 1. Geteilte Typen ---

export type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

export interface KpiDatum {
  value: number;
  change: number;
  aiTraffic?: {
    value: number;
    percentage: number;
  };
}

export interface ChartPoint {
  date: string;
  value: number;
}

export interface TopQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface AiTrafficData {
  totalSessions: number;
  totalUsers: number;
  sessionsBySource: {
    : number;
  };
  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  trend: Array<{
    date: string;
    sessions: number;
  }>;
}

/**
 * Ein Eintrag für ein Kuchendiagramm
 */
export type ChartEntry = {
  name: string;
  value: number;
  fill: string; // Farbe für das Diagrammsegment
};

// +++ NEU: Schnittstelle für API-Fehler +++
/**
 * Speichert den Fehlerstatus von GSC oder GA4, falls eine API fehlschlägt.
 */
export interface ApiErrorStatus {
  gsc?: string; // Fehlermeldung für GSC
  ga4?: string; // Fehlermeldung für GA4
}
// +++ ENDE NEU +++


/**
 * Die Struktur für die Dashboard-Daten,
 * die von beiden Seiten (page.tsx und [id]/page.tsx) verwendet wird.
 */
export interface ProjectDashboardData {
  kpis?: {
    clicks?: KpiDatum;
    impressions?: KpiDatum;
    sessions?: KpiDatum;
    totalUsers?: KpiDatum;
  };
  charts?: {
    clicks?: ChartPoint[];
    impressions?: ChartPoint[];
    sessions?: ChartPoint[];
    totalUsers?: ChartPoint[];
  };
  topQueries?: TopQueryData[];
  aiTraffic?: AiTrafficData;
  // Daten für die drei Kreisdiagramme
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
  
  // +++ NEU: apiErrors-Feld hinzugefügt +++
  apiErrors?: ApiErrorStatus;
}


// --- 2. Geteilte Konstanten ---

/**
 * Metadaten für die Chart-Tabs (Titel und Farbe).
 */
export const KPI_TAB_META: Record<ActiveKpi, { title: string; color: string }> = {
  clicks: { title: 'Klicks', color: '#3b82f6' },
  impressions: { title: 'Impressionen', color: '#8b5cf6' },
  sessions: { title: 'Sitzungen', color: '#10b981' },
  totalUsers: { title: 'Nutzer', color: '#f59e0b' },
};

/**
 * Ein Standard-KPI-Objekt für den Fall, dass keine Daten vorhanden sind.
 */
export const ZERO_KPI: KpiDatum = { value: 0, change: 0 };


// --- 3. Geteilte Hilfsfunktionen ---

/**
 * Stellt sicher, dass die KPI-Daten immer ein valides Objekt sind,
 * auch wenn die API "undefined" zurückgibt.
 */
export function normalizeFlatKpis(input?: ProjectDashboardData['kpis']) {
  return {
    clicks: input?.clicks ?? ZERO_KPI,
    impressions: input?.impressions ?? ZERO_KPI,
    sessions: input?.sessions ?? ZERO_KPI,
    totalUsers: input?.totalUsers ?? ZERO_KPI,
  };
}

/**
 * Prüft, ob sinnvolle KPI- oder Chart-Daten vorhanden sind.
 */
export function hasDashboardData(data: ProjectDashboardData): boolean {
  // +++ NEU: Prüft auch auf Fehler. Wenn Fehler da sind, sollen Daten als "nicht vorhanden" gelten.
  if (data.apiErrors?.gsc && data.apiErrors?.ga4) {
    return false; // Wenn beide APIs fehlschlagen, zeige nichts.
  }
  // +++ ENDE NEU +++

  const k = normalizeFlatKpis(data.kpis);
  
  const hasAnyKpiValue =
    (k.clicks.value > 0) ||
    (k.impressions.value > 0) ||
    (k.sessions.value > 0) ||
    (k.totalUsers.value > 0);

  const hasAnyChartData =
    !!data.charts &&
    Boolean(
      (data.charts.clicks && data.charts.clicks.length) ||
      (data.charts.impressions && data.charts.impressions.length) ||
      (data.charts.sessions && data.charts.sessions.length) ||
      (data.charts.totalUsers && data.charts.totalUsers.length)
    );
    
  return hasAnyKpiValue || hasAnyChartData;
}
