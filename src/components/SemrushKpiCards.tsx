// src/components/SemrushKpiCards.tsx (mit Debug-Timestamp)
'use client';

import { ArrowUp, ArrowDown, Database } from 'react-bootstrap-icons';

export interface SemrushData {
  organicKeywords: number | null;
  organicTraffic: number | null;
  lastFetched: string | null;
  fromCache?: boolean;
}

interface SemrushKpiCardsProps {
  data: SemrushData | null;
  isLoading?: boolean;
}

export default function SemrushKpiCards({ data, isLoading = false }: SemrushKpiCardsProps) {
  
  // Funktion um relatives Datum zu formatieren (MIT DETAILLIERTEM DEBUG)
  const formatLastFetched = (dateString: string | null): string => {
    if (!dateString) return 'Nie';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    // DEBUG: Log zum Überprüfen
    console.log('[SemrushKpiCards] lastFetched:', dateString);
    console.log('[SemrushKpiCards] diffDays:', diffDays, 'diffHours:', diffHours);
    
    if (diffDays === 0) {
      // Zeige auch Stunden wenn "heute"
      if (diffHours === 0) {
        return 'Gerade eben';
      } else {
        return `Heute (vor ${diffHours}h)`;
      }
    } else if (diffDays === 1) {
      return 'Gestern';
    } else if (diffDays < 14) {
      return `vor ${diffDays} Tagen`;
    } else {
      // Formatiere als deutsches Datum
      return date.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
  };

  // Zeige Hinweis wenn keine Semrush-Konfiguration vorhanden ist
  if (!isLoading && (!data || (data.organicKeywords === null && data.organicTraffic === null))) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Database size={20} className="text-orange-600" />
          Semrush Übersicht
        </h3>
        <p className="text-sm text-gray-500 italic">
          Keine Semrush-Daten verfügbar. Bitte Domain oder Semrush Project ID konfigurieren.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      {/* Header mit Titel und letztem Update */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Database size={20} className="text-orange-600" />
          Semrush Übersicht
        </h3>
        {data?.lastFetched && (
          <div className="text-xs text-gray-500 flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              {/* DEBUG: Immer zeigen */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                data.fromCache 
                  ? 'bg-gray-100 text-gray-600' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {data.fromCache ? 'Cache' : 'Live'}
              </span>
              <span>
                {formatLastFetched(data.lastFetched)}
              </span>
            </div>
            {/* DEBUG: Zeige exakten Timestamp */}
            <span className="text-[10px] text-gray-400" title={data.lastFetched}>
              {new Date(data.lastFetched).toLocaleString('de-DE')}
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Organic Keywords Card */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-orange-900">Organische Keywords</h4>
            {!isLoading && data?.organicKeywords !== null && data?.organicKeywords !== undefined && (
              <ArrowUp className="text-orange-600" size={16} />
            )}
          </div>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-orange-200 rounded w-24"></div>
            </div>
          ) : (
            <p className="text-2xl font-bold text-orange-900">
              {data?.organicKeywords !== null && data?.organicKeywords !== undefined
                ? data.organicKeywords.toLocaleString('de-DE')
                : '-'
              }
            </p>
          )}
          <p className="text-xs text-orange-700 mt-1">
            Keywords in den Top 100
          </p>
        </div>

        {/* Organic Traffic Card */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-orange-900">Organischer Traffic</h4>
            {!isLoading && data?.organicTraffic !== null && data?.organicTraffic !== undefined && (
              <ArrowUp className="text-orange-600" size={16} />
            )}
          </div>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-orange-200 rounded w-24"></div>
            </div>
          ) : (
            <p className="text-2xl font-bold text-orange-900">
              {data?.organicTraffic !== null && data?.organicTraffic !== undefined
                ? data.organicTraffic.toLocaleString('de-DE')
                : '-'
              }
            </p>
          )}
          <p className="text-xs text-orange-700 mt-1">
            Geschätzte monatliche Besucher
          </p>
        </div>
      </div>

      {/* Info-Text über Cache-Dauer */}
      {!isLoading && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            💡 Semrush-Daten werden alle 14 Tage automatisch aktualisiert, um API-Limits zu schonen.
          </p>
        </div>
      )}
    </div>
  );
}
