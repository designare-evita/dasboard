// src/lib/dashboard-shared.ts
import { DateRangeOption } from "@/components/DateRangeSelector";
import type { 
  KpiDatum, 
  ChartPoint, 
  TopQueryData, 
  ActiveKpi as BaseActiveKpi 
} from '@/types/dashboard';

import type { AiTrafficData } from '@/types/ai-traffic';

// Re-exportiere die Basis-Typen
export type { KpiDatum, ChartPoint, TopQueryData, AiTrafficData };

// Wir erweitern den ActiveKpi Typ um alle neuen Metriken
export type ActiveKpi = BaseActiveKpi | 'conversions' | 'engagementRate' | 'bounceRate' | 'newUsers' | 'avgEngagementTime';

export type ChartEntry = {
  name: string;
  value: number;
  fill: string;
};

export interface ApiErrorStatus {
  gsc?: string;
  ga4?: string;
}

export interface ProjectDashboardData {
  kpis?: {
    clicks?: KpiDatum;
    impressions?: KpiDatum;
    sessions?: KpiDatum;
    totalUsers?: KpiDatum;
    
    // Erweiterte GA4 Metriken
    conversions?: KpiDatum;     
    engagementRate?: KpiDatum; 
    bounceRate?: KpiDatum;        // ✅ NEU
    newUsers?: KpiDatum;          // ✅ NEU
    avgEngagementTime?: KpiDatum; // ✅ NEU
  };
  charts?: {
    clicks?: ChartPoint[];
    impressions?: ChartPoint[];
    sessions?: ChartPoint[];
    totalUsers?: ChartPoint[];
    
    // Charts für erweiterte Metriken
    conversions?: ChartPoint[];
    engagementRate?: ChartPoint[];
    bounceRate?: ChartPoint[];        // ✅ NEU
    newUsers?: ChartPoint[];          // ✅ NEU
    avgEngagementTime?: ChartPoint[]; // ✅ NEU
  };
  topQueries?: TopQueryData[];
  aiTraffic?: AiTrafficData;
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
  apiErrors?: ApiErrorStatus;
  fromCache?: boolean; 
}

// ✅ NEU: Farben und Titel für ALLE KPIs
export const KPI_TAB_META: Record<ActiveKpi, { title: string; color: string }> = {
  clicks: { title: 'Klicks', color: '#3b82f6' },
  impressions: { title: 'Impressionen', color: '#8b5cf6' },
  sessions: { title: 'Sitzungen', color: '#10b981' },
  totalUsers: { title: 'Nutzer', color: '#f59e0b' },
  
  conversions: { title: 'Conversions (Ziele)', color: '#10b981' }, // Emerald
  engagementRate: { title: 'Engagement Rate', color: '#ec4899' },  // Pink
  bounceRate: { title: 'Absprungrate', color: '#ef4444' },         // Red
  newUsers: { title: 'Neue Besucher', color: '#6366f1' },          // Indigo
  avgEngagementTime: { title: 'Ø Verweildauer', color: '#06b6d4' } // Cyan
};

export const ZERO_KPI: KpiDatum = { value: 0, change: 0 };

export function normalizeFlatKpis(input?: ProjectDashboardData['kpis']) {
  return {
    clicks: input?.clicks ?? ZERO_KPI,
    impressions: input?.impressions ?? ZERO_KPI,
    sessions: input?.sessions ?? ZERO_KPI,
    totalUsers: input?.totalUsers ?? ZERO_KPI,
    
    conversions: input?.conversions ?? ZERO_KPI,
    engagementRate: input?.engagementRate ?? ZERO_KPI,
    bounceRate: input?.bounceRate ?? ZERO_KPI,
    newUsers: input?.newUsers ?? ZERO_KPI,
    avgEngagementTime: input?.avgEngagementTime ?? ZERO_KPI,
  };
}

export function hasDashboardData(data: ProjectDashboardData): boolean {
  if (data.apiErrors?.gsc && data.apiErrors?.ga4) return false;

  const k = normalizeFlatKpis(data.kpis);
  
  const hasAnyKpiValue =
    (k.clicks.value > 0) ||
    (k.impressions.value > 0) ||
    (k.sessions.value > 0) ||
    (k.totalUsers.value > 0) ||
    (k.conversions.value > 0);

  const hasAnyChartData = !!data.charts; 
    
  return hasAnyKpiValue || hasAnyChartData || !!data.apiErrors;
}
