// src/components/SemrushKpiCards.tsx

'use client';

import useSWR from 'swr';
import KpiCard from './kpi-card'; // Wiederverwenden der bestehenden KPI-Karte
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

  if (error || data?.error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md" role="alert">
        <p className="font-bold">Semrush-Fehler</p>
        <p>{data?.error || (error as Error).message}</p>
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
          // KORRIGIERT: 'metric' zu 'value' geändert
          value={data?.organicKeywords ?? 0}
          // KORRIGIERT: 'isLoading' Prop hinzugefügt
          isLoading={isLoading}
          // 'change' wird weggelassen (ist jetzt optional)
          // 'icon', 'iconColor', 'showTrend' entfernt
        />
        <KpiCard
          title="Organischer Traffic"
          // KORRIGIERT: 'metric' zu 'value' geändert
          value={data?.organicTraffic ?? 0}
          // KORRIGIERT: 'isLoading' Prop hinzugefügt
          isLoading={isLoading}
          // 'change' wird weggelassen (ist jetzt optional)
        />
      </div>
    </div>
  );
}
