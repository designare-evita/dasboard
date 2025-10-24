// src/components/ProjectDashboard.tsx
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

interface ProjectDashboardProps {
  /** Die vom API-Endpunkt geladenen Daten */
  data: ProjectDashboardData;
  /** Zeigt an, ob die Daten noch geladen werden */
  isLoading: boolean;
  /** Aktuell ausgewählter Zeitraum */
  dateRange: DateRangeOption;
  /** Callback zum Ändern des Zeitraums */
  onDateRangeChange: (range: DateRangeOption) => void;
  /** Ob ein Hinweis auf fehlende Daten angezeigt werden soll */
  showNoDataHint?: boolean;
  /** Alternativer Text für den "Keine Daten" Hinweis */
  noDataHintText?: string;
}

export default function ProjectDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  showNoDataHint = false,
  noDataHintText = "Für dieses Projekt wurden noch keine KPI-Daten geliefert."
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  // Deutsche Labels für KPIs
  const kpiLabels: Partial<Record<string, string>> = {
    clicks: 'Klicks',
    impressions: 'Impressionen',
    sessions: 'Sitzungen',
    users: 'Nutzer',
    visitors: 'Nutzer', // Falls der Typ 'visitors' heißt
  };

  // Normalisierte KPIs für eine sichere Anzeige
  const kpis = normalizeFlatKpis(data.kpis);

  // Aktive Chart-Serie basierend auf dem Tab
  const chartSeries = (data.charts && data.charts[activeKpi]) ? data.charts[activeKpi]! : [];

  return (
    <>
      {/* Header mit DateRangeSelector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        <DateRangeSelector 
          value={dateRange} 
          onChange={onDateRangeChange}
        />
      </div>
        
      {/* KPI-Karten Grid */}
      <KpiCardsGrid kpis={kpis} isLoading={isLoading} />
        
      {/* Charts - volle Breite */}
      <div className="mt-8">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex border-b border-gray-200">
            {(Object.keys(KPI_TAB_META) as ActiveKpi[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveKpi(key)}
                className={`py-2 px-4 text-sm font-medium transition-colors ${
                  activeKpi === key
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
                }`}
              >
                {KPI_TAB_META[key].title}
              </button>
            ))}
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
      </div>
        
      {/* KI-Traffic + Top Queries nebeneinander */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KI-Traffic Card ZUERST (1 Spalte) */}
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
          
        {/* Top Queries mit extrahierter Komponente */}
        {data.topQueries && data.topQueries.length > 0 && (
          <div className={`${data.aiTraffic ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <TopQueriesList 
              queries={data.topQueries} 
              isLoading={isLoading}
            />
          </div>
        )}
      </div>
    </>
  );
}
