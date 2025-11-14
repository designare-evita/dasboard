// src/components/ProjectDashboard.tsx
'use client';

import { useState } from 'react';
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  normalizeFlatKpis,
  ChartEntry // ✅ NEU: ChartEntry importieren
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

// ✅ NEU: Die drei neuen Diagramm-Komponenten importieren
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
  faviconUrl?: string | null; // ✅ NEU: Favicon-URL hinzugefügt
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
  faviconUrl, // ✅ NEU: Prop hier entgegennehmen
  semrushTrackingId,
  semrushTrackingId02,
  onPdfExport,
  countryData,
  channelData,
  deviceData
}: ProjectDashboardProps) {
  
  // (Rest der Komponente bleibt gleich...)
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  const { data: session } = useSession();
  const normalizedKpis = normalizeFlatKpis(data.kpis);
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;
  const hasSemrushConfig = hasKampagne1Config || hasKampagne2Config;

  return (
    <>
      <DashboardHeader 
        domain={domain}
        projectId={projectId}
        faviconUrl={faviconUrl} // ✅ NEU: Prop an Header weitergeben
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        onPdfExport={onPdfExport || (() => {
          console.warn('PDF Export functionality not implemented');
        })}
      />

      {/* (Restliches JSX bleibt unverändert) */}
      
      {/* KPI Cards */}
      <div className="mt-6">
        <KpiCardsGrid
          kpis={normalizedKpis}
          isLoading={isLoading}
          allChartData={data.charts} 
        />
      </div>

      {/* KPI-Trendchart */}
      <div className="mt-6">
        <KpiTrendChart 
          activeKpi={activeKpi}
          onKpiChange={setActiveKpi}
          allChartData={data.charts}
        />
      </div>

      {/* AI Traffic & Top Queries */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="xl:col-span-1">
          <AiTrafficCard 
            totalSessions={data.aiTraffic?.totalSessions ?? 0}
            totalUsers={data.aiTraffic?.totalUsers ?? 0}
            percentage={data.kpis?.sessions?.aiTraffic?.percentage ?? 0}
            trend={(data.aiTraffic?.trend ?? []).map(item => ({
              date: item.date,
              value: ('value' in item ? item.value : (item as { date: string; sessions: number }).sessions) as number
            }))}
            topAiSources={data.aiTraffic?.topAiSources ?? []}
            className="h-full"
            isLoading={isLoading}
            dateRange={dateRange}
          />
        </div>
        
        <div className="xl:col-span-2">
          <TopQueriesList 
            queries={data.topQueries ?? []} 
            isLoading={isLoading}
            className="h-full"
            dateRange={dateRange}
          />
        </div>
      </div>

      {/* ✅ NEU: Kreisdiagramm-Sektion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <CountryChart data={data.countryData} isLoading={isLoading} />
        <ChannelChart data={data.channelData} isLoading={isLoading} />
        <DeviceChart data={data.deviceData} isLoading={isLoading} />
      </div>
      
      {/* Semrush Keywords */}
      {hasSemrushConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          
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
