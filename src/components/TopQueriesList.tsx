// src/components/TopQueriesList.tsx
import React from 'react';
import { ClockHistory } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils'; // Importiere das cn-Hilfsprogramm

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
  className?: string; // <-- 1. HINZUGEFÜGT
}

export default function TopQueriesList({ 
  queries, 
  isLoading = false, 
  className // <-- 2. HINZUGEFÜGT
}: TopQueriesListProps) {
  
  if (isLoading) {
    return (
      // 👇 3. ANGEPASST
      <div className={cn("bg-white p-6 rounded-lg shadow-md border border-gray-200", className)}>
        <div className="flex items-center gap-2 mb-4">
          <ClockHistory className="text-indigo-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Top 100 Suchanfragen</h3>
        </div>
        <div className="max-h-96 overflow-y-auto p-4 text-center text-sm text-gray-500">
          Lade Daten...
        </div>
      </div>
    );
  }

  if (!queries || queries.length === 0) {
    return (
      // 👇 3. ANGEPASST
      <div className={cn("bg-white p-6 rounded-lg shadow-md border border-gray-200", className)}>
        <div className="flex items-center gap-2 mb-4">
          <ClockHistory className="text-indigo-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Top 100 Suchanfragen</h3>
        </div>
        <div className="max-h-96 overflow-y-auto p-4 text-center text-sm text-gray-500 italic">
          Keine Suchanfragen gefunden.
        </div>
      </div>
    );
  }

  return (
    // 👇 3. ANGEPASST (flex flex-col und className)
    <div className={cn("bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col", className)}>
      <div className="flex items-center gap-2 mb-4">
        <ClockHistory className="text-indigo-600" size={20} />
        <h3 className="text-lg font-semibold text-gray-900">Top 100 Suchanfragen</h3>
      </div>
      
      {/* 👇 3. ANGEPASST (max-h-96 entfernt, flex-1 und min-h-0 hinzugefügt) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <ul className="divide-y divide-gray-100">
          {queries.map((query, index) => (
            <li key={`${query.query}-${index}`} className="py-3 px-2 space-y-1.5 hover:bg-gray-50 transition-colors">
              <p className="text-base font-medium text-gray-900 leading-tight">{query.query}</p>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-s text-gray-500">
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
