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

// ✅ HIER GEÄNDERT: Neue Felder für Conversions (subValue2)
export interface ChartEntry {
  name: string;
  value: number;
  fill?: string;
  
  // Für Engagement/Interaktionsrate
  subValue?: string;
  subLabel?: string;
  
  // Neu für Conversions
  subValue2?: number;
  subLabel2?: string;
}

export interface ApiErrorStatus {
  gsc?: string;
  ga4?: string;
  semrush?: string;
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
    bounceRate?: KpiDatum;        
    newUsers?: KpiDatum;          
    avgEngagementTime?: KpiDatum; 
  };
  charts?: {
    clicks?: ChartPoint[];
    impressions?: ChartPoint[];
    sessions?: ChartPoint[];
    totalUsers?: ChartPoint[];
    conversions?: ChartPoint[];
    engagementRate?: ChartPoint[];
    bounceRate?: ChartPoint[];
    newUsers?: ChartPoint[];
    avgEngagementTime?: ChartPoint[];
  };
  topQueries?: TopQueryData[];
  aiTraffic?: AiTrafficData;
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
  
  apiErrors?: ApiErrorStatus;
  fromCache?: boolean;
}

// Default Werte Helper
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
  // Einfacher Check: Haben wir Klicks oder Sessions > 0?
  if (k.clicks.value > 0 || k.sessions.value > 0) return true;

  return false;
}
