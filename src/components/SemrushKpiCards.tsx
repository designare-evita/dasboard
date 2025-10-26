// src/components/SemrushKpiCards.tsx

'use client';

import useSWR from 'swr';
import KpiCard from './kpi-card'; // Wiederverwenden der bestehenden KPI-Karte
import { GraphUpArrow } from 'react-bootstrap-icons';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

// SWR-Fetcher-Funktion
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error('Fehler beim Laden der Semrush-Daten');
  }
  return res.json();
});

// Typ für die API-Antwort
interface SemrushData {
  organicKeywords: number | null;
  organicTraffic: number | null;
  lastFetched: string | null;
  isFromCache: boolean;
  error?: string;
}

export default function SemrushKpiCards({ projectId }: { projectId: string }) {
  const { data, error, isLoading } = useSWR<SemrushData>(
    `/api/semrush?projectId=${projectId}`, 
    fetcher
  );

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'dd. MMMM yyyy, HH:mm', { locale: de });
    } catch (e) {
      return 'Ungültiges Datum';
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Skeleton Loader */}
        <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-8 bg-gray-300 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-8 bg-gray-300 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md" role="alert">
        <p className="font-bold">Semrush-Fehler</p>
        <p>{data?.error || error.message}</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-700">Semrush Übersicht</h2>
        <span className="text-sm text-gray-500">
          Zuletzt aktualisiert: {formatDate(data?.lastFetched)}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiCard
          title="Organische Keywords"
          metric={data?.organicKeywords ?? 0}
          icon={GraphUpArrow}
          iconColor="text-purple-500"
          // Semrush-Karten haben keine Trend-Daten
          showTrend={false} 
        />
        <KpiCard
          title="Organischer Traffic"
          metric={data?.organicTraffic ?? 0}
          icon={GraphUpArrow}
          iconColor="text-teal-500"
          showTrend={false}
        />
      </div>
    </div>
  );
}
