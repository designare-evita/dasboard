// src/components/ProjectDashboard.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
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
import AiTrafficDetailWidgetV2 from '@/components/AiTrafficDetailWidgetV2';
import { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';
import SemrushTopKeywords from '@/components/SemrushTopKeywords';
import SemrushTopKeywords02 from '@/components/SemrushTopKeywords02';
import GlobalHeader from '@/components/GlobalHeader';
import ProjectTimelineWidget from '@/components/ProjectTimelineWidget'; 
import AiAnalysisWidget from '@/components/AiAnalysisWidget';
import LandingPageChart from '@/components/charts/LandingPageChart';
import { aggregateLandingPages } from '@/lib/utils';

// ✅ NEU: DataMax Chat Import
import { DataMaxChat } from '@/components/datamax';

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange?: (range: DateRangeOption) => void;
  projectId: string;
  domain: string;
  semrushTrackingId?: string;
  semrushTrackingId02?: string;
  projectTimelineActive?: boolean;
  faviconUrl?: string;
  
  countryData?: any[];
  channelData?: any[];
  deviceData?: any[];
  
  userRole?: string;
  userEmail?: string;
  
  showLandingPages?: boolean;
  dataMaxEnabled?: boolean; // ✅ NEU: Steuert Sichtbarkeit
}

export default function ProjectDashboard({ 
  data, 
  isLoading, 
  dateRange, 
  projectId,
  domain,
  semrushTrackingId,
  semrushTrackingId02,
  projectTimelineActive = false,
  faviconUrl,
  userRole,
  userEmail,
  showLandingPages = true,
  dataMaxEnabled = true // ✅ NEU: Default true
}: ProjectDashboardProps) {

  // Sicherstellen dass API Errors existieren, um Crashes zu vermeiden
  const safeApiErrors = data.apiErrors || {
    gsc: null,
    gscCrawl: null,
    ga4: null,
    semrush: null,
    bing: null
  };

  const hasSemrushConfig = !!semrushTrackingId || !!semrushTrackingId02;
  const hasKampagne1Config = !!semrushTrackingId;
  const hasKampagne2Config = !!semrushTrackingId02;

  // Calculate aggregated landing pages data
  const landingPageData = useMemo(() => {
    if (!data.landingPages || data.landingPages.length === 0) return [];
    return aggregateLandingPages(data.landingPages);
  }, [data.landingPages]);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      
      {/* 1. Global Header (Logo, User Menü, Breadcrumbs) */}
      <GlobalHeader 
         domain={domain} 
         faviconUrl={faviconUrl} 
         role={userRole}
         supportEmail={userEmail}
      />
      
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
        
        {/* 2. Timeline Widget (Conditional) */}
        {projectTimelineActive && (
          <div className="animate-fade-in-up">
            <ProjectTimelineWidget projectId={projectId} />
          </div>
        )}

        {/* 3. KPI Grid (Tableau Style) */}
        <TableauKpiGrid 
          data={data} 
          isLoading={isLoading} 
          previousData={data.previousData} // Für Vergleiche
          dateRange={dateRange}
        />

        {/* 4. AI Analysis Widget */}
         <AiAnalysisWidget 
          projectId={projectId} 
          dateRange={dateRange}
          domain={domain}
        />

        {/* 5. Main Charts Area */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Main Trend Chart (2/3 width) */}
          <div className="xl:col-span-2 card-glass p-1">
             <KpiTrendChart 
               data={data.history} 
               isLoading={isLoading} 
               dateRange={dateRange}
               error={safeApiErrors?.gsc}
             />
          </div>

          {/* AI Traffic Radar (1/3 width) */}
          <div className="xl:col-span-1">
             <AiTrafficDetailWidgetV2 
               projectId={projectId} 
               dateRange={dateRange} 
             />
          </div>
        </div>

        {/* 6. Landing Page Chart (Conditional) */}
        {showLandingPages && landingPageData.length > 0 && (
          <div className="card-glass p-1">
            <LandingPageChart 
              data={landingPageData}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* 7. Secondary Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* Top Keywords */}
          <div className="card-glass p-0 overflow-hidden h-full">
            <TopQueriesList 
              data={data.topQueries} 
              isLoading={isLoading}
              error={safeApiErrors?.gsc}
            />
          </div>

          {/* Charts Grid - jetzt responsive */}
          <TableauPieChart 
            data={data.channelData} 
            title="Zugriffe nach Kanal" 
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
        
        {hasSemrushConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 print-semrush-grid">
            {hasKampagne1Config && <div className="card-glass p-4 sm:p-6"><SemrushTopKeywords projectId={projectId} /></div>}
            {hasKampagne2Config && <div className="card-glass p-4 sm:p-6"><SemrushTopKeywords02 projectId={projectId} /></div>}
          </div>
        )}

      </div>

      {/* ✅ NEU: DataMax Chat - Floating Button unten rechts (Conditional) */}
      {dataMaxEnabled && (
        <DataMaxChat projectId={projectId} dateRange={dateRange} />
      )}

      {/* Animation Styles */}
      <style jsx global>{`
        @keyframes indeterminate-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-indeterminate-bar {
          animation: indeterminate-bar 1.5s infinite linear;
        }
        .card-glass {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
