// src/components/SemrushTopKeywords02.tsx
'use client';

import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Search } from 'react-bootstrap-icons';

// Interface bleibt gleich
interface KeywordData {
  keyword: string;
  position: number;
  previousPosition: number | null;
  searchVolume: number;
  trafficPercent: number;
  url: string;
}

// Props angepasst: Erwartet trackingId
interface SemrushTopKeywords02Props {
  trackingId?: string | null; // ID für die zweite Kampagne
}

export default function SemrushTopKeywords02({ trackingId }: SemrushTopKeywords02Props) {
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);
  const [currentTrackingId, setCurrentTrackingId] = useState<string | null | undefined>(trackingId);

  // formatLastFetched bleibt gleich
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
    // Reset State bei trackingId-Änderung
    if (trackingId !== currentTrackingId) {
      console.log('[SemrushTopKeywords02] TrackingId changed from', currentTrackingId, 'to', trackingId);
      setKeywords([]);
      setError(null);
      setLastFetched(null);
      setCurrentTrackingId(trackingId);
      setIsLoading(!!trackingId); // Ladezustand nur starten, wenn eine ID vorhanden ist
    }

    // Funktion zum Abrufen der Keywords
    const fetchKeywords = async () => {
      // Nur fetchen, wenn eine trackingId vorhanden ist
      if (!trackingId) {
          console.log('[SemrushTopKeywords02] No trackingId provided, skipping fetch.');
          setIsLoading(false);
          setKeywords([]);
          setError('Keine Tracking-ID (Kampagne 2) konfiguriert.');
          return;
      }

      setIsLoading(true); // Sicherstellen, dass der Ladezustand aktiv ist

      try {
        // API-URL angepasst: Verwendet trackingId
        const url = `/api/semrush/keywords?trackingId=${trackingId}`;
        console.log('[SemrushTopKeywords02] Fetching keywords, trackingId:', trackingId);

        const response = await fetch(url);
        const data = await response.json();

        console.log('[SemrushTopKeywords02] Received data:', {
          keywordsCount: data.keywords?.length || 0,
          trackingId: trackingId,
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
    
    // Fetch auslösen, wenn sich ID ändert oder initial geladen wird
    if (trackingId !== currentTrackingId || (trackingId && keywords.length === 0 && !error && isLoading)) {
        fetchKeywords();
    } else if (!trackingId && currentTrackingId) {
        fetchKeywords(); // ID wurde entfernt -> State clearen
    }

  }, [trackingId, currentTrackingId, keywords.length, error, isLoading]); // Abhängigkeiten angepasst

  // getPositionChange bleibt gleich
  const getPositionChange = (current: number, previous: number | null) => {
    if (previous === null) return null;
    return previous - current; // Positive = Verbesserung
  };

  // --- Rendering Logik ---

  // Ladezustand
  if (isLoading && keywords.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search size={20} className="text-orange-600" />
          Top 20 Keywords (Kampagne 2) {/* Titel angepasst */}
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
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Search size={20} className="text-orange-600" />
          Top 20 Keywords (Kampagne 2) {/* Titel angepasst */}
        </h3>
        <p className="text-sm text-gray-500 italic">
          {error || (trackingId ? 'Keine Keywords verfügbar. Bitte warten Sie auf den ersten Datenabruf.' : 'Keine Tracking-ID (Kampagne 2) konfiguriert.')}
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

  // Erfolgreiche Anzeige der Keywords
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Search size={20} className="text-orange-600" />
          Top 20 Keywords (Kampagne 2) {/* Titel angepasst */}
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

      {/* Keywords Liste (unverändert) */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="space-y-2">
          {keywords.map((kw, index) => {
            const positionChange = getPositionChange(kw.position, kw.previousPosition);
            return (
              <div key={`${trackingId}-${kw.keyword}-${index}`} className="border border-gray-100 rounded-lg p-3 hover:bg-orange-50 transition-colors">
                {/* Keyword & Position */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">{kw.keyword}</h4>
                    {kw.url && (
                      <a href={kw.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                        {kw.url.length > 50 ? kw.url.substring(0, 50) + '...' : kw.url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {positionChange !== null && positionChange !== 0 && (
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${positionChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                {/* Metriken */}
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Suchvolumen:</span>
                    <span className="font-medium text-gray-900">{kw.searchVolume.toLocaleString('de-DE')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Traffic:</span>
                    <span className="font-medium text-gray-900">{kw.trafficPercent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Info (unverändert) */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          💡 Zeigt die Top 20 Keywords mit den besten Rankings. Daten werden alle 14 Tage aktualisiert.
        </p>
      </div>
    </div>
  );
}
