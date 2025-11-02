// src/components/ProjectDashboard.tsx (Version 32 - Mit Multi-Linien-Chart)
'use client';

// 1. 'useState' wird nicht mehr für den Chart benötigt
import { 
  ProjectDashboardData, 
  ActiveKpi, // Wird noch von KpiCardsGrid benötigt (implizit)
  normalizeFlatKpis 
} from '@/lib/dashboard-shared';
import KpiCardsGrid from '@/components/KpiCardsGrid';

// 2. 'KpiTrendChart' import entfernt und 'KpiMultiLineChart' hinzugefügt
// import KpiTrendChart from '@/components/charts/KpiTrendChart';
import KpiMultiLineChart from '@/components/charts/KpiMultiLineChart'; // NEU

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
  showNoDataHint?: boolean;
  noDataHintText?: string;
  projectId?: string;
  domain?: string;
  semrushTrackingId02?: string | null;
  onPdfExport?: () => void;
}

export default function ProjectDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  showNoDataHint = false,
  noDataHintText = "Für dieses Projekt wurden noch keine KPI-Daten geliefert.",
  projectId,
  domain,
  semrushTrackingId02,
  onPdfExport
}: ProjectDashboardProps) {
  
  // 3. Dieser State wird für den neuen Chart nicht mehr benötigt
  // const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const normalizedKpis = normalizeFlatKpis(data.kpis);

  const hasSemrushConfig = userRole === 'ADMIN' || userRole === 'SUPERADMIN' || !!semrushTrackingId02;

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

      {/* KPI Cards (bleibt gleich) */}
      <div className="mt-6">
        <KpiCardsGrid
          kpis={normalizedKpis}
          isLoading={isLoading}
        />
      </div>

      {/* 4. KPI-Trendchart ersetzt durch Multi-Linien-Chart */}
      <div className="mt-6">
        {/* Dies ist der alte Chart-Block, den wir ersetzen */}
        {/* <KpiTrendChart 
          activeKpi={activeKpi}
          onKpiChange={setActiveKpi}
          allChartData={data.charts}
          data={data.charts?.[activeKpi] ?? []}
        /> */}

        {/* ✅ NEU: Der Multi-Linien-Chart */}
        <KpiMultiLineChart 
          allChartData={data.charts}
        />
      </div>

      {/* AI Traffic & Top Queries (bleibt gleich) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="xl:col-span-1">
          <AiTrafficCard 
            totalSessions={data.aiTraffic?.totalSessions ?? 0}
            totalUsers={data.aiTraffic?.totalUsers ?? 0}
            topAiSources={data.aiTraffic?.topAiSources ?? []}
            className="h-full"
          />
        </div>
        
        <div className="xl:col-span-2">
          <TopQueriesList 
            queries={data.topQueries ?? []} 
            isLoading={isLoading}
            className="h-full"
          />
        </div>
      </div>

      {/* Semrush Keywords (bleibt gleich) */}
      {hasSemrushConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <SemrushTopKeywords projectId={projectId} />
          </div>

          {semrushTrackingId02 ? (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
              <SemrushTopKeywords02 projectId={projectId} />
            </div>
          ) : (
            (userRole === 'ADMIN' || userRole === 'SUPERADMIN') && (
              <div className="bg-gray-50 rounded-lg border border-gray-200 border-dashed">
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="text-gray-400 mb-3">
                    <svg 
                      className="w-16 h-16 mx-auto" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={1.5} 
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    Zweite Kampagne nicht konfiguriert
                  </h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Fügen Sie eine zweite Semrush Tracking-ID hinzu, um hier weitere Keywords zu verfolgen.
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
