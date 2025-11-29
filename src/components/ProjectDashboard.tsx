// src/components/ProjectDashboard.tsx
'use client';

import { useState } from 'react';
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  ChartEntry
} from '@/lib/dashboard-shared';

// ✅ Import von Tableau-Komponenten
import TableauKpiGrid from '@/components/TableauKpiGrid';
import TableauPieChart from '@/components/charts/TableauPieChart';

import KpiTrendChart from '@/components/charts/KpiTrendChart';
import AiTrafficCard from '@/components/AiTrafficCard';
import { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';
import SemrushTopKeywords from '@/components/SemrushTopKeywords';
import SemrushTopKeywords02 from '@/components/SemrushTopKeywords02';
import DashboardHeader from '@/components/DashboardHeader';
import GlobalHeader from '@/components/GlobalHeader';
import ProjectTimelineWidget from '@/components/ProjectTimelineWidget'; 
import AiAnalysisWidget from '@/components/AiAnalysisWidget';
import CacheRefreshButton from '@/components/CacheRefreshButton';

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  projectId?: string;
  domain?: string;
  faviconUrl?: string | null;
  semrushTrackingId?: string | null;
  semrushTrackingId02?: string | null;
  projectTimelineActive?: boolean;
  onPdfExport?: () => void;
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
}

// Helper für KPI Normalisierung
function safeKpi(kpi: any) {
  return kpi || { value: 0, change: 0 };
}

export default function ProjectDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  projectId,
  domain,
  faviconUrl,
  semrushTrackingId,
  semrushTrackingId02,
  projectTimelineActive = false,
  onPdfExport,
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  
  const apiErrors = data.apiErrors;
  const kpis = data.kpis;

  // Erstelle das erweiterte KPI Objekt für das Tableau Grid
  const extendedKpis = kpis ? {
    clicks: safeKpi(kpis.clicks),
    impressions: safeKpi(kpis.impressions),
    sessions: safeKpi(kpis.sessions),
    totalUsers: safeKpi(kpis.totalUsers),
    conversions: safeKpi(kpis.conversions),
    engagementRate: safeKpi(kpis.engagementRate),
    bounceRate: safeKpi(kpis.bounceRate),
    newUsers: safeKpi(kpis.newUsers),
    avgEngagementTime: safeKpi(kpis.avgEngagementTime),
  } : undefined;

  // Konfigurationen prüfen
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;
  const hasSemrushConfig = hasKampagne1Config || hasKampagne2Config;

  return (
    <div className="min-h-screen flex flex-col dashboard-gradient">
      
      <div className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6">
        
        <GlobalHeader 
          domain={domain}
          projectId={projectId}
          onPdfExport={onPdfExport || (() => console.warn('PDF Export not implemented'))}
        />
        
        {/* TIMELINE WIDGET */}
        {projectId && projectTimelineActive && (
          <div className="mb-6 print-timeline">
            <ProjectTimelineWidget projectId={projectId} />
          </div>
        )}

        {/* DASHBOARD HEADER */}
        <div className="print-header">
          <DashboardHeader 
            domain={domain}
            projectId={projectId}
            faviconUrl={faviconUrl}
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
            onPdfExport={onPdfExport || (() => console.warn('PDF Export not implemented'))}
          />
          
          {/* ✅ CACHE REFRESH BUTTON (nur für Admins/Development) */}
          {projectId && (
            <div className="mt-4 flex justify-end">
              <CacheRefreshButton projectId={projectId} />
            </div>
          )}
        </div>

        {/* AI ANALYSE WIDGET */}
        {projectId && (
          <div className="mt-6 print:hidden">
            <AiAnalysisWidget projectId={projectId} dateRange={dateRange} />
          </div>
        )}

        {/* ✅ TABLEAU KPI GRID */}
        {/* WICHTIG: allChartData={data.charts} sorgt für die farbigen Graphen */}
        <div className="mt-6 print-kpi-grid">
          {extendedKpis && (
            <TableauKpiGrid
              kpis={extendedKpis}
              isLoading={isLoading}
              allChartData={data.charts as any} 
              apiErrors={apiErrors}
              dateRange={dateRange} 
            />
          )}
        </div>

        {/* TREND CHART */}
        <div className="mt-6 print-trend-chart">
          <KpiTrendChart 
            activeKpi={activeKpi}
            onKpiChange={(kpi) => setActiveKpi(kpi as ActiveKpi)}
            allChartData={data.charts}
          />
        </div>

        {/* AI TRAFFIC & TOP QUERIES */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6 print-traffic-grid">
          <div className="xl:col-span-1 print-ai-card">
            <AiTrafficCard 
              totalSessions={data.aiTraffic?.totalSessions ?? 0}
              totalUsers={data.aiTraffic?.totalUsers ?? 0}
              percentage={data.kpis?.sessions?.aiTraffic?.percentage ?? 0}
              totalSessionsChange={data.aiTraffic?.totalSessionsChange}
              totalUsersChange={data.aiTraffic?.totalUsersChange}
              trend={(data.aiTraffic?.trend ?? []).map(item => ({
                date: item.date,
                value: (item as any).value ?? (item as any).sessions ?? 0
              }))}
              topAiSources={data.aiTraffic?.topAiSources ?? []}
              className="h-full"
              isLoading={isLoading}
              dateRange={dateRange}
              error={apiErrors?.ga4}
            />
          </div>
          
          <div className="xl:col-span-2 print-queries-list">
            <TopQueriesList 
              queries={data.topQueries ?? []} 
              isLoading={isLoading}
              className="h-full"
              dateRange={dateRange}
              error={apiErrors?.gsc}
            />
          </div>
        </div>

        {/* PIE CHARTS: Channel → Country → Device */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 print-pie-grid">
          
          <TableauPieChart 
            data={data.channelData} 
            title="Zugriffe nach Channel"
            isLoading={isLoading} 
            error={apiErrors?.ga4}
          />
          
          <TableauPieChart 
            data={data.countryData} 
            title="Zugriffe nach Land"
            isLoading={isLoading} 
            error={apiErrors?.ga4}
          />
          
          <TableauPieChart 
            data={data.deviceData} 
            title="Zugriffe nach Endgerät"
            isLoading={isLoading} 
            error={apiErrors?.ga4}
          />
        </div>
        
        {/* SEMRUSH KEYWORDS */}
        {hasSemrushConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 print-semrush-grid">
            {hasKampagne1Config && (
              <div className="card-glass p-4 sm:p-6">
                <SemrushTopKeywords projectId={projectId} />
              </div>
            )}
            {hasKampagne2Config && (
              <div className="card-glass p-4 sm:p-6">
                <SemrushTopKeywords02 projectId={projectId} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
