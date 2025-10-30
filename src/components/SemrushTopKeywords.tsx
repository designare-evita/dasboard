// src/components/SemrushTopKeywords.tsx
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
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);

  // Funktion um relatives Datum zu formatieren (wie bei SemrushKpiCards)
  const formatLastFetched = (dateString: string | null): string => {
    if (!dateString) return 'Nie';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays > 0) return `vor ${diffDays} Tag(en)`;
    if (diffHours > 0) return `vor ${diffHours} Stunde(n)`;
    return 'Gerade eben';
  };

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    if (!currentProjectId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      console.log('[SemrushTopKeywords] Fetching keywords, projectId:', currentProjectId);

      const url = `/api/semrush/keywords?projectId=${currentProjectId}`;
      
      try {
        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[SemrushTopKeywords] API Error:', errorData);
          setError(errorData.message || `Fehler: ${response.status}`);
        } else {
          const data = await response.json();
          console.log('[SemrushTopKeywords] Received data (raw):', data); // Zeigt die rohe Server-Antwort

          // KORREKTUR HIER: Prüfe, ob Keywords vorhanden UND mehr als 0 sind
          if (data.keywords && data.keywords.length > 0) {
            // Erfolgreich Keywords geladen
            const sortedKeywords = [...data.keywords]
              .sort((a, b) => a.position - b.position)
              .slice(0, 20);
            
            setKeywords(sortedKeywords);
            setError(data.error || null); // Zeigt Fehler an, falls alte Cache-Daten verwendet wurden
            setLastFetched(data.lastFetched || null);
            setFromCache(data.fromCache || false);
          } else {
            // Keine Keywords gefunden ODER ein Fehler ist aufgetreten
            console.log('[SemrushTopKeywords] No keywords or error received:', { 
              keywordsCount: 0, 
              projectId: currentProjectId, 
              fromCache: data.fromCache || false, 
              ...(data.error && { error: data.error }) 
            });
            setKeywords([]);
            setError(data.error || "Keine Keywords für diese Kampagne gefunden.");
            setLastFetched(data.lastFetched || null);
            setFromCache(data.fromCache || false);
          }
        }
      } catch (err) {
        console.error('[SemrushTopKeywords] Fetch Error:', err);
        setError('Daten konnten nicht geladen werden.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentProjectId]);

  // Rest des Renderings (JSX) bleibt unverändert...
  // ... (Stelle sicher, dass das error-State im JSX angezeigt wird, falls ein Fehler auftritt)

  if (isLoading) {
    return (
      <div className="p-4 rounded-lg bg-white shadow-sm animate-pulse h-64">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-gray-200 rounded w-full"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-white shadow-sm text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Top Keywords (Kampagne 1)</h3>
        <div className="p-4 rounded-md bg-red-50 text-red-700">
          <p className="font-medium">Fehler beim Laden der Keywords</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-white shadow-sm text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Top Keywords (Kampagne 1)</h3>
        <div className="p-4 rounded-md bg-gray-50 text-gray-600">
          <Search size={24} className="mx-auto mb-2 text-gray-400" />
          <p className="font-medium">Keine Keywords gefunden</p>
          <p className="text-sm">Für diese Kampagne sind keine Keyword-Daten vorhanden.</p>
        </div>
      </div>
    );
  }

  // (Der Rest der JSX-Logik zum Anzeigen der Keywords bleibt gleich)
  // ...

  return (
    <div className="p-4 rounded-lg bg-white shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Top Keywords (Kampagne 1)</h3>
        <span className={`text-xs ${fromCache ? 'text-blue-600' : 'text-gray-500'}`}>
          {formatLastFetched(lastFetched)} {fromCache ? '(Cache)' : ''}
        </span>
      </div>
      
      <div className="space-y-2">
        {keywords.map((kw) => {
          // ... (Restlicher JSX-Code für die Keyword-Liste) ...
          const posChange = kw.previousPosition ? kw.previousPosition - kw.position : 0;

          return (
            <div key={kw.keyword} className="p-3 rounded-md border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex justify-between items-start mb-2">
                {/* Keyword & URL */}
                <div className="flex-1 overflow-hidden pr-4">
                  <div className="flex items-center gap-2">
                    <a 
                      href={kw.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 hover:underline"
                      title={kw.keyword}
                    >
                      {kw.keyword}
                    </a>
                  </div>
                  <a 
                    href={kw.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-gray-500 truncate block hover:underline"
                    title={kw.url}
                  >
                    {kw.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </div>

                {/* Position & Änderung */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {posChange !== 0 && (
                    <span className={`flex items-center text-xs font-medium ${
                      posChange > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {posChange > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      {Math.abs(posChange)}
                    </span>
                  )}
                  {posChange === 0 && kw.previousPosition !== null && (
                    <span className="text-xs text-gray-400 font-medium">-</span>
                  )}
                  
                  <div className="relative">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      kw.position <= 3 ? 'bg-green-100 text-green-800' :
                      kw.position <= 10 ? 'bg-blue-100 text-blue-800' :
                      kw.position <= 20 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>\n                      #{Math.round(kw.position)}\n                    </span>
                  </div>
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

      {/* Info */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          💡 Zeigt die Top 20 Keywords mit den besten Rankings. Daten werden alle 14 Tage aktualisiert.
        </p>
      </div>
    </div>
  );
}
