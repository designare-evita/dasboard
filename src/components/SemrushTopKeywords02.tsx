// src/components/SemrushTopKeywords02.tsx (Version 5 - Korrigiert mit expliziter Kampagne)
'use client';

import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Search } from 'react-bootstrap-icons';

interface KeywordData {
  keyword: string;
  position: number;
  previousPosition: number | null;
  searchVolume: number;
  trafficPercent: number;
  url: string;
}

interface SemrushTopKeywords02Props {
  projectId?: string | null;
}

export default function SemrushTopKeywords02({ projectId }: SemrushTopKeywords02Props) {
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);

  const formatLastFetched = (dateString: string | null): string => {
    if (!dateString) return 'Nie';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffDays === 0) return diffHours === 0 ? 'Gerade eben' : `Heute (vor ${diffHours}h)`;
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 14) return `vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  useEffect(() => {
    const fetchKeywords = async () => {
      setIsLoading(true);
      setError(null);
      setKeywords([]);
      setLastFetched(null);
      setFromCache(false);

      try {
        // ✅ KORREKTUR: Explizite Kampagnen-Übergabe
        const urlParams = new URLSearchParams();
        
        // 1. Explizit Kampagne 2 anfordern
        urlParams.set('campaign', 'kampagne_2');

        // 2. Projekt-Kontext (falls vorhanden)
        if (projectId) {
          urlParams.set('projectId', projectId);
        }

        const url = `/api/semrush/keywords?${urlParams.toString()}`;
        
        console.log('[SemrushTopKeywords02] Fetching keywords (Kampagne 2), URL:', url);
        console.log('[SemrushTopKeywords02] Campaign Parameter: kampagne_2');
        console.log('[SemrushTopKeywords02] Project ID:', projectId || 'none (eigene Daten)');

        const response = await fetch(url);
        const data = await response.json();

        console.log('[SemrushTopKeywords02] Received data:', {
          keywordsCount: data.keywords?.length || 0,
          projectId: projectId,
          fromCache: data.fromCache,
          error: data.error
        });

        if (data.error && !data.keywords?.length) {
          setError(data.error);
          setKeywords([]);
        } else if (data.keywords) {
          setKeywords(data.keywords);
          setLastFetched(data.lastFetched);
          setFromCache(data.fromCache || false);
          setError(data.error || null);
        } else {
          setKeywords([]);
          setError('Unerwartete Antwort von der API');
        }
      } catch (err) {
        console.error('[SemrushTopKeywords02] Error fetching keywords:', err);
        setError('Fehler beim Laden der Keywords (Kampagne 2)');
        setKeywords([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchKeywords();
  }, [projectId]);

  const getPositionChange = (current: number, previous: number | null) => {
    if (previous === null) return null;
    return previous - current;
  };

  // Ladezustand
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search size={20} className="text-orange-600" />
          Top 20 Keywords - USA
        </h2>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Fehler oder keine Keywords
  if (error || keywords.length === 0) {
    const defaultError = projectId
      ? 'Keine Keywords verfügbar. Bitte warten Sie auf den ersten Datenabruf.'
      : 'Keine Semrush Tracking ID (Kampagne 2) konfiguriert oder keine Keywords gefunden.';

    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search size={20} className="text-orange-600" />
          Top 20 Keywords - USA
        </h3>
        <p className="text-sm text-gray-500 italic">
          {error || defaultError}
        </p>
        {lastFetched && !isLoading && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 flex flex-col items-start gap-1">
            Letzter Versuch: {formatLastFetched(lastFetched)}
            <span className="text-[10px] text-gray-400">
              ({new Date(lastFetched).toLocaleString('de-DE')})
            </span>
          </div>
        )}
      </div>
    );
  }

  // Erfolgreiche Anzeige
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Search size={20} className="text-orange-600" />
          Top 20 Keywords - USA
        </h3>
        {lastFetched && (
          <div className="text-xs text-gray-500 flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                fromCache ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
              }`}>
                {fromCache ? 'Cache' : 'Live'}
              </span>
              <span>{formatLastFetched(lastFetched)}</span>
            </div>
            <span className="text-[10px] text-gray-400" title={lastFetched}>
              {new Date(lastFetched).toLocaleString('de-DE')}
            </span>
          </div>
        )}
      </div>

      {/* DEBUG INFO */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-3 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs">
          <strong>Debug (Kampagne 2):</strong> 
          <br />ProjectId: {projectId || 'none (User)'}, 
          <br />Keywords: {keywords.length},
          <br />Campaign: kampagne_2
        </div>
      )}

      {/* Keywords Liste */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="space-y-2">
          {keywords.map((kw, index) => {
            const positionChange = getPositionChange(kw.position, kw.previousPosition);
            return (
              <div 
                key={`kampagne-2-${projectId || 'user'}-${kw.keyword}-${index}`}
                className="border border-gray-100 rounded-lg p-3 hover:bg-orange-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">{kw.keyword}</h4>
                    {kw.url && (
                      <a 
                        href={kw.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate block"
                      >
                        {kw.url.length > 50 ? kw.url.substring(0, 50) + '...' : kw.url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {positionChange !== null && positionChange !== 0 && (
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${
                        positionChange > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {positionChange > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {Math.abs(positionChange)}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      kw.position <= 3 ? 'bg-green-100 text-green-800' :
                      kw.position <= 10 ? 'bg-blue-100 text-blue-800' :
                      kw.position <= 20 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      #{Math.round(kw.position)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Suchvolumen:</span>
                    <span className="font-medium text-gray-900">
                      {kw.searchVolume.toLocaleString('de-DE')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Traffic:</span>
                    <span className="font-medium text-gray-900">
                      {kw.trafficPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          💡 Zeigt die Top 20 Keywords mit den besten Rankings. Daten werden alle 14 Tage aktualisiert.
        </p>
      </div>
    </div>
  );
}
