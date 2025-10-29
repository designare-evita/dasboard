// src/components/ProjectDashboard.tsx (Korrigiert)
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
import SemrushTopKeywords from '@/components/SemrushTopKeywords'; // Import für die erste Tracking-ID
import SemrushTopKeywords02 from '@/components/SemrushTopKeywords02'; // Import für die zweite Tracking-ID
import useSWR from 'swr';
import { User } from '@/types';

// Importiere die neue Header-Komponente
import DashboardHeader from '@/components/DashboardHeader';

interface ProjectDashboardProps {
  data: ProjectDashboardData;
  semrushData: any; // Unused, aber für Kompatibilität behalten
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  showNoDataHint?: boolean;
  noDataHintText?: string;
  projectId?: string;
  domain?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ProjectDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  showNoDataHint = false,
  noDataHintText = "Für dieses Projekt wurden noch keine KPI-Daten geliefert.",
  projectId,
  domain
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  // User-Daten für Semrush Tracking-IDs laden
  const { data: userData } = useSWR<User>(
    projectId ? `/api/users/${projectId}` : null,
    fetcher
  );

  // PDF Export Handler
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
      
      {/* Dashboard Header */}
      {domain && (
        <DashboardHeader
          domain={domain}
          projectId={projectId}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          onPdfExport={handleExportPdf}
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
            label={kpiLabels[kpi] || KPI_TAB_META[activeKpi].title}
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

      {/* 4. BLOCK: Keyword Rankings für erste Tracking-ID */}
      <div>
        <SemrushTopKeywords trackingId={userData?.semrush_tracking_id} />
      </div>

      {/* 5. BLOCK: Keyword Rankings für zweite Tracking-ID */}
      <div>
        <SemrushTopKeywords02 trackingId={userData?.semrush_tracking_id_02} />
      </div>

    </div>
  );
}
