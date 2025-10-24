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
