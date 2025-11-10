// src/lib/kpis.ts
export interface KpiValue { value: number; change: number }

export interface KpiDashboard {
  searchConsole: { clicks: KpiValue; impressions: KpiValue };
  analytics: { sessions: KpiValue; totalUsers: KpiValue };
}

/**
 * Mischt (optionale/teilweise) KPI-Daten robust zu einem vollständigen Objekt.
 * Gibt immer ein vollständiges KpiDashboard zurück.
 */
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

type WithOptionalKpis = { kpis?: Partial<KpiDashboard> } | null | undefined;

/**
 * Safeguard: Nimmt ein Objekt, das evtl. kpis enthält (oder nicht),
 * und liefert immer ein vollständiges KPI-Objekt.
 */
export function safeKpis(data: WithOptionalKpis): KpiDashboard {
  return normalizeKpis(data?.kpis);
}
