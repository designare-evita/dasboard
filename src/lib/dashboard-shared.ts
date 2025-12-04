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

// ✅ UPDATE: 'aiTraffic' zur ActiveKpi Union hinzufügen
export type ActiveKpi = BaseActiveKpi | 'conversions' | 'engagementRate' | 'bounceRate' | 'newUsers' | 'avgEngagementTime' | 'aiTraffic';

// Metadaten für KPI Tabs (Farben & Labels)
export const KPI_TAB_META: Record<string, { label: string; color: string }> = {
  clicks: { label: 'Klicks', color: '#3b82f6' },          
  impressions: { label: 'Impressionen', color: '#8b5cf6' }, 
  sessions: { label: 'Sitzungen', color: '#10b981' },      
  totalUsers: { label: 'Nutzer', color: '#f97316' },       
  conversions: { label: 'Conversions', color: '#f59e0b' }, 
  engagementRate: { label: 'Engagement Rate', color: '#ec4899' }, 
  bounceRate: { label: 'Bounce Rate', color: '#ef4444' },  
  newUsers: { label: 'Neue Nutzer', color: '#06b6d4' },    
  avgEngagementTime: { label: 'Ø Zeit', color: '#6366f1' }, 
};

export interface ChartEntry {
  name: string;
  value: number;
  fill?: string;
  subValue?: string;
  subLabel?: string;
  subValue2?: number;
  subLabel2?: string;
}

// ✅ NEU: Bing Datenstruktur für das Diagramm
export interface BingDataPoint {
  date: string;
  clicks: number;
  impressions: number;
}

export interface ApiErrorStatus {
  gsc?: string;
  ga4?: string;
  semrush?: string;
  bing?: string; // Optional: Auch Bing-Fehler tracken
}

export interface ConvertingPageData {
  path: string;
  conversions: number;
  conversionRate: number; 
  engagementRate?: number;
  sessions?: number; 
  newUsers?: number; 
}

export interface ProjectDashboardData {
  kpis?: {
    clicks?: KpiDatum;
    impressions?: KpiDatum;
    sessions?: KpiDatum;
    totalUsers?: KpiDatum;
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
    aiTraffic?: ChartPoint[]; // Chart-Daten für AI Traffic
  };
  topQueries?: TopQueryData[];
  topConvertingPages?: ConvertingPageData[];
  aiTraffic?: AiTrafficData;
  
  // ✅ NEU: Bing Daten im Dashboard-Objekt
  bingData?: BingDataPoint[];

  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
  apiErrors?: ApiErrorStatus;
  fromCache?: boolean;
}

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
  // Wenn GSC & GA4 Fehler haben, aber Bing Daten da sind, zeigen wir trotzdem was an
  if (data.apiErrors?.gsc && data.apiErrors?.ga4 && (!data.bingData || data.bingData.length === 0)) return false;
  
  const k = normalizeFlatKpis(data.kpis);
  
  // Zeige Dashboard wenn Google Daten ODER Bing Daten da sind
  if (k.clicks.value > 0 || k.sessions.value > 0 || (data.bingData && data.bingData.length > 0)) return true;
  
  return false;
}
