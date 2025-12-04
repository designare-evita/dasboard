// src/components/ProjectDashboard.tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeSlash } from 'react-bootstrap-icons'; 
import { ProjectDashboardData } from '@/lib/dashboard-shared';

import TableauKpiGrid from '@/components/TableauKpiGrid';
import TableauPieChart from '@/components/charts/TableauPieChart';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import { type DateRangeOption } from '@/components/DateRangeSelector';
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
  semrushTrackingId?: string | null;
  semrushTrackingId02?: string | null;
  projectTimelineActive?: boolean;
  countryData?: any;
  channelData?: any;
  deviceData?: any;
  userRole?: string;
  userEmail?: string;
  showLandingPagesToCustomer?: boolean; 
}

export default function ProjectDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  projectId = '',
  domain = '',
  faviconUrl,
  semrushTrackingId,
  semrushTrackingId02,
  projectTimelineActive = false,
  userRole = 'BENUTZER',
  userEmail = '',
  showLandingPagesToCustomer = false
}: ProjectDashboardProps) {
  
  const chartSectionRef = useRef<HTMLDivElement>(null);
  const [isLandingPagesVisible, setIsLandingPagesVisible] = useState(showLandingPagesToCustomer);
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
  const hasSemrushConfig = !!semrushTrackingId || !!semrushTrackingId02;
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;
  
  // Cast auf any um TS Fehler mit _errors zu vermeiden
  const apiErrors = (data as any)?._errors || {};

  // ✅ NEU: KPIs für den Export vorbereiten
  const exportKpis = [
    { 
      label: 'Nutzer', 
      value: data.kpiData.totalUsers?.value?.toLocaleString('de-DE') || 0, 
      change: data.kpiData.totalUsers?.change,
      unit: '' 
    },
    { 
      label: 'Sitzungen', 
      value: data.kpiData.sessions?.value?.toLocaleString('de-DE') || 0, 
      change: data.kpiData.sessions?.change,
      unit: '' 
    },
    { 
      label: 'Engagement', 
      value: data.kpiData.engagementRate?.value?.toLocaleString('de-DE', { maximumFractionDigits: 1 }) || 0, 
      change: data.kpiData.engagementRate?.change,
      unit: '%' 
    },
    { 
      label: 'Ø Dauer', 
      value: data.kpiData.avgSessionDuration?.value || '0m', 
      change: data.kpiData.avgSessionDuration?.change,
      unit: '' 
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      
      <GlobalHeader 
        userRole={userRole} 
        userEmail={userEmail}
        showDateSelector={true}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {faviconUrl ? (
               <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 p-2">
                 <img src={faviconUrl} alt="Logo" className="w-full h-full object-contain" />
               </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 flex items-center justify-center text-xl font-bold text-gray-400">
                {domain ? domain.charAt(0).toUpperCase() : 'P'}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {domain || 'Projekt Dashboard'}
              </h1>
              <p className="text-sm text-gray-500 font-medium">
                 Performance Übersicht
              </p>
            </div>
          </div>
        </div>

        {/* TIMELINE */}
        {projectTimelineActive && (
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <ProjectTimelineWidget projectId={projectId} />
          </div>
        )}

        {/* KPI GRID */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <TableauKpiGrid 
            kpiData={data.kpiData} 
            isLoading={isLoading} 
            previousPeriodLabel="Vormonat"
          />
        </div>

        {/* MAIN SPLIT VIEW */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* CHART AREA */}
          <div className="xl:col-span-2 space-y-6">
             <div ref={chartSectionRef} className="bg-white p-1 rounded-2xl"> 
                <KpiTrendChart 
                  data={data.historyData} 
                  isLoading={isLoading} 
                  title="Besucher & Ereignisse" 
                />
             </div>
             
             {isLandingPagesVisible && (
               <div className="animate-fade-in">
                  <LandingPageChart 
                    data={aggregateLandingPages(data.landingPagesData)} 
                    isLoading={isLoading} 
                  />
               </div>
             )}
          </div>

          {/* AI WIDGET */}
          <div className="xl:col-span-1 h-full">
            <div className="sticky top-6 h-full max-h-[600px]">
              <AiAnalysisWidget 
                projectId={projectId} 
                dateRange={dateRange}
                chartRef={chartSectionRef}
                // ✅ WICHTIG: Hier übergeben wir die KPIs
                kpis={exportKpis}
              />
            </div>
          </div>
        </div>

        {/* PIE CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <TableauPieChart data={data.channelData} title="Zugriffe nach Channel" isLoading={isLoading} error={apiErrors?.ga4} />
          <TableauPieChart data={data.countryData} title="Zugriffe nach Land" isLoading={isLoading} error={apiErrors?.ga4} />
          <TableauPieChart data={data.deviceData} title="Zugriffe nach Endgerät" isLoading={isLoading} error={apiErrors?.ga4} />
        </div>
        
        {/* SEMRUSH */}
        {hasSemrushConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {hasKampagne1Config && <div className="card-glass p-4 sm:p-6"><SemrushTopKeywords projectId={projectId} /></div>}
            {hasKampagne2Config && <div className="card-glass p-4 sm:p-6"><SemrushTopKeywords02 projectId={projectId} /></div>}
          </div>
        )}

        {/* ADMIN */}
        {isAdmin && (
          <div className="mt-8 flex justify-end">
            <button 
              onClick={() => setIsLandingPagesVisible(!isLandingPagesVisible)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              {isLandingPagesVisible ? <EyeSlash /> : <Eye />}
              {isLandingPagesVisible ? 'Landingpage Chart verbergen' : 'Landingpage Chart (Admin) anzeigen'}
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
