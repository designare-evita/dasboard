// src/components/ProjectDashboard.tsx (Ihre 'ProjectDashboard(2).tsx')
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

// --- NEUER IMPORT ---
import SemrushKpiCards, { SemrushData } from '@/components/SemrushKpiCards';

interface ProjectDashboardProps {
  /** Die vom API-Endpunkt geladenen Daten (Google, AI, etc.) */
  data: ProjectDashboardData;

  /** * NEUE PROP: Die separat geladenen Semrush-Daten.
   * Siehe HINWEIS in Schritt 4.
   */
  semrushData: SemrushData | null;

  /** Zeigt an, ob die Daten noch geladen werden */
  isLoading: boolean;
  /** Aktuell ausgewählter Zeitraum */
  dateRange: DateRangeOption;
  /** Callback zum Ändern des Zeitraums */
  onDateRangeChange: (range: DateRangeOption) => void;
  /** Ob ein Hinweis auf fehlende Daten angezeigt werden soll */
  showNoDataHint?: boolean;
  /** Alternativer Text für den \"Keine Daten\" Hinweis */
  noDataHintText?: string;
}

export default function ProjectDashboard({
  data,
  semrushData, // Neue Prop hier empfangen
  isLoading,
  dateRange,
  onDateRangeChange,
  showNoDataHint = false,
  noDataHintText = "Für dieses Projekt wurden noch keine KPI-Daten geliefert."
}: ProjectDashboardProps) {
  
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  // Normalisiert die KPIs (Clicks, Impressions, etc.)
  const kpis = normalizeFlatKpis(data.kpis);

  // Leitet die Daten für das aktive Chart ab
  const chartSeries = data.kpis[activeKpi]?.series || [];
  const kpiLabels: Record<string, string> = {
    clicks: 'Klicks',
    impressions: 'Impressionen',
    sessions: 'Sitzungen (GA4)',
    users: 'Nutzer (GA4)',
  };

  return (
    <div className="space-y-8">
      {/* --- 1. BLOCK: Google KPI-Karten --- */}
      <div>
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
          <h2 className="text-xl font-semibold text-gray-700">
            Google Übersicht (Search Console & GA4)
          </h2>
          <DateRangeSelector
            selectedRange={dateRange}
            onRangeChange={onDateRangeChange}
          />
        </div>
        <KpiCardsGrid kpis={kpis} isLoading={isLoading} />
      </div>

      {/* --- 2. BLOCK: Google KPI-Chart --- */}
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

      {/* --- 3. BLOCK: SEMRUSH (NEU) ---
        Wie gewünscht NACH den Google-Daten.
        Wir übergeben die 'semrushData'-Prop und den 'isLoading'-Status.
      */}
      <SemrushKpiCards 
        data={semrushData} 
        isLoading={isLoading} 
      />
        
      {/* --- 4. BLOCK: KI-Traffic + Top Queries nebeneinander --- */}
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
    </div>
  );
}
