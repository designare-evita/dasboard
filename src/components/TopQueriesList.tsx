// src/components/TopQueriesList.tsx
import React from 'react';
import { ClockHistory } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils'; // cn import beibehalten

type TopQueryData = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

interface TopQueriesListProps {
  queries: TopQueryData[];
  isLoading?: boolean;
  className?: string; // className prop beibehalten
}

export default function TopQueriesList({
  queries,
  isLoading = false,
  className // className prop verwenden
}: TopQueriesListProps) {

  // Ladezustand anzeigen
  if (isLoading) {
    return (
      // className anwenden
      <div className={cn("bg-white p-6 rounded-lg shadow-md border border-gray-200", className)}>
        <div className="flex items-center gap-2 mb-4">
          <ClockHistory className="text-indigo-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Top 100 Suchanfragen</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
             <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Leer-Zustand anzeigen
  if (!queries || queries.length === 0) {
    return (
      // className anwenden
      <div className={cn("bg-white p-6 rounded-lg shadow-md border border-gray-200", className)}>
        <div className="flex items-center gap-2 mb-4">
          <ClockHistory className="text-indigo-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Top 100 Suchanfragen</h3>
        </div>
        <div className="p-4 text-center text-sm text-gray-500 italic">
          Keine Suchanfragen gefunden.
        </div>
      </div>
    );
  }

  // Komponente rendern
  return (
    // Hier die Änderungen für Flexbox und Höhe:
    // 1. `flex flex-col` hinzufügen, damit die Karte intern vertikal flexibel ist
    // 2. `cn` verwenden, um die übergebene `className` (die 'h-full' enthalten kann) anzuwenden
    <div className={cn("bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col", className)}>
      <div className="flex items-center gap-2 mb-4">
        <ClockHistory className="text-indigo-600" size={20} />
        <h3 className="text-lg font-semibold text-gray-900">Top 100 Suchanfragen</h3>
      </div>

      {/* 3. Anpassung für scrollbare Liste innerhalb der vollen Höhe:
          - `flex-1` und `min-h-0` entfernen
          - `max-h-XX` setzen (z.B. max-h-96 oder eine andere passende Höhe)
          - `overflow-y-auto` hinzufügen
      */}
      <div className="max-h-96 overflow-y-auto"> {/* Beispiel: max-h-96 */}
        <ul className="divide-y divide-gray-100">
          {queries.map((query, index) => (
            <li key={`${query.query}-${index}`} className="py-3 px-2 space-y-1.5 hover:bg-gray-50 transition-colors">
              <p className="text-base font-medium text-gray-900 leading-tight break-words">{query.query}</p> {/* break-words hinzugefügt */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-gray-500"> {/* text-xs statt text-s */}
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
  );
}
