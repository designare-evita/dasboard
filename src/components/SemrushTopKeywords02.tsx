// src/components/SemrushTopKeywords02.tsx (Version 8 - Excel-Design)
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, Search, FunnelFill } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';

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
  const [sortField, setSortField] = useState<keyof KeywordData | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const formatLastFetched = (dateString: string | null): string => {
    if (!dateString) return 'Nie';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 5) return 'Gerade eben';
    if (diffHours === 0) return `vor ${diffMinutes} Minuten`;
    if (diffDays === 0) return `Heute (vor ${diffHours}h)`;
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 14) return `vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Sortier-Handler
  const handleSort = (field: keyof KeywordData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'position' ? 'asc' : 'desc');
    }
  };

  // Sortierte Keywords
  const sortedKeywords = useMemo(() => {
    if (!sortField) return keywords;
    
    return [...keywords].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });
  }, [keywords, sortField, sortDirection]);

  useEffect(() => {
    const fetchKeywords = async () => {
      setIsLoading(true);
      setError(null);
      setKeywords([]);
      setLastFetched(null);
      setFromCache(false);

      try {
        const urlParams = new URLSearchParams();
        urlParams.set('campaign', 'kampagne_2');

        if (projectId) {
          urlParams.set('projectId', projectId);
        }

        const url = `/api/semrush/keywords?${urlParams.toString()}`;
        
        console.log('[SemrushTopKeywords02] Fetching keywords (Kampagne 2), URL:', url);

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
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-500 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Search className="text-white" size={20} />
            <h3 className="text-lg font-semibold text-white">Top 20 Keywords - USA</h3>
          </div>
        </div>
        <div className="p-6 animate-pulse space-y-3">
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
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-500 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Search className="text-white" size={20} />
            <h3 className="text-lg font-semibold text-white">Top 20 Keywords - USA</h3>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 italic">{error || defaultError}</p>
          {lastFetched && !isLoading && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 flex flex-col items-start gap-1">
              Letzter Versuch: {formatLastFetched(lastFetched)}
              <span className="text-[10px] text-gray-400">
                ({new Date(lastFetched).toLocaleString('de-DE')})
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Hauptansicht mit Tabelle
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-500 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="text-white" size={20} />
            <h3 className="text-lg font-semibold text-white">Top 20 Keywords - USA</h3>
          </div>
          <div className="flex items-center gap-3">
            {lastFetched && (
              <div className="text-xs text-purple-100 flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    fromCache ? 'bg-white/20 text-white' : 'bg-green-500 text-white'
                  )}>
                    {fromCache ? 'Cache' : 'Live'}
                  </span>
                  <span className="whitespace-nowrap">{formatLastFetched(lastFetched)}</span>
                </div>
                <span className="text-[10px] text-purple-50 opacity-75" title={lastFetched}>
                  {new Date(lastFetched).toLocaleString('de-DE')}
                </span>
              </div>
            )}
            <div className="text-xs text-purple-100 whitespace-nowrap">
              {keywords.length} {keywords.length === 1 ? 'Keyword' : 'Keywords'}
            </div>
          </div>
        </div>
      </div>

      {/* DEBUG INFO */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mx-4 mt-4 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs">
          <strong>Debug (Kampagne 2):</strong> 
          <br />ProjectId: {projectId || 'none (User)'}, 
          <br />Keywords: {keywords.length},
          <br />Campaign: kampagne_2
        </div>
      )}

      {/* Tabelle */}
      <div className="overflow-x-auto">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-purple-600 text-white">
                <th 
                  onClick={() => handleSort('keyword')}
                  className="px-4 py-3 text-left text-sm font-semibold border-r border-purple-500 cursor-pointer hover:bg-purple-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Keyword
                    <FunnelFill size={12} className="opacity-60" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('position')}
                  className="px-4 py-3 text-right text-sm font-semibold border-r border-purple-500 cursor-pointer hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-2">
                    Position
                    <FunnelFill size={12} className="opacity-60" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold border-r border-purple-500 whitespace-nowrap">
                  Änderung
                </th>
                <th 
                  onClick={() => handleSort('searchVolume')}
                  className="px-4 py-3 text-right text-sm font-semibold border-r border-purple-500 cursor-pointer hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-2">
                    Suchvolumen
                    <FunnelFill size={12} className="opacity-60" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('trafficPercent')}
                  className="px-4 py-3 text-right text-sm font-semibold border-r border-purple-500 cursor-pointer hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-2">
                    Traffic %
                    <FunnelFill size={12} className="opacity-60" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                  URL
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedKeywords.map((kw, index) => {
                const positionChange = getPositionChange(kw.position, kw.previousPosition);
                
                return (
                  <tr 
                    key={`kampagne-2-${projectId || 'user'}-${kw.keyword}-${index}`}
                    className={cn(
                      "border-b border-gray-200 hover:bg-purple-50 transition-colors",
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    )}
                  >
                    {/* Keyword */}
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium border-r border-gray-200">
                      <div className="break-words max-w-xs">
                        {kw.keyword}
                      </div>
                    </td>
                    
                    {/* Position */}
                    <td className="px-4 py-3 text-sm text-right border-r border-gray-200 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold",
                        kw.position <= 3 ? "bg-green-100 text-green-800" :
                        kw.position <= 10 ? "bg-blue-100 text-blue-800" :
                        kw.position <= 20 ? "bg-orange-100 text-orange-800" :
                        "bg-gray-100 text-gray-800"
                      )}>
                        #{Math.round(kw.position)}
                      </span>
                    </td>
                    
                    {/* Änderung */}
                    <td className="px-4 py-3 text-sm text-center border-r border-gray-200 whitespace-nowrap">
                      {positionChange !== null && positionChange !== 0 ? (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-semibold",
                          positionChange > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {positionChange > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          {Math.abs(positionChange)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    
                    {/* Suchvolumen */}
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium border-r border-gray-200 whitespace-nowrap">
                      {kw.searchVolume.toLocaleString('de-DE')}
                    </td>
                    
                    {/* Traffic % */}
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium border-r border-gray-200 whitespace-nowrap">
                      {kw.trafficPercent.toFixed(1)}%
                    </td>
                    
                    {/* URL */}
                    <td className="px-4 py-3 text-sm border-r-0">
                      {kw.url ? (
                        <a 
                          href={kw.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate block max-w-xs text-xs"
                          title={kw.url}
                        >
                          {kw.url.length > 40 ? kw.url.substring(0, 40) + '...' : kw.url}
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span>
              Ø Position: <span className="font-semibold text-gray-900">
                {(sortedKeywords.reduce((sum, k) => sum + k.position, 0) / sortedKeywords.length).toFixed(1)}
              </span>
            </span>
            <span>
              Gesamt Traffic: <span className="font-semibold text-gray-900">
                {sortedKeywords.reduce((sum, k) => sum + k.trafficPercent, 0).toFixed(1)}%
              </span>
            </span>
          </div>
          <div className="text-gray-500 italic">
            💡 Klicken Sie auf die Spaltenüberschriften zum Sortieren
          </div>
        </div>
      </div>
    </div>
  );
}
