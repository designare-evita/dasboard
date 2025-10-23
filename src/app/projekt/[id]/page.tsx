// src/app/projekt/[id]/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useApiData from '@/hooks/use-api-data';
import KpiCard from '@/components/kpi-card';
import KpiCardsGrid from '@/components/KpiCardsGrid';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import AiTrafficCard from '@/components/AiTrafficCard';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';

// --- Typen für die API-Antwort ---
interface KpiDatum {
  value: number;
  change: number;
  aiTraffic?: { // ✅ Optional für Sessions
    value: number;
    percentage: number;
  };
}

interface ChartPoint {
  date: string;
  value: number;
}

interface TopQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface AiTrafficData { // ✅ Neuer Typ
  totalSessions: number;
  totalUsers: number;
  sessionsBySource: {
    [source: string]: number;
  };
  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  trend: Array<{
    date: string;
    sessions: number;
  }>;
}

interface ProjectApiData {
  kpis?: {
    clicks?: KpiDatum;
    impressions?: KpiDatum;
    sessions?: KpiDatum;
    totalUsers?: KpiDatum;
  };
  charts?: {
    clicks?: ChartPoint[];
    impressions?: ChartPoint[];
    sessions?: ChartPoint[];
    totalUsers?: ChartPoint[];
  };
  topQueries?: TopQueryData[];
  aiTraffic?: AiTrafficData; // ✅ KI-Traffic hinzugefügt
}

type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

// --- sichere Defaults + Normalisierung ---
const ZERO_KPI: KpiDatum = { value: 0, change: 0 };

function normalizeFlatKpis(input?: ProjectApiData['kpis']) {
  return {
    clicks: input?.clicks ?? ZERO_KPI,
    impressions: input?.impressions ?? ZERO_KPI,
    sessions: input?.sessions ?? ZERO_KPI,
    totalUsers: input?.totalUsers ?? ZERO_KPI,
  };
}

export default function ProjektDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  const { data, isLoading, error } = useApiData<ProjectApiData>(
    `/api/projects/${projectId}?dateRange=${dateRange}`
  );

  // Lade- und Fehlerzustände
  if (isLoading) {
    return (
      <div className="p-6">
        <p>Lade Projektdaten…</p>
      </div>
    );
  }

  if (error) {
    const msg = typeof error === 'string' ? error : 'Unbekannter Fehler beim Laden.';
    return (
      <div className="p-6">
        <p className="text-red-500">Fehler beim Laden der Daten: {msg}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p>Keine Daten für dieses Projekt gefunden.</p>
      </div>
    );
  }

  // Immer sichere KPI-Werte verwenden
  const k = normalizeFlatKpis(data.kpis);

  // Aktuelle Chartserie
  const chartSeries: ChartPoint[] =
    (data.charts && data.charts[activeKpi]) ? data.charts[activeKpi]! : [];

  // Hinweis nur zeigen, wenn wirklich keine sinnvollen Daten vorhanden sind
  const hasAnyKpiValue =
    (k.clicks.value > 0) ||
    (k.impressions.value > 0) ||
    (k.sessions.value > 0) ||
    (k.totalUsers.value > 0);

  const hasAnyChartData =
    !!data.charts &&
    Boolean(
      (data.charts.clicks && data.charts.clicks.length) ||
      (data.charts.impressions && data.charts.impressions.length) ||
      (data.charts.sessions && data.charts.sessions.length) ||
      (data.charts.totalUsers && data.charts.totalUsers.length)
    );

  const showNoDataHint = !hasAnyKpiValue && !hasAnyChartData;

  const tabMeta: Record<ActiveKpi, { title: string; color: string }> = {
    clicks: { title: 'Klicks', color: '#3b82f6' },
    impressions: { title: 'Impressionen', color: '#8b5cf6' },
    sessions: { title: 'Sitzungen', color: '#10b981' },
    totalUsers: { title: 'Nutzer', color: '#f59e0b' },
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header mit DateRangeSelector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Projekt-Dashboard</h2>
        <DateRangeSelector 
          value={dateRange} 
          onChange={setDateRange}
        />
      </div>

      {/* KPI-Karten */}
<KpiCardsGrid kpis={k} isLoading={false} />

      {/* Charts - volle Breite */}
      <div className="mt-8">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex border-b border-gray-200">
            {(Object.keys(tabMeta) as ActiveKpi[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveKpi(key)}
                className={`py-2 px-4 text-sm font-medium transition-colors ${
                  activeKpi === key
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                }`}
              >
                {tabMeta[key].title}
              </button>
            ))}
          </div>

          <div className="mt-4 h-72">
            <KpiTrendChart data={chartSeries} color={tabMeta[activeKpi].color} />
          </div>

          {showNoDataHint && (
            <p className="mt-6 text-sm text-gray-500">
              Hinweis: Für dieses Projekt wurden noch keine KPI-/Zeitreihen-Daten geliefert. Es werden
              vorübergehend Platzhalter-Werte (0) angezeigt.
            </p>
          )}
        </div>
      </div>

      {/* ✅ KI-Traffic ZUERST + Top Queries DANACH nebeneinander */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ✅ KI-Traffic Card ZUERST (1 Spalte) */}
        {data.aiTraffic && (
          <div className="lg:col-span-1">
            <AiTrafficCard
              totalSessions={data.aiTraffic.totalSessions}
              totalUsers={data.aiTraffic.totalUsers}
              percentage={k.sessions.aiTraffic?.percentage || 0}
              topSources={data.aiTraffic.topAiSources}
              isLoading={false}
              dateRange={dateRange}
            />
          </div>
        )}

        {/* ✅ Top Queries mit extrahierter Komponente */}
        {data.topQueries && data.topQueries.length > 0 && (
          <div className={`${data.aiTraffic ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <TopQueriesList 
              queries={data.topQueries} 
              isLoading={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
