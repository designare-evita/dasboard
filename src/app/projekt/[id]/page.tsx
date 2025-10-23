// src/app/projekt/[id]/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useApiData from '@/hooks/use-api-data';
import KpiCard from '@/components/kpi-card';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import AiTrafficCard from '@/components/AiTrafficCard';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Klicks" isLoading={false} value={k.clicks.value} change={k.clicks.change} />
        <KpiCard title="Impressionen" isLoading={false} value={k.impressions.value} change={k.impressions.change} />
        <KpiCard title="Sitzungen" isLoading={false} value={k.sessions.value} change={k.sessions.change} />
        <KpiCard title="Nutzer" isLoading={false} value={k.totalUsers.value} change={k.totalUsers.change} />
      </div>

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
          <div className="lg:col-span-1 order-1">
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

       {/* Top 100 Suchanfragen Liste (Logbuch-Stil) */}
          {data.topQueries && data.topQueries.length > 0 && (
            <div className={`${data.aiTraffic ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800">
                  <ClockHistory size={20} />
                  Top 100 Suchanfragen
                </h3>
                {/* Container mit Scrollbar */}
                <div className="border rounded-lg max-h-96 overflow-y-auto">
                  <ul className="divide-y divide-gray-100">
                    {data.topQueries.map((query, index) => (
                      <li key={`${query.query}-${index}`} className="p-4 space-y-2 hover:bg-gray-50">
                        {/* Suchanfrage */}
                        <p className="text-base font-medium text-gray-900">{query.query}</p>
                        {/* Metadaten */}
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-gray-500">
                          <span title="Klicks">
                            Klicks: <span className="font-semibold text-gray-700">{query.clicks.toLocaleString('de-DE')}</span>
                          </span>
                          <span title="Impressionen">
                            Impr.: <span className="font-semibold text-gray-700">{query.impressions.toLocaleString('de-DE')}</span>
                          </span>
                          <span title="Click-Through-Rate">
                            CTR: <span className="font-semibold text-gray-700">{(query.ctr * 100).toFixed(1)}%</span>
                          </span>
                          <span title="Position">
                            Pos.: <span className="font-semibold text-gray-700">{query.position.toFixed(1)}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
