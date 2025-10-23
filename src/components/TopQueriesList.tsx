// src/components/TopQueriesList.tsx
import React from 'react';
import { ClockHistory } from 'react-bootstrap-icons';

// Typ-Definition (kannst du ggf. zentralisieren)
type TopQueryData = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

interface TopQueriesListProps {
  queries: TopQueryData[];
  isLoading?: boolean; // Optional: Ladezustand anzeigen
}

export default function TopQueriesList({ queries, isLoading = false }: TopQueriesListProps) {
  if (isLoading) {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800">
                <ClockHistory size={20} />
                Top 100 Suchanfragen
            </h3>
            <div className="border rounded-lg max-h-96 overflow-y-auto p-4 text-center text-gray-500">
                Lade Daten...
            </div>
        </div>
    );
  }

  if (!queries || queries.length === 0) {
     return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800">
                <ClockHistory size={20} />
                Top 100 Suchanfragen
            </h3>
            <div className="border rounded-lg max-h-96 overflow-y-auto p-4 text-center text-gray-500 italic">
                Keine Suchanfragen gefunden.
            </div>
        </div>
     );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800">
        <ClockHistory size={20} />
        Top 100 Suchanfragen
      </h3>
      <div className="border rounded-lg max-h-96 overflow-y-auto">
        <ul className="divide-y divide-gray-100">
          {queries.map((query, index) => (
            <li key={`${query.query}-${index}`} className="p-4 space-y-2 hover:bg-gray-50">
              <p className="text-base font-medium text-gray-900">{query.query}</p>
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
  );
}
