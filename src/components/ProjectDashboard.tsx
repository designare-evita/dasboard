// src/components/ProjectDashboard.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Eye, EyeSlash, ArrowRepeat } from 'react-bootstrap-icons'; 
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  ChartEntry
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
import LandingPageChart from '@/components/charts/LandingPageChart';

// ✅ NEU: Import der Bereinigungs-Funktion
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
  onPdfExport?: () => void;
  countryData?: ChartEntry[];
  channelData?: ChartEntry[];
  deviceData?: ChartEntry[];
  
  userRole?: string; 
  userEmail?: string; 
  showLandingPagesToCustomer?: boolean; 
}

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
  
  userRole = 'USER', 
  userEmail = '', 
  showLandingPagesToCustomer = false, 
}: ProjectDashboardProps) {
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  // Admin Toggle State
  const [isLandingPagesVisible, setIsLandingPagesVisible] = useState(showLandingPagesToCustomer);
  const [isToggling, setIsToggling] = useState(false);

  // Lokaler Loading-State für die Lightbox
  const [isUpdating, setIsUpdating] = useState(false);
  
  // ✅ PDF EXPORT: Refs für Charts
  const chartRef = useRef<HTMLDivElement>(null);
  const pieChartCountryRef = useRef<HTMLDivElement>(null);
  const pieChartChannelRef = useRef<HTMLDivElement>(null);
  const pieChartDeviceRef = useRef<HTMLDivElement>(null);
  
  // Überwachen, wann die Daten fertig geladen sind
  useEffect(() => {
    setIsUpdating(false);
  }, [dateRange, data, isLoading]);

  const apiErrors = data.apiErrors;
  const kpis = data.kpis;

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

  // ✅ NEU: Landingpages bereinigen und zusammenfassen
  const cleanLandingPages = useMemo(() => {
    return aggregateLandingPages(data.topConvertingPages || []);
  }, [data.topConvertingPages]);

  // ✅ PDF EXPORT: KPI Daten formatieren
  const formattedKpis = useMemo(() => {
    if (!extendedKpis) return [];
    
    return [
      { label: 'Klicks', value: extendedKpis.clicks.value.toLocaleString('de-DE'), change: extendedKpis.clicks.change },
      { label: 'Impressionen', value: extendedKpis.impressions.value.toLocaleString('de-DE'), change: extendedKpis.impressions.change },
      { label: 'Sitzungen', value: extendedKpis.sessions.value.toLocaleString('de-DE'), change: extendedKpis.sessions.change },
      { label: 'Nutzer', value: extendedKpis.totalUsers.value.toLocaleString('de-DE'), change: extendedKpis.totalUsers.change },
      { label: 'Conversions', value: extendedKpis.conversions.value.toLocaleString('de-DE'), change: extendedKpis.conversions.change },
      { label: 'Engagement Rate', value: extendedKpis.engagementRate.value.toFixed(1), change: extendedKpis.engagementRate.change, unit: '%' },
      { label: 'Bounce Rate', value: extendedKpis.bounceRate.value.toFixed(1), change: extendedKpis.bounceRate.change, unit: '%' },
      { label: 'Neue Nutzer', value: extendedKpis.newUsers.value.toLocaleString('de-DE'), change: extendedKpis.newUsers.change },
    ];
  }, [extendedKpis]);

  const handleDateRangeChange = (range: DateRangeOption) => {
    if (range === dateRange) return;

    // Lightbox aktivieren
    setIsUpdating(true);

    const params = new URLSearchParams(searchParams.toString());
    params.set('dateRange', range);
    router.push(`${pathname}?${params.toString()}`);

    if (onDateRangeChange) {
      onDateRangeChange(range);
    }
  };

  const toggleLandingPageVisibility = async () => {
    if (!projectId) return;
    
    const newValue = !isLandingPagesVisible;
    setIsLandingPagesVisible(newValue);
    setIsToggling(true);

    try {
      await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showLandingPages: newValue }),
      });
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      setIsLandingPagesVisible(!newValue);
    } finally {
      setIsToggling(false);
    }
  };

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const shouldRenderChart = isAdmin || isLandingPagesVisible;
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;
  const hasSemrushConfig = hasKampagne1Config || hasKampagne2Config;

  return (
    <div className="min-h-screen flex flex-col dashboard-gradient relative">
      
      {/* Lightbox Overlay */}
      {isUpdating && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-opacity duration-300">
          <div className="bg-white px-8 py-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-100 rounded-full"></div>
              <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="text-center">
              <h4 className="text-gray-900 font-semibold mb-1">Daten werden aktualisiert</h4>
              <p className="text-gray-500 text-sm">Bitte einen Moment Geduld...</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6">
        
        {/* GLOBAL HEADER */}
        <GlobalHeader 
          domain={domain}
          projectId={projectId}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          userRole={userRole}
          userEmail={userEmail}
        />
        
        {/* TIMELINE */}
        {projectId && projectTimelineActive && (
          <div className="mb-6 print-timeline">
            <ProjectTimelineWidget projectId={projectId} />
          </div>
        )}

        {/* AI ANALYSE */}
        {projectId && (
          <div className="mt-6 print:hidden">
            <AiAnalysisWidget 
              projectId={projectId} 
              dateRange={dateRange}
              chartRef={chartRef}
              pieChartsRefs={{
                country: pieChartCountryRef,
                channel: pieChartChannelRef,
                device: pieChartDeviceRef
              }}
              kpis={formattedKpis}
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
              apiErrors={apiErrors}
              dateRange={dateRange} 
            />
          )}
        </div>

        {/* TREND CHART */}
        <div className="mt-6 print-trend-chart" ref={chartRef}>
          <KpiTrendChart 
            activeKpi={activeKpi}
            onKpiChange={(kpi) => setActiveKpi(kpi as ActiveKpi)}
            allChartData={allChartData}
          />
        </div>

        {/* TRAFFIC & QUERIES */}
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

        {/* LANDINGPAGE CHART MIT SCHALTER */}
        {shouldRenderChart && (
          <div className={`mt-6 transition-all duration-300 ${!isLandingPagesVisible && isAdmin ? 'opacity-70 grayscale-[0.5]' : ''}`}>
            
            {isAdmin && (
               <div className="flex items-center justify-end mb-2 print:hidden">
                 <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg p-1.5 flex items-center gap-3 shadow-sm">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1 select-none">
                     Kundensicht
                   </span>
                   <button
                     onClick={toggleLandingPageVisibility}
                     disabled={isToggling}
                     className={`
                       relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                       ${isLandingPagesVisible ? 'bg-emerald-500' : 'bg-gray-300'}
                     `}
                   >
                     <span
                       aria-hidden="true"
                       className={`
                         pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                         ${isLandingPagesVisible ? 'translate-x-4' : 'translate-x-0'}
                       `}
                     />
                   </button>
                   <div className="text-xs w-20 text-center font-medium text-gray-700 select-none">
                     {isLandingPagesVisible ? (
                       <span className="flex items-center justify-center gap-1.5 text-emerald-700"><Eye size={12}/> Sichtbar</span>
                     ) : (
                       <span className="flex items-center justify-center gap-1.5 text-gray-500"><EyeSlash size={12}/> Versteckt</span>
                     )}
                   </div>
                 </div>
               </div>
            )}

            <div className="print-landing-chart relative">
               {/* ✅ UPDATE: Verwendung der bereinigten Daten */}
               <LandingPageChart 
                 data={cleanLandingPages} 
                 isLoading={isLoading}
                 title="Top Landingpages (Conversions & Engagement)" 
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

        {/* PIE CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 print-pie-grid">
          <div ref={pieChartChannelRef}>
            <TableauPieChart data={data.channelData} title="Zugriffe nach Channel" isLoading={isLoading} error={apiErrors?.ga4} />
          </div>
          <div ref={pieChartCountryRef}>
            <TableauPieChart data={data.countryData} title="Zugriffe nach Land" isLoading={isLoading} error={apiErrors?.ga4} />
          </div>
          <div ref={pieChartDeviceRef}>
            <TableauPieChart data={data.deviceData} title="Zugriffe nach Endgerät" isLoading={isLoading} error={apiErrors?.ga4} />
          </div>
        </div>
        
        {/* SEMRUSH */}
        {hasSemrushConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 print-semrush-grid">
            {hasKampagne1Config && <div className="card-glass p-4 sm:p-6"><SemrushTopKeywords projectId={projectId} /></div>}
            {hasKampagne2Config && <div className="card-glass p-4 sm:p-6"><SemrushTopKeywords02 projectId={projectId} /></div>}
          </div>
        )}
      </div>
    </div>
  );
}
