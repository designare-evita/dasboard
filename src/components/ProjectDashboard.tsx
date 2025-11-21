// src/components/ProjectDashboard.tsx
'use client';

import { useState } from 'react';
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  normalizeFlatKpis,
  ChartEntry
} from '@/lib/dashboard-shared';
import KpiCardsGrid from '@/components/KpiCardsGrid';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import AiTrafficCard from '@/components/AiTrafficCard';
import { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';
import SemrushTopKeywords from '@/components/SemrushTopKeywords';
import SemrushTopKeywords02 from '@/components/SemrushTopKeywords02';
import DashboardHeader from '@/components/DashboardHeader';
import { useSession } from 'next-auth/react'; 

import CountryChart from './CountryChart';
import ChannelChart from './ChannelChart';
import DeviceChart from './DeviceChart';

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
  onPdfExport?: () => void;
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
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
  onPdfExport,
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  const { data: session } = useSession();
  
  const normalizedKpis = normalizeFlatKpis(data.kpis);
  const apiErrors = data.apiErrors;
  
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;
  const hasSemrushConfig = hasKampagne1Config || hasKampagne2Config;

  return (
    <>
      <div className="print-header">
        <DashboardHeader 
          domain={domain}
          projectId={projectId}
          faviconUrl={faviconUrl}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          onPdfExport={onPdfExport || (() => console.warn('PDF Export not implemented'))}
        />
      </div>

      {/* KPI Cards */}
      <div className="mt-6 print-kpi-grid">
        <KpiCardsGrid
          kpis={normalizedKpis}
          isLoading={isLoading}
          allChartData={data.charts} 
          apiErrors={apiErrors}
        />
      </div>

      {/* KPI-Trendchart */}
      <div className="mt-6 print-trend-chart">
        <KpiTrendChart 
          activeKpi={activeKpi}
          onKpiChange={setActiveKpi}
          allChartData={data.charts}
        />
      </div>

      {/* AI Traffic & Top Queries */}
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

      {/* Kreisdiagramm-Sektion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 print-pie-grid">
        <CountryChart 
          data={data.countryData} 
          isLoading={isLoading} 
          error={apiErrors?.ga4}
        />
        <ChannelChart 
          data={data.channelData} 
          isLoading={isLoading} 
          error={apiErrors?.ga4}
        />
        <DeviceChart 
          data={data.deviceData} 
          isLoading={isLoading} 
          error={apiErrors?.ga4}
        />
      </div>
      
      {/* Semrush Keywords */}
      {hasSemrushConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 print-semrush-grid">
          {hasKampagne1Config && (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
              <SemrushTopKeywords projectId={projectId} />
            </div>
          )}
          {hasKampagne2Config && (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
              <SemrushTopKeywords02 projectId={projectId} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
