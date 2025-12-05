'use client';

import { useState, useMemo, useRef } from 'react';
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  KpiDatum
} from '@/lib/dashboard-shared';

// Components
import TableauKpiGrid from '@/components/TableauKpiGrid';
import TableauPieChart from '@/components/charts/TableauPieChart';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import AiTrafficCard from '@/components/AiTrafficCard';
import AiQuestionsCard from '@/components/AiQuestionsCard'; // NEU
import { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';
import SemrushTopKeywords from '@/components/SemrushTopKeywords';
import SemrushTopKeywords02 from '@/components/SemrushTopKeywords02';
import GlobalHeader from '@/components/GlobalHeader';
import ProjectTimelineWidget from '@/components/ProjectTimelineWidget'; 
import AiAnalysisWidget from '@/components/AiAnalysisWidget';
import LandingPageChart from '@/components/charts/LandingPageChart';
import { aggregateLandingPages } from '@/lib/utils';

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange?: (range: DateRangeOption) => void;
  projectId?: string;
  domain?: string;
  faviconUrl?: string | null;
  projectName?: string;
  lastUpdated?: string;
  safeApiErrors?: Record<string, boolean>;
  hasSemrushConfig?: boolean;
  hasKampagne1Config?: boolean;
  hasKampagne2Config?: boolean;
  userRole?: string;
}

