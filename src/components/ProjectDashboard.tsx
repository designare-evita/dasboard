// src/components/ProjectDashboard.tsx
'use client';

import { useState } from 'react';
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  normalizeFlatKpis,
  ChartEntry,
  ApiErrorStatus // +++ NEU: Importieren +++
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
  // apiErrors Prop wird implizit durch data: ProjectDashboardData übergeben
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
  countryData,
  channelData,
  deviceData
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  const { data: session } = useSession();
  const normalizedKpis = normalizeFlatKpis(data.kpis);
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;
  const hasSemrushConfig = hasKampagne1Config || hasKampagne2Config;

  // +++ NEU: Fehler extrahieren +++
  const apiErrors = data.apiErrors;

  return (
    <>
      <DashboardHeader 
        domain={domain}
        projectId={projectId}
        faviconUrl={faviconUrl}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        onPdfExport={onPdfExport || (() => {
          console.warn('PDF Export functionality not implemented');
        })}
      />
      
      {/* KPI Cards */}
      <div className="mt-6">
        <KpiCardsGrid
          kpis={normalizedKpis}
          isLoading={isLoading}
          allChartData={data.charts} 
          apiErrors={apiErrors} // +++ NEU: Fehler weitergeben +++
        />
      </div>

      {/* KPI-Trendchart */}
      <div className="mt-6">
        <KpiTrendChart 
          activeKpi={activeKpi}
          onKpiChange={setActiveKpi}
          allChartData={data.charts}
          // +++ NEU: Fehler an Chart weitergeben, um ggf. GSC/GA4-Charts auszublenden +++
          apiErrors={apiErrors}
        />
      </div>

      {/* AI Traffic & Top Queries */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="xl:col-span-1">
          <AiTrafficCard 
            // ... (alle props)
            // +++ NEU: Fehler an AI-Traffic-Card weitergeben +++
            error={apiErrors?.ga4}
          />
        </div>
        
        <div className="xl:col-span-2">
          <TopQueriesList 
            queries={data.topQueries ?? []} 
            isLoading={isLoading}
            className="h-full"
            dateRange={dateRange}
             // +++ NEU: Fehler an Top-Queries-Liste weitergeben +++
            error={apiErrors?.gsc}
          />
        </div>
      </div>

      {/* Kreisdiagramm-Sektion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <CountryChart data={data.countryData} isLoading={isLoading} error={apiErrors?.ga4} />
        <ChannelChart data={data.channelData} isLoading={isLoading} error={apiErrors?.ga4} />
        <DeviceChart data={data.deviceData} isLoading={isLoading} error={apiErrors?.ga4} />
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
