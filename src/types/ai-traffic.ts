// src/types/ai-traffic.ts

export interface AiTrafficData {
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
}

export interface KpiWithAiTraffic extends KPI {
  aiTraffic?: {
    value: number;
    change: number;
    percentage: number;
  };
}

export type KPI = {
  value: number;
  change: number;
};