export default function ProjectDashboard({ 
  data, 
  isLoading, 
  dateRange,
  onDateRangeChange,
  projectId,
  domain,
  faviconUrl,
  projectName,
  lastUpdated,
  safeApiErrors,
  hasSemrushConfig,
  hasKampagne1Config,
  hasKampagne2Config,
  userRole
}: ProjectDashboardProps) {
  
  // State für den aktiven KPI im Trend-Chart (Default: Sessions)
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('sessions');

  // Chart Referenz für Export-Funktionen
  const chartRef = useRef<HTMLDivElement>(null);

  // Daten für den Trend-Chart vorbereiten
  const allChartData = useMemo(() => {
    if (!data?.kpis?.sessions?.trend) return [];
    
    // Basis-Map erstellen mit Datum als Key
    const dataMap = new Map<string, any>();

    // Helper zum Befüllen
    const fillData = (key: string, trendData: KpiDatum[] | undefined) => {
      if (!trendData) return;
      trendData.forEach(item => {
        const existing = dataMap.get(item.date) || { date: item.date };
        existing[key] = item.value;
        dataMap.set(item.date, existing);
      });
    };

    fillData('sessions', data.kpis.sessions?.trend);
    fillData('users', data.kpis.users?.trend);
    fillData('views', data.kpis.views?.trend);
    fillData('engagementRate', data.kpis.engagementRate?.trend); // Optional

    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Daten für Landingpages aggregieren
  const aggregatedLandingPages = useMemo(() => {
    return aggregateLandingPages(data.landingPages || [], 7);
  }, [data.landingPages]);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      
      {/* GLOBAL HEADER (Sticky) */}
      <GlobalHeader 
         dateRange={dateRange}
         onDateRangeChange={onDateRangeChange}
         lastUpdated={lastUpdated}
         projectName={projectName}
         domain={domain}
         faviconUrl={faviconUrl}
         chartRef={chartRef}
      />

      {/* HAUPT-CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* 1. PROJECT TIMELINE (Meilensteine) */}
        <div className="print-timeline">
           <ProjectTimelineWidget projectId={projectId} />
        </div>

        {/* 2. AI ANALYSE TEXT-WIDGET (Zusammenfassung) */}
        <div className="print-analysis">
           <AiAnalysisWidget 
             data={data} 
             isLoading={isLoading} 
             projectId={projectId || ''} 
           />
        </div>

        {/* 3. KPI GRID (Die 4 Haupt-Karten) */}
        <div className="print-kpi-grid">
           <TableauKpiGrid 
             kpis={data.kpis} 
             isLoading={isLoading} 
             activeKpi={activeKpi}
             onKpiClick={setActiveKpi}
             error={safeApiErrors?.ga4}
           />
        </div>

        {/* 4. TREND CHART (Große Grafik) */}
        <div className="mt-6 print-trend-chart" ref={chartRef}>
          <KpiTrendChart 
            activeKpi={activeKpi}
            onKpiChange={(kpi) => setActiveKpi(kpi as ActiveKpi)}
            allChartData={allChartData}
          />
        </div>

        {/* --- NEUE SEKTION: AI & SEARCH INTELLIGENCE --- */}
        <div className="mt-8 mb-4 print-ai-section">
           <div className="flex items-center gap-3 px-1 mb-2">
             <div className="w-1.5 h-6 bg-gradient-to-b from-purple-600 to-emerald-500 rounded-sm"></div>
             <h3 className="text-lg font-bold text-gray-900">
               AI & Search Intelligence
             </h3>
           </div>
           <p className="text-sm text-gray-500 px-1 ml-4 max-w-3xl">
             Analyse des neuen Suchverhaltens: Links sehen Sie Traffic, der durch KI-Assistenten entsteht. Rechts sehen Sie Ihr Potenzial bei direkten Nutzerfragen (Voice/Chat).
           </p>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print-traffic-grid">
          
          {/* LINKS: AI TRAFFIC (Woher kommen sie?) */}
          <div className="h-full print-ai-card">
            <AiTrafficCard 
              totalSessions={data.aiTraffic?.totalSessions ?? 0}
              totalUsers={data.aiTraffic?.totalUsers ?? 0}
              percentage={data.kpis?.sessions?.value ? ((data.aiTraffic?.totalSessions ?? 0) / data.kpis.sessions.value * 100) : 0}
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
              error={safeApiErrors?.ga4}
            />
          </div>
          
          {/* RECHTS: QUESTIONS (Was fragen sie?) */}
          <div className="h-full print-questions-card">
            <AiQuestionsCard 
               queries={data.topQueries ?? []}
               isLoading={isLoading}
               className="h-full"
            />
          </div>
        </div>

        {/* 5. LANDING PAGE PERFORMANCE */}
        <div className="mt-8">
           <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">Seiten Performance</h3>
           <LandingPageChart 
             data={aggregatedLandingPages}
             isLoading={isLoading}
           />
        </div>

        {/* 6. PIE CHARTS (Demografie & Technik) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 print-pie-grid">
          <TableauPieChart 
            data={data.channelData} 
            title="Zugriffe nach Channel" 
            isLoading={isLoading} 
            error={safeApiErrors?.ga4} 
            dateRange={dateRange}
          />
          <TableauPieChart 
            data={data.countryData} 
            title="Zugriffe nach Land" 
            isLoading={isLoading} 
            error={safeApiErrors?.ga4} 
            dateRange={dateRange}
          />
          <TableauPieChart 
            data={data.deviceData} 
            title="Zugriffe nach Endgerät" 
            isLoading={isLoading} 
            error={safeApiErrors?.ga4} 
            dateRange={dateRange}
          />
        </div>
        
        {/* 7. SEMRUSH KEYWORDS (Optional) */}
        {hasSemrushConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 print-semrush-grid">
            {hasKampagne1Config && (
              <div className="bg-white rounded-2xl border border-gray-200 p-1 shadow-sm h-full">
                 <SemrushTopKeywords projectId={projectId} />
              </div>
            )}
            {hasKampagne2Config && (
              <div className="bg-white rounded-2xl border border-gray-200 p-1 shadow-sm h-full">
                 <SemrushTopKeywords02 projectId={projectId} />
              </div>
            )}
          </div>
        )}

        {/* 8. SEO DETAILS (Queries Liste) */}
        <div className="mt-6 print-queries-list">
             <TopQueriesList 
               queries={data.topQueries ?? []} 
               isLoading={isLoading}
               className="h-full"
               dateRange={dateRange}
               error={safeApiErrors?.gsc}
            />
        </div>
        
      </div>
    </div>
  );
}
