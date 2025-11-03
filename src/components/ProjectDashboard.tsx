// src/components/ProjectDashboard.tsx 
'use client';

import { useState } from 'react';
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  normalizeFlatKpis 
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

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  projectId?: string;
  domain?: string;
  semrushTrackingId?: string | null; // ✅ HINZUGEFÜGT
  semrushTrackingId02?: string | null;
  onPdfExport?: () => void;
}

export default function ProjectDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  projectId,
  domain,
  semrushTrackingId, // ✅ HINZUGEFÜGT
  semrushTrackingId02,
  onPdfExport
}: ProjectDashboardProps) {
  

  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const normalizedKpis = normalizeFlatKpis(data.kpis);

  // ✅ KORREKTUR: Die Logik prüft jetzt beide Kampagnen-IDs.
  // Der gesamte Block wird nur angezeigt, wenn mind. eine ID vorhanden ist.
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;
  const hasSemrushConfig = hasKampagne1Config || hasKampagne2Config;

  return (
    <>
      <DashboardHeader 
        domain={domain}
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

      {/* AI Traffic & Top Queries (bleibt gleich) */}
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

      {/* ✅ KORREKTUR: Semrush Keywords (rendert jetzt nur, wenn konfiguriert) */}
      {hasSemrushConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          
          {/* Kampagne 1 - Wird nur angezeigt, wenn konfiguriert */}
          {hasKampagne1Config && (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
              <SemrushTopKeywords projectId={projectId} />
            </div>
          )}

          {/* Kampagne 2 - Wird nur angezeigt, wenn konfiguriert */}
          {hasKampagne2Config && (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
              <SemrushTopKeywords02 projectId={projectId} />
            </div>
          )}

          {/* HINWEIS: Wenn nur eine Kampagne konfiguriert ist, 
            wird nur eine Karte angezeigt (im 2-Spalten-Layout auf lg:).
            Die Platzhalter für Admins werden entfernt.
          */}

        </div>
      )}
    </>
  );
}
