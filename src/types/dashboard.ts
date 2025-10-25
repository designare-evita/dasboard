// src/types/dashboard.ts

export type KPI = {
  value: number;
  change: number;
  aiTraffic?: {
    value: number;
    percentage: number;
  };
};

export type ChartData = {
  date: string;
  value: number;
}[];

export type TopQueryData = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type AiTrafficData = {
  totalSessions: number;
  totalUsers: number;
  sessionsBySource: {
    [source: string]: number;
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
};

export type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

export type KpiMetadata = {
  title: string;
  color: string;
};

export const KPI_TAB_META: Record<ActiveKpi, KpiMetadata> = {
  clicks: { title: 'Klicks', color: '#3b82f6' },
  impressions: { title: 'Impressionen', color: '#8b5cf6' },
  sessions: { title: 'Sitzungen', color: '#10b981' },
  totalUsers: { title: 'Nutzer', color: '#f59e0b' },
};

export interface Kpis {
  clicks: Kpi;
  impressions: Kpi;
  sessions: Kpi;
  totalUsers: Kpi;
  // --- NEU HINZUGEFÜGT ---
  semrushKeywords: Kpi;
  semrushTraffic: Kpi;
  // --------------------
}

export interface ApiData {
  kpis: Kpis;
  charts: {
    // ... (clicks, impressions, etc.) ...
  };
  topQueries: Array<{
    // ... (query, clicks, etc.) ...
  }>;
  aiTraffic: any; // Sieht so aus, als wäre das noch 'any'
  // --- NEU HINZUGEFÜGT ---
  semrushError?: string | null; // Für Fehlerbehandlung
  // --------------------
  error?: string;
}
