// src/app/projekt/[id]/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useApiData from '@/hooks/use-api-data';
import KpiCard from '@/components/kpi-card';
import KpiTrendChart from '@/components/charts/KpiTrendChart';

// --- Typen für die API-Antwort (flache KPI-Struktur auf Projektebene) ---
interface KpiDatum {
  value: number;
  change: number;
}
interface ChartPoint {
  date: string;
  value: number;
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
}
type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

// --- sichere Defaults + Normalisierung (liefert immer vollständige KPI-Werte) ---
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

  const { data, isLoading, error } = useApiData<ProjectApiData>(`/api/projects/${projectId}`);

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

  // Aktuelle Chartserie (leer, wenn nicht vorhanden)
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
    <>
      <div className="p-4 sm:p-6 md:p-8">
      <h2 className="text-3xl font-bold mb-6">Projekt-Dashboard</h2>

      {/* KPI-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Klicks" isLoading={false} value={k.clicks.value} change={k.clicks.change} />
        <KpiCard title="Impressionen" isLoading={false} value={k.impressions.value} change={k.impressions.change} />
        <KpiCard title="Sitzungen" isLoading={false} value={k.sessions.value} change={k.sessions.change} />
        <KpiCard title="Nutzer" isLoading={false} value={k.totalUsers.value} change={k.totalUsers.change} />
      </div>

      {/* Charts mit Tabs */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <div className="flex border-b border-gray-200">
          {(Object.keys(tabMeta) as ActiveKpi[]).map((key) => (
            <button
              key={key}
              onClick={() => setActiveKpi(key)}
              className={`py-2 px-4 text-sm font-medium ${
                activeKpi === key
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tabMeta[key].title}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <KpiTrendChart data={chartSeries} color={tabMeta[activeKpi].color} />
        </div>

        {showNoDataHint && (
          <p className="mt-6 text-sm text-gray-500">
            Hinweis: Für dieses Projekt wurden noch keine KPI-/Zeitreihen-Daten geliefert. Es werden
            vorübergehend Platzhalter-Werte (0) angezeigt.
          </p>
        )}
      </div>  </div>
    </>
  );
}
