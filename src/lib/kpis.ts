// src/lib/kpis.ts
export interface KpiValue { value: number; change: number }
export interface KpiDashboard {
  searchConsole: { clicks: KpiValue; impressions: KpiValue };
  analytics: { sessions: KpiValue; totalUsers: KpiValue };
}

const ZERO: KpiDashboard = {
  searchConsole: {
    clicks: { value: 0, change: 0 },
    impressions: { value: 0, change: 0 },
  },
  analytics: {
    sessions: { value: 0, change: 0 },
    totalUsers: { value: 0, change: 0 },
  },
};

// akzeptiert undefined/partial und gibt IMMER vollständige KPIs zurück
export function normalizeKpis(input?: Partial<KpiDashboard>): KpiDashboard {
  return {
    searchConsole: {
      clicks: {
        value: input?.searchConsole?.clicks?.value ?? 0,
        change: input?.searchConsole?.clicks?.change ?? 0,
      },
      impressions: {
        value: input?.searchConsole?.impressions?.value ?? 0,
        change: input?.searchConsole?.impressions?.change ?? 0,
      },
    },
    analytics: {
      sessions: {
        value: input?.analytics?.sessions?.value ?? 0,
        change: input?.analytics?.sessions?.change ?? 0,
      },
      totalUsers: {
        value: input?.analytics?.totalUsers?.value ?? 0,
        change: input?.analytics?.totalUsers?.change ?? 0,
      },
    },
  };
}

// kleines Helferlein, um überall defensiv zuzugreifen
export function safeKpis<T extends { kpis?: Partial<KpiDashboard> } | null | undefined>(
  data: T
): KpiDashboard {
  return normalizeKpis((data as any)?.kpis);
}
