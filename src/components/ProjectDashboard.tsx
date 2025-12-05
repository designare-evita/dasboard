// src/components/ProjectDashboard.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Eye, EyeSlash } from 'react-bootstrap-icons'; 
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  ChartEntry,
  KpiDatum
} from '@/lib/dashboard-shared';

import TableauKpiGrid from '@/components/TableauKpiGrid';
import TableauPieChart from '@/components/charts/TableauPieChart';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import AiTrafficCard from '@/components/AiTrafficCard';
import { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';
import SemrushTopKeywords from '@/components/SemrushTopKeywords';
import SemrushTopKeywords02 from '@/components/SemrushTopKeywords02';
import GlobalHeader from '@/components/GlobalHeader';
import ProjectTimelineWidget from '@/components/ProjectTimelineWidget'; 
import AiAnalysisWidget from '@/components/AiAnalysisWidget';
import BingAnalysisWidget from '@/components/BingAnalysisWidget';
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
  semrushTrackingId?: string | null;
  semrushTrackingId02?: string | null;
  projectTimelineActive?: boolean;
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
  bingData?: any[];
  userRole?: string; 
  userEmail?: string; 
  showLandingPagesToCustomer?: boolean; 
}

function safeKpi(kpi?: KpiDatum) {
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
  userRole = 'USER', 
  userEmail = '', 
  showLandingPagesToCustomer = false,
}: ProjectDashboardProps) {
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  const [isLandingPagesVisible, setIsLandingPagesVisible] = useState(showLandingPagesToCustomer);
  const [isUpdating, setIsUpdating] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setIsUpdating(false);
  }, [dateRange, data, isLoading]);

  const apiErrors = data.apiErrors;
  const kpis = data.kpis;

  // 1. Daten für das Dashboard (Originalzustand)
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

  const allChartData = {
    ...(data.charts || {}),
    aiTraffic: (data.aiTraffic?.trend ?? []).map(item => ({
      date: item.date,
      value: (item as any).value ?? (item as any).sessions ?? 0
    }))
  };

  const cleanLandingPages = useMemo(() => {
    return aggregateLandingPages(data.topConvertingPages || []);
  }, [data.topConvertingPages]);

  // 2. Daten NUR für den PDF Export (Deine Wunsch-Reihenfolge)
  const exportKpis = useMemo(() => {
    if (!extendedKpis) return [];
    
    return [
      { label: 'Impressionen', value: extendedKpis.impressions.value.toLocaleString('de-DE'), change: extendedKpis.impressions.change },
      { label: 'Klicks', value: extendedKpis.clicks.value.toLocaleString('de-DE'), change: extendedKpis.clicks.change },
      { label: 'Nutzer', value: extendedKpis.totalUsers.value.toLocaleString('de-DE'), change: extendedKpis.totalUsers.change },
      { label: 'Sitzungen', value: extendedKpis.sessions.value.toLocaleString('de-DE'), change: extendedKpis.sessions.change },
      { label: 'Engagement', value: extendedKpis.engagementRate.value.toFixed(1), change: extendedKpis.engagementRate.change, unit: '%' },
      { label: 'Conversions', value: extendedKpis.conversions.value.toLocaleString('de-DE'), change: extendedKpis.conversions.change },
      // AI Traffic statt Bounce Rate
      { label: 'KI-Traffic', value: (data.aiTraffic?.totalUsers || 0).toLocaleString('de-DE'), change: data.aiTraffic?.totalUsersChange || 0 }, 
      { label: 'Ø Zeit', value: extendedKpis.avgEngagementTime.value.toLocaleString('de-DE'), change: extendedKpis.avgEngagementTime.change },
    ];
  }, [extendedKpis, data.aiTraffic]);

  const handleDateRangeChange = (range: DateRangeOption) => {
    if (range === dateRange) return;
    setIsUpdating(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set('dateRange', range);
    router.push(`${pathname}?${params.toString()}`);
    if (onDateRangeChange) onDateRangeChange(range);
  };

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const shouldRenderChart = isAdmin || isLandingPagesVisible;
  const hasSemrushConfig = !!semrushTrackingId || !!semrushTrackingId02;
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;
  const safeApiErrors = (apiErrors as any) || {};

  // Debug: Log bingData wenn es sich ändert
  useEffect(() => {
    console.log('[DEBUG] ProjectDashboard bingData:', data.bingData);
    console.log('[DEBUG] bingData length:', data.bingData?.length || 0);
    console.log('[DEBUG] bingData type:', typeof data.bingData);
  }, [data.bingData]);

  return (
    <div className="min-h-screen flex flex-col dashboard-gradient relative">
      {isUpdating && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white px-8 py-6 rounded-xl shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="text-center">
              <h4 className="text-gray-900 font-semibold mb-1">Daten werden aktualisiert</h4>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6">
        <GlobalHeader 
          domain={domain}
          projectId={projectId}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          userRole={userRole}
          userEmail={userEmail}
        />
        
        {projectId && projectTimelineActive && (
          <div className="mb-6 print-timeline">
            <ProjectTimelineWidget projectId={projectId} />
          </div>
        )}

        {/* AI WIDGET */}
        {projectId && (
          <div className="mt-6 print:hidden">
            <AiAnalysisWidget 
              projectId={projectId}
              domain={domain}
              dateRange={dateRange}
              chartRef={chartRef}
              kpis={exportKpis}
            />
          </div>
        )}

        {/* KPI GRID */}
        <div className="mt-6 print-kpi-grid">
          {extendedKpis && (
            <TableauKpiGrid
              kpis={extendedKpis}
              isLoading={isLoading} 
              allChartData={data.charts as any} 
              apiErrors={safeApiErrors}
              dateRange={dateRange} 
            />
          )}
        </div>

        <div className="mt-6 print-trend-chart" ref={chartRef}>
          <KpiTrendChart 
            activeKpi={activeKpi}
            onKpiChange={(kpi) => setActiveKpi(kpi as ActiveKpi)}
            allChartData={allChartData}
          />
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6 print-traffic-grid">
          <div className="xl:col-span-1 print-ai-card">
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
          
          <div className="xl:col-span-2 print-queries-list">
            <TopQueriesList 
              queries={data.topQueries ?? []} 
              isLoading={isLoading}
              className="h-full"
              dateRange={dateRange}
              error={safeApiErrors?.gsc}
            />
          </div>
        </div>

        {shouldRenderChart && (
          <div className={`mt-6 transition-all duration-300 ${!isLandingPagesVisible && isAdmin ? 'opacity-70 grayscale-[0.5]' : ''}`}>
            {isAdmin && (
               <div className="flex items-center justify-end mb-2 print:hidden">
                 <button 
                    onClick={() => setIsLandingPagesVisible(!isLandingPagesVisible)}
                    className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                 >
                    {isLandingPagesVisible ? <EyeSlash size={14}/> : <Eye size={14}/>}
                    {isLandingPagesVisible ? 'Für Kunden verbergen' : 'Für Kunden sichtbar machen'}
                 </button>
               </div>
            )}
            <div className="print-landing-chart relative">
               <LandingPageChart 
                 data={cleanLandingPages} 
                 isLoading={isLoading}
                 title="Top Landingpages"
                 dateRange={dateRange} // ✅ HIER WICHTIG: DateRange übergeben
               />
               {!isLandingPagesVisible && isAdmin && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <div className="bg-gray-900/10 backdrop-blur-[1px] px-4 py-2 rounded-lg border border-gray-900/20 text-gray-800 text-xs font-semibold shadow-sm">
                     🚫 Für Kunden ausgeblendet
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* PIE CHARTS: Hier übergeben wir jetzt dateRange */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 print-pie-grid">
          <TableauPieChart 
            data={data.channelData} 
            title="Zugriffe nach Channel" 
            isLoading={isLoading} 
            error={safeApiErrors?.ga4} 
            dateRange={dateRange} // ✅ NEU
          />
          <TableauPieChart 
            data={data.countryData} 
            title="Zugriffe nach Land" 
            isLoading={isLoading} 
            error={safeApiErrors?.ga4} 
            dateRange={dateRange} // ✅ NEU
          />
          <TableauPieChart 
            data={data.deviceData} 
            title="Zugriffe nach Endgerät" 
            isLoading={isLoading} 
            error={safeApiErrors?.ga4} 
            dateRange={dateRange} // ✅ NEU
          />
        </div>
        
        {hasSemrushConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 print-semrush-grid">
            {hasKampagne1Config && <div className="card-glass p-4 sm:p-6"><SemrushTopKeywords projectId={projectId} /></div>}
            {hasKampagne2Config && <div className="card-glass p-4 sm:p-6"><SemrushTopKeywords02 projectId={projectId} /></div>}
          </div>
        )}

        <BingAnalysisWidget 
          bingData={data.bingData || []}
          domain={domain}
          dateRange={dateRange}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
