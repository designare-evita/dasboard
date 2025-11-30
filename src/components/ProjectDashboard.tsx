'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
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
// DashboardHeader wird nicht mehr benötigt, da GlobalHeader die Steuerung übernimmt
import GlobalHeader from '@/components/GlobalHeader';
import ProjectTimelineWidget from '@/components/ProjectTimelineWidget'; 
import AiAnalysisWidget from '@/components/AiAnalysisWidget';

import CountryChart from './CountryChart';
import ChannelChart from './ChannelChart';
import DeviceChart from './DeviceChart';

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange?: (range: DateRangeOption) => void;
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

export default function ProjectDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  projectId,
  domain,
  semrushTrackingId,
  semrushTrackingId02,
  projectTimelineActive = false,
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleDateRangeChange = (newRange: DateRangeOption) => {
    if (onDateRangeChange) {
      onDateRangeChange(newRange);
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set('dateRange', newRange);
      router.push(`${pathname}?${params.toString()}`);
    }
  };
  
  const normalizedKpis = normalizeFlatKpis(data.kpis);
  const apiErrors = data.apiErrors;
  
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;
  const hasSemrushConfig = hasKampagne1Config || hasKampagne2Config;

  return (
    <div className="min-h-screen flex flex-col dashboard-gradient">
      
      <div className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6">
        
        {/* 1. GLOBAL HEADER (100% Breite) */}
        <div className="mb-6">
          <GlobalHeader 
            domain={domain}
            projectId={projectId}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>

        {/* 2. DATA MAX (100% Breite) */}
        {projectId && (
          <div className="mb-8">
            <AiAnalysisWidget projectId={projectId} dateRange={dateRange} />
          </div>
        )}

        {/* 3. TIMELINE WIDGET */}
        {projectId && projectTimelineActive && (
          <div className="mb-8 print-timeline">
            <ProjectTimelineWidget 
              projectId={projectId} 
            />
          </div>
        )}

        {/* 4. KPI CARDS */}
        <div className="mt-6 print-kpi-grid">
          <KpiCardsGrid
            kpis={normalizedKpis}
            isLoading={isLoading}
            allChartData={data.charts} 
            apiErrors={apiErrors}
          />
        </div>

        {/* 5. TREND CHART */}
        <div className="mt-6 print-trend-chart">
          <KpiTrendChart 
            activeKpi={activeKpi}
            onKpiChange={(kpi) => setActiveKpi(kpi as ActiveKpi)}
            allChartData={data.charts}
          />
        </div>

        {/* 6. AI TRAFFIC & TOP QUERIES */}
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

        {/* 7. PIE CHARTS */}
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
        
        {/* 8. SEMRUSH KEYWORDS */}
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
