// src/components/ProjectDashboard.tsx (Vollständig & Korrigiert)
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
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';
import SemrushTopKeywords from '@/components/SemrushTopKeywords';
import SemrushTopKeywords02 from '@/components/SemrushTopKeywords02';
import DashboardHeader from '@/components/DashboardHeader';

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  semrushData: any | null; // Behalten für Kompatibilität, wird aber nicht mehr verwendet
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  showNoDataHint?: boolean;
  noDataHintText?: string;
  projectId?: string;
  domain?: string;
  semrushTrackingId?: string | null; // Für Kampagne 1
  semrushTrackingId02?: string | null; // Für Kampagne 2
}

export default function ProjectDashboard({
  data,
  semrushData,
  isLoading,
  dateRange,
  onDateRangeChange,
  showNoDataHint = false,
  noDataHintText = "Für dieses Projekt wurden noch keine KPI-Daten geliefert.",
  projectId,
  domain,
  semrushTrackingId,
  semrushTrackingId02
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  // PDF Export Handler (muss hier definiert bleiben)
  const handleExportPdf = () => {
    window.print();
  };

  const kpis = normalizeFlatKpis(data.kpis);

  type DataWithCharts = ProjectDashboardData & { 
    charts?: Record<ActiveKpi, Array<{ date: string; value: number }>> 
  };
  const chartSeries = (data as DataWithCharts).charts?.[activeKpi] || [];
  
  const kpiLabels: Record<string, string> = {
    clicks: 'Klicks',
    impressions: 'Impressionen',
    sessions: 'Sitzungen (GA4)',
    totalUsers: 'Nutzer (GA4)',
  };

  return (
    <div className="space-y-8">
      
      {/* Dashboard Header (Refactored) */}
      {domain && (
        <DashboardHeader
          domain={domain}
          projectId={projectId}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          onPdfExport={handleExportPdf} // Wird an die Komponente übergeben
        />
      )}

      {/* 1. BLOCK: Google KPI-Karten */}
      <div>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Google Übersicht (Search Console & GA4)
        </h2>
        <KpiCardsGrid kpis={kpis} isLoading={isLoading} />
      </div>

      {/* 2. BLOCK: Google KPI-Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">
            Performance-Trend
          </h3>
          <div className="flex-shrink-0 flex flex-wrap gap-2">
            {(Object.keys(KPI_TAB_META) as ActiveKpi[]).map((kpi) => (
              <button
                key={kpi}
                onClick={() => setActiveKpi(kpi)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  activeKpi === kpi
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {KPI_TAB_META[kpi].title}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 h-72">
          <KpiTrendChart 
            data={chartSeries} 
            color={KPI_TAB_META[activeKpi].color}
            label={kpiLabels[activeKpi] || KPI_TAB_META[activeKpi].title}
          />
        </div>

        {showNoDataHint && (
          <p className="mt-6 text-sm text-gray-500">
            {noDataHintText}
          </p>
        )}
      </div>

     {/* 3. BLOCK: KI-Traffic + Top Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {data.aiTraffic && (
          <div className="lg:col-span-1">
            <AiTrafficCard
              totalSessions={data.aiTraffic.totalSessions}
              totalUsers={data.aiTraffic.totalUsers}
              percentage={kpis.sessions.aiTraffic?.percentage || 0}
              topSources={data.aiTraffic.topAiSources}
              isLoading={isLoading}
              dateRange={dateRange}
              className="h-full"
            />
          </div>
        )}

        {data.topQueries && data.topQueries.length > 0 && (
          <div className={`${data.aiTraffic ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <TopQueriesList
              queries={data.topQueries}
              isLoading={isLoading}
              className="h-full"
            />
          </div>
        )}
      </div>


    {/* 4. BLOCK: Semrush Keyword Rankings */}
      <div>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Semrush Keyword Rankings
        </h2>
        
        {/* Grid Layout für beide Keyword-Tabellen */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Kampagne 1 - Zeige immer (mit projectId) */}
          <div>
            <SemrushTopKeywords 
              projectId={projectId}
            />
          </div>

          {/* Kampagne 2 - Zeige nur wenn trackingId02 vorhanden */}
          {semrushTrackingId02 && (
            <div>
              <SemrushTopKeywords02 
                trackingId={semrushTrackingId02}
              />
            </div>
          )}
          
          {/* Wenn keine zweite Kampagne, zeige Platzhalter */}
          {!semrushTrackingId02 && (
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 border-dashed">
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
        
        {/* Info-Box */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Hinweis:</strong> Die Keyword-Daten werden alle 14 Tage automatisch aktualisiert. 
            Sie zeigen die Top 20 organischen Keywords mit den besten Rankings aus Ihren Semrush Position Tracking Kampagnen.
          </p>
        </div>
      </div>

    </div>
  );
}
