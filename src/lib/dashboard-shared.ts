// src/lib/dashboard-shared.ts
// ============================================
// ZENTRALE TYPE-DEFINITIONEN FÜR DAS DASHBOARD
// NUR Types - KEINE Implementierungen!
// ============================================

import type { ChartPoint, TopQueryData, KpiDatum } from '@/types/dashboard';
import type { AiTrafficData } from '@/types/ai-traffic';

// ============================================
// CHART TYPES
// ============================================

/**
 * ChartEntry - Für Pie/Bar Charts (Länder, Kanäle, Geräte)
 */
export interface ChartEntry {
  name: string;
  value: number;
  fill?: string;
  subValue?: string | number;
  subLabel?: string;
  subValue2?: string | number;
  subLabel2?: string;
}

// ============================================
// CONVERTING PAGES (für AI Analyse)
// ============================================

/**
 * ConvertingPageData - Top Seiten die Conversions generieren
 */
export interface ConvertingPageData {
  path: string;
  conversions: number;
  sessions: number;
  conversionRate: string; // z.B. "2.5%"
}

// ============================================
// API ERROR STATUS
// ============================================

/**
 * ApiErrorStatus - Tracking von API Fehlern
 */
export interface ApiErrorStatus {
  gsc?: string;
  ga4?: string;
  semrush?: string;
}

// ============================================
// MAIN DASHBOARD DATA STRUCTURE
// ============================================

/**
 * ProjectDashboardData - Haupt-Datenstruktur für das Dashboard
 */
export interface ProjectDashboardData {
  // KPIs mit Change-Werten
  kpis: {
    // GSC Metriken
    clicks: KpiDatum;
    impressions: KpiDatum;
    
    // GA4 Metriken
    sessions: KpiDatum;
    totalUsers: KpiDatum;
    conversions: KpiDatum;
    engagementRate: KpiDatum;
    bounceRate: KpiDatum;
    newUsers: KpiDatum;
    avgEngagementTime: KpiDatum;
  };
  
  // Chart-Daten (Zeitreihen)
  charts: {
    clicks: ChartPoint[];
    impressions: ChartPoint[];
    sessions: ChartPoint[];
    totalUsers: ChartPoint[];
    conversions: ChartPoint[];
    engagementRate: ChartPoint[];
    bounceRate: ChartPoint[];
    newUsers: ChartPoint[];
    avgEngagementTime: ChartPoint[];
  };
  
  // Top Keywords aus GSC
  topQueries: TopQueryData[];
  
  // Top Converting Pages (für AI)
  topConvertingPages: ConvertingPageData[];
  
  // AI Traffic Daten (optional)
  aiTraffic?: AiTrafficData;
  
  // Chart-Daten nach Dimensionen
  countryData: ChartEntry[];
  channelData: ChartEntry[];
  deviceData: ChartEntry[];
  
  // Fehler-Status
  apiErrors?: ApiErrorStatus;
  
  // Cache-Flag
  fromCache?: boolean;
}

// ============================================
// HELPER TYPES
// ============================================

export type DateRange = '7d' | '30d' | '3m' | '6m' | '12m';

export interface TimelineData {
  date: number; // Timestamp
  value: number;
}

// ============================================
// KPI METADATA & CONSTANTS
// ============================================

export type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers' | 'conversions' | 'engagementRate';

export interface KpiMetadata {
  title: string;
  color: string;
}

/**
 * KPI_TAB_META - Metadaten für alle KPI Tabs
 */
export const KPI_TAB_META: Record<ActiveKpi, KpiMetadata> = {
  clicks: { title: 'Klicks', color: '#3b82f6' },
  impressions: { title: 'Impressionen', color: '#8b5cf6' },
  sessions: { title: 'Sitzungen', color: '#10b981' },
  totalUsers: { title: 'Nutzer', color: '#f59e0b' },
  conversions: { title: 'Conversions', color: '#f59e0b' },
  engagementRate: { title: 'Interaktionsrate', color: '#ec4899' },
};

// ============================================
// RE-EXPORTS (für einfacheren Import)
// ============================================

export type { ChartPoint, TopQueryData, KpiDatum, AiTrafficData };
