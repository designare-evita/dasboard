// src/components/ProjectDashboard.tsx (Debug-Version)
'use client';

import { useState, useEffect } from 'react';
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
import SemrushKpiCards, { SemrushData } from '@/components/SemrushKpiCards';
import SemrushTopKeywords from '@/components/SemrushTopKeywords';
import SemrushConfigDisplay from '@/components/SemrushConfigDisplay';

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  semrushData: SemrushData | null;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  showNoDataHint?: boolean;
  noDataHintText?: string;
  projectId?: string;
}

export default function ProjectDashboard({
  data,
  semrushData,
  isLoading,
  dateRange,
  onDateRangeChange,
  showNoDataHint = false,
  noDataHintText = "Für dieses Projekt wurden noch keine KPI-Daten geliefert.",
  projectId
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  // DEBUG: Log bei jedem Render
  useEffect(() => {
    console.log('[ProjectDashboard] Rendered with projectId:', projectId);
  }, [projectId]);

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
      {/* DEBUG INFO - NUR IN DEVELOPMENT */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
          <h3 className="font-bold text-yellow-900 mb-2">🔍 DEBUG INFO (nur in Development sichtbar)</h3>
          <div className="text-sm space-y-1">
            <div><strong>Current ProjectId:</strong> {projectId || 'NICHT GESETZT!'}</div>
            <div><strong>Semrush Data:</strong> {semrushData ? 'Vorhanden' : 'Null'}</div>
            <div><strong>Keywords werden geladen für ProjectId:</strong> {projectId || 'FEHLT!'}</div>
          </div>
        </div>
      )}

      {/* 1. BLOCK: Google KPI-Karten */}
      <div>
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
          <h2 className="text-xl font-semibold text-gray-700">
            Google Übersicht (Search Console & GA4)
          </h2>
          <DateRangeSelector
            value={dateRange}
            onChange={onDateRangeChange}
          />
        </div>
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
            />
          </div>
        )}
          
        {data.topQueries && data.topQueries.length > 0 && (
          <div className={`${data.aiTraffic ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <TopQueriesList 
              queries={data.topQueries} 
              isLoading={isLoading} 
            />
          </div>
        )}
      </div>

      {/* 4. BLOCK: Semrush Übersicht */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Semrush KPI-Karten */}
        <div>
          <SemrushKpiCards 
            data={semrushData} 
            isLoading={isLoading} 
          />
        </div>

        {/* Semrush Top Keywords */}
        <div className="lg:col-span-2">
          {/* Key-Prop hinzugefügt um Force-Remount bei projectId-Änderung */}
          <SemrushTopKeywords 
            key={projectId} 
            projectId={projectId} 
          />
        </div>
      </div>

      {/* 5. BLOCK: Semrush Konfiguration (kompakt) */}
      <div>
        <SemrushConfigDisplay projectId={projectId} />
      </div>
    </div>
  );
}
