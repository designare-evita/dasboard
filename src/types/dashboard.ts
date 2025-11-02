// src/types/dashboard.ts

export type KPI = {
  value: number;
  change: number;
  aiTraffic?: {
    value: number;
    percentage: number;
  };
};

// ✅ NEU: 'ChartPoint' als eigenen Typ exportieren
export type ChartPoint = {
  date: string;
  value: number;
};

// ✅ ALT: 'ChartData' verwendet jetzt 'ChartPoint'
export type ChartData = ChartPoint[];

export type TopQueryData = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

// ... (Rest der Datei bleibt gleich) ...
export type AiTrafficData = {
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
