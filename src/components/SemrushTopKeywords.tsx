// src/components/SemrushTopKeywords.tsx (Version 8 - Bereinigtes useEffect)
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

interface SemrushTopKeywordsProps {
  projectId?: string;
}

export default function SemrushTopKeywords({ projectId }: SemrushTopKeywordsProps) {
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);
  // HINWEIS: currentProjectId entfernt, um Doppel-Fetch zu verhindern

  // formatLastFetched bleibt gleich...
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


  // GEÄNDERT: useEffect bereinigt, hängt nur noch von 'projectId' ab
  useEffect(() => {
    const fetchKeywords = async () => {
      // Setzt den Status zu Beginn jedes Fetches (oder bei projectId-Wechsel) zurück
      setIsLoading(true);
      setError(null);
      setKeywords([]);
      setLastFetched(null);
      setFromCache(false);

      try {
        // Baue die URL dynamisch
        const urlParams = new URLSearchParams();
        if (projectId) {
          urlParams.set('projectId', projectId);
        }
        
        // Wenn projectId vorhanden: /api/semrush/keywords?projectId=...
        // Sonst (für User): /api/semrush/keywords
        const url = `/api/semrush/keywords?${urlParams.toString()}`;
        
        console.log('[SemrushTopKeywords] Fetching keywords (Kampagne 1), URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();

        console.log('[SemrushTopKeywords] Received data:', {
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
          setError(data.error || null); // Zeige API-Fehler an, auch wenn alte Daten (Fallback) geladen wurden
        } else {
          setKeywords([]);
          setError('Unerwartete Antwort von der API');
        }
      } catch (err) {
        console.error('[SemrushTopKeywords] Error fetching keywords:', err);
        setError('Fehler beim Laden der Keywords');
        setKeywords([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKeywords();
  }, [projectId]); // Nur von projectId abhängig

  // getPositionChange bleibt gleich...
  const getPositionChange = (current: number, previous: number | null) => {
    if (previous === null) return null;
    return previous - current; // Positive = Verbesserung
  };

  // --- Rendering-Logik (unverändert) ---

  if (isLoading) {
    // ... (Ladezustand)
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search size={20} className="text-orange-600" />
          Top 20 Organische Keywords
        </h2>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || keywords.length === 0) {
    // GEÄNDERT: Bessere Standard-Fehlermeldung
    const defaultError = projectId 
      ? 'Keine Keywords verfügbar. Bitte warten Sie auf den ersten Datenabruf.'
      : 'Keine Semrush Tracking ID konfiguriert oder keine Keywords gefunden.';

    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search size={20} className="text-orange-600" />
          Top 20 Organische Keywords
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

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      {/* Header (unverändert) ... */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Search size={20} className="text-orange-600" />
          Top 20 Organische Keywords
        </h3>
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
              <span>
                {formatLastFetched(lastFetched)}
              </span>
            </div>
            <span className="text-[10px] text-gray-400" title={lastFetched}>
              {new Date(lastFetched).toLocaleString('de-DE')}
            </span>
          </div>
        )}
      </div>
      
      {/* DEBUG INFO (unverändert) ... */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
          <strong>Debug (K1):</strong> ProjectId: {projectId || 'none'}, Keywords: {keywords.length}
        </div>
      )}

      {/* Keywords Liste */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="space-y-2">
          {keywords.map((kw, index) => {
            const positionChange = getPositionChange(kw.position, kw.previousPosition);
            
            return (
              <div 
                // GEÄNDERT: Key angepasst
                key={`${projectId || 'user'}-${kw.keyword}-${index}`}
                className="border border-gray-100 rounded-lg p-3 hover:bg-orange-50 transition-colors"
              >
                {/* ... Restliches Mapping (unverändert) ... */}
                {/* Keyword & Position */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {kw.keyword}
                    </h4>
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
                  
                  {/* Position Badge */}
                  <div className="flex items-center gap-2 ml-3">
                    {positionChange !== null && positionChange !== 0 && (
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${
                        positionChange > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {positionChange > 0 ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )}
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

                {/* Metriken */}
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

      {/* Info (unverändert) ... */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          💡 Zeigt die Top 20 Keywords mit den besten Rankings. Daten werden alle 14 Tage aktualisiert.
        </p>
      </div>
    </div>
  );
}
