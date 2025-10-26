// src/components/SemrushKpiCards.tsx
'use client';

import KpiCard from './kpi-card';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

// Exportierter Typ für die Semrush-Daten
export interface SemrushData {
  organicKeywords: number | null;
  organicTraffic: number | null;
  lastFetched: string | null;
}

interface SemrushKpiCardsProps {
  data: SemrushData | null | undefined;
  isLoading: boolean;
}

export default function SemrushKpiCards({ data, isLoading }: SemrushKpiCardsProps) {
  
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'dd. MMMM yyyy, HH:mm', { locale: de });
    } catch (e) {
      return 'Ungültiges Datum';
    }
  };

  // Wenn keine Daten vorhanden sind (z.B. Domain nicht konfiguriert),
  // rendern wir nichts (oder eine Hinweismeldung).
  if (!data && !isLoading) {
     return (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-500">Für dieses Projekt sind keine Semrush-Daten konfiguriert oder verfügbar.</p>
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
          value={data?.organicKeywords ?? 0}
          isLoading={isLoading}
        />
        <KpiCard
          title="Organischer Traffic"
          value={data?.organicTraffic ?? 0}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
