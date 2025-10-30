// src/components/ProjectDashboard.tsx (Version 28 - Korrigiert)
'use client';

import { useState } from 'react';
import { 
  ProjectDashboardData, 
  ActiveKpi, 
  KPI_TAB_META, 
  normalizeFlatKpis 
} from '@/lib/dashboard-shared';
import KpiCardsGrid from '@/components/KpiCardsGrid';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import AiTrafficCard from '@/components/AiTrafficCard';
import { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';
import SemrushTopKeywords from '@/components/SemrushTopKeywords';
import SemrushTopKeywords02 from '@/components/SemrushTopKeywords02'; // Importiert die geänderte Komponente
import DashboardHeader from '@/components/DashboardHeader';
import { useSession } from 'next-auth/react'; 

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  showNoDataHint?: boolean;
  noDataHintText?: string;
  projectId?: string; // Wird an beide Komponenten übergeben
  domain?: string;
  semrushTrackingId02?: string | null; // Wird nur noch für die Anzeige-Logik genutzt
  onPdfExport?: () => void;
}

export default function ProjectDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  showNoDataHint = false,
  noDataHintText = "Für dieses Projekt wurden noch keine KPI-Daten geliefert.",
  projectId, // Diese ID nutzen wir jetzt
  domain,
  semrushTrackingId02, // Diese ID nutzen wir nur für die if-Bedingung
  onPdfExport
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const normalizedKpis = normalizeFlatKpis(data.kpis);
  const chartData = data.charts?.[activeKpi] ?? [];

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

      {/* Außenabstand */}
      <div className="mt-6">
        <KpiCardsGrid
          kpis={normalizedKpis}
          isLoading={isLoading}
        />
      </div>

      {/* KPI-Trendchart */}
      <div className="mt-6">
        <KpiTrendChart 
          data={chartData}
          color={KPI_TAB_META[activeKpi].color}
          label={KPI_TAB_META[activeKpi].title}
        />
      </div>

      {/* Reihenfolge und Höhe */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        
        {/* SPALTE 1 AiTrafficCard */}
        <div className="xl:col-span-1">
          <AiTrafficCard 
            totalSessions={data.aiTraffic?.totalSessions ?? 0}
            totalUsers={data.aiTraffic?.totalUsers ?? 0}
            topAiSources={data.aiTraffic?.topAiSources ?? []}
            className="h-full"
          />
        </div>
        
        {/* SPALTE 2  TopQueriesList */}
        <div className="xl:col-span-2">
          <TopQueriesList 
            queries={data.topQueries ?? []} 
            isLoading={isLoading}
            className="h-full"
          />
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* SEMRUSH KEYWORDS (KAMPAGNE 1 & 2) */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        
        {/* Kampagne 1: Standard Tracking ID */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <SemrushTopKeywords 
            projectId={projectId} 
          />
        </div>

        {/* Kampagne 2: Explizite Tracking ID */}
        {/* Wir prüfen weiterhin, ob 'semrushTrackingId02' existiert, 
            um zu entscheiden, OB wir die Komponente anzeigen... */}
        {semrushTrackingId02 ? (
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            
            {/* ...aber wir übergeben 'projectId' an die Komponente,
                genau wie bei Kampagne 1 */}
            <SemrushTopKeywords02 
              projectId={projectId} // KORREKTUR: von trackingId auf projectId geändert
            />
          </div>
        ) : (
          // Platzhalter (unverändert)
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
        )}
      </div>
      
      {/* Info-Box (unverändert) */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>Hinweis:</strong> Die Keyword-Daten werden alle 14 Tage automatisch aktualisiert. 
          Sie zeigen die Top 20 organischen Keywords mit den besten Rankings aus Ihren Semrush Position Tracking Kampagnen.
        </p>
      </div>
    </>
  );
}
