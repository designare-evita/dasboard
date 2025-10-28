// src/components/SemrushKeywordTable.tsx
'use client';

import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowRight, Search } from 'react-bootstrap-icons';

interface KeywordData {
  keyword: string;
  position: number;
  previousPosition: number | null;
  searchVolume: number;
  cpc: number;
  url: string;
  trafficPercent: number;
  costs: number;
  numberOfResults: number;
  trends: number[];
}

interface SemrushKeywordTableProps {
  projectId?: string;
}

export default function SemrushKeywordTable({ projectId }: SemrushKeywordTableProps) {
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);

  // Formatiere Zeitstempel
  const formatLastFetched = (dateString: string | null): string => {
    if (!dateString) return 'Nie';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays === 0) {
      if (diffHours === 0) return 'Gerade eben';
      else return `Heute (vor ${diffHours}h)`;
    } else if (diffDays === 1) {
      return 'Gestern';
    } else if (diffDays < 14) {
      return `vor ${diffDays} Tagen`;
    } else {
      return date.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
  };

  useEffect(() => {
    // Reset State bei projectId-Änderung
    if (projectId !== currentProjectId) {
      setKeywords([]);
      setError(null);
      setLastFetched(null);
      setCurrentProjectId(projectId);
    }

    const fetchKeywords = async () => {
      try {
        setIsLoading(true);
        
        const url = projectId 
          ? `/api/semrush/keywords?projectId=${projectId}`
          : '/api/semrush/keywords';
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.keywords) {
          setKeywords(data.keywords);
          setLastFetched(data.lastFetched);
          setFromCache(data.fromCache || false);
          setError(null);
        } else {
          setKeywords([]);
        }
      } catch (err) {
        console.error('[SemrushKeywordTable] Error:', err);
        setError('Fehler beim Laden der Keywords');
        setKeywords([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKeywords();
  }, [projectId, currentProjectId]);

  // Berechne Positions-Änderung
  const getPositionChange = (current: number, previous: number | null) => {
    if (previous === null) return null;
    return previous - current; // Positive = Verbesserung
  };

  // Render Position Change mit Icon
  const renderPositionChange = (change: number | null) => {
    if (change === null) return <span className="text-gray-400">–</span>;
    if (change === 0) return <span className="text-gray-500">0</span>;
    
    const isImprovement = change > 0;
    return (
      <span className={`flex items-center gap-1 font-medium ${
        isImprovement ? 'text-green-600' : 'text-red-600'
      }`}>
        {isImprovement ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        {Math.abs(change)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Search size={20} className="text-orange-600" />
            SEMRUSH Keyword Rankings
          </h2>
          <div className="animate-pulse space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || keywords.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search size={20} className="text-orange-600" />
          SEMRUSH Keyword Rankings
        </h2>
        <p className="text-sm text-gray-500 italic">
          {error || 'Keine Keywords verfügbar. Bitte konfigurieren Sie Semrush oder warten Sie auf den ersten Datenabruf.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-gray-200">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Search size={20} className="text-orange-600" />
            SEMRUSH Keyword Rankings
          </h2>
          {lastFetched && (
            <div className="text-xs text-gray-500 flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  fromCache 
                    ? 'bg-gray-100 text-gray-600' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {fromCache ? 'Cache' : 'Live'}
                </span>
                <span>{formatLastFetched(lastFetched)}</span>
              </div>
              <span className="text-[10px] text-gray-400">
                {new Date(lastFetched).toLocaleString('de-DE')}
              </span>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Top {keywords.length} Keywords · Rankings werden alle 14 Tage aktualisiert
        </p>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Keyword
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Änderung
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Suchvolumen
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Traffic %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                URL
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {keywords.map((kw, index) => {
              const positionChange = getPositionChange(kw.position, kw.previousPosition);
              const positionRounded = Math.round(kw.position);
              
              return (
                <tr 
                  key={`${projectId}-${kw.keyword}-${index}`}
                  className="hover:bg-orange-50 transition-colors"
                >
                  {/* # */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {index + 1}
                  </td>

                  {/* Keyword */}
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium text-gray-900">{kw.keyword}</div>
                  </td>

                  {/* Position */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold ${
                      positionRounded <= 3 ? 'bg-green-100 text-green-800' :
                      positionRounded <= 10 ? 'bg-blue-100 text-blue-800' :
                      positionRounded <= 20 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {positionRounded}
                    </span>
                  </td>

                  {/* Änderung */}
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    {renderPositionChange(positionChange)}
                  </td>

                  {/* Suchvolumen */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {kw.searchVolume.toLocaleString('de-DE')}
                  </td>

                  {/* Traffic % */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <span className="font-medium text-orange-600">
                      {kw.trafficPercent.toFixed(1)}%
                    </span>
                  </td>

                  {/* URL */}
                  <td className="px-6 py-4 text-sm">
                    {kw.url ? (
                      <a 
                        href={kw.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline truncate block max-w-xs"
                        title={kw.url}
                      >
                        {kw.url.replace(/^https?:\/\//, '').substring(0, 40)}
                        {kw.url.length > 40 ? '...' : ''}
                      </a>
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          💡 Zeigt die wichtigsten Keywords mit ihren aktuellen Rankings. 
          Grün = Top 3, Blau = Top 10, Orange = Top 20
        </p>
      </div>
    </div>
  );
}
