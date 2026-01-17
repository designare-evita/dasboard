// src/components/charts/LandingPageChart.tsx
'use client';

import React, { useState } from 'react';
import { ConvertingPageData } from '@/lib/dashboard-shared';
import { FileEarmarkText, Search, TagFill, ChevronDown, ChevronUp } from 'react-bootstrap-icons';
import { format, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

// Typ für die Query-Daten pro Landingpage
export interface LandingPageQueries {
  [path: string]: Array<{ query: string; clicks: number; impressions: number }>;
}

interface Props {
  data?: ConvertingPageData[];
  isLoading?: boolean;
  title?: string;
  dateRange?: string;
  // NEU: Optionale Query-Daten pro Landingpage
  queryData?: LandingPageQueries;
}

export default function LandingPageChart({ 
  data, 
  isLoading, 
  title = "Top Landingpages",
  dateRange = '30d',
  queryData
}: Props) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const getDateRangeString = (range: string) => {
    const end = new Date();
    let start = subDays(end, 30); 

    switch (range) {
      case '7d': start = subDays(end, 7); break;
      case '30d': start = subDays(end, 30); break;
      case '3m': start = subMonths(end, 3); break;
      case '6m': start = subMonths(end, 6); break;
      case '12m': start = subMonths(end, 12); break;
      default: start = subDays(end, 30);
    }

    return `${format(start, 'dd.MM.yyyy', { locale: de })} - ${format(end, 'dd.MM.yyyy', { locale: de })}`;
  };

  // Toggle expanded state für eine Landingpage
  const toggleExpanded = (path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // Hole Queries für einen Pfad
  const getQueriesForPath = (path: string): Array<{ query: string; clicks: number; impressions: number }> => {
    if (!queryData) return [];
    
    // Versuche exakten Match
    if (queryData[path]) return queryData[path];
    
    // Versuche mit/ohne trailing slash
    const withSlash = path.endsWith('/') ? path : `${path}/`;
    const withoutSlash = path.endsWith('/') ? path.slice(0, -1) : path;
    
    return queryData[withSlash] || queryData[withoutSlash] || [];
  };

  if (isLoading) {
    return <div className="h-[50vh] w-full bg-gray-50 rounded-xl animate-pulse flex items-center justify-center text-gray-400">Lade Daten...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-[50vh] w-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Keine Daten verfügbar</div>;
  }

  // Daten filtern und sortieren
  const sortedData = [...data]
    .filter(item => item.newUsers !== undefined && item.newUsers !== null) 
    .filter(item => {
      const path = item.path?.toLowerCase() || '';
      
      if (path.includes('danke') || path.includes('impressum') || path.includes('datenschutz')) {
        return false;
      }
      
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        // Suche auch in Queries
        const queries = getQueriesForPath(item.path);
        const queryMatch = queries.some(q => q.query.toLowerCase().includes(searchLower));
        if (!path.includes(searchLower) && !queryMatch) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => (b.newUsers || 0) - (a.newUsers || 0))
    .slice(0, 50);

  const maxNewUsers = sortedData.length > 0 
    ? Math.max(...sortedData.map(p => p.newUsers || 0)) 
    : 0;
    
  const formattedDateRange = getDateRangeString(dateRange);

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col h-[50vh]">
      
      {/* Header Bereich */}
      <div className="mb-4 flex-shrink-0 border-b border-gray-50 pb-2">
        
        {/* Zeile 1: Titel, Sortierhinweis und Suche */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-3">
            <h3 className="text-[18px] font-semibold text-gray-900 flex items-center gap-2">
              <FileEarmarkText className="text-indigo-500" size={18} />
              {title}
            </h3>
            <span className="text-xs text-gray-400">Sortiert nach Neuen Nutzern</span>
          </div>
          
          <div className="relative">
            <input 
              type="text" 
              placeholder="Seite oder Suchbegriff..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56 text-gray-700 placeholder-gray-400"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
          </div>
        </div>
        
        {/* Zeile 2: Meta-Info und Legende */}
        <div className="ml-7 flex flex-wrap items-center justify-between gap-4 mt-1">
          
          <div className="text-[11px] text-gray-500 flex items-center gap-2">
            <span className="font-medium bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">Quelle: GA4 + GSC</span>
            <span className="text-gray-400">•</span>
            <span>{formattedDateRange}</span>
            {queryData && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-indigo-500 flex items-center gap-1">
                  <TagFill size={10} />
                  Mit Suchbegriffen
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-x-4">
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              Sessions
            </span>
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              Interaktionsrate
            </span>
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              CTR (GSC)
            </span>
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              Conversions
            </span>
          </div>
          
        </div>
      </div>

      {/* Liste */}
      {sortedData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          {searchTerm ? 'Keine Landingpages für diese Suche gefunden' : 'Keine validen Daten'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="space-y-1">
            {sortedData.map((page, i) => {
              const newUsers = page.newUsers || 0;
              const sessions = page.sessions || 0;
              const engagementRate = page.engagementRate || 0;
              const conversions = page.conversions || 0;
              const ctr = page.ctr;
              
              const barWidthPercent = maxNewUsers > 0 
                ? Math.max((newUsers / maxNewUsers) * 60, 2) 
                : 2;

              // Hole Queries für diese Seite
              const queries = getQueriesForPath(page.path);
              const hasQueries = queries.length > 0;
              const isExpanded = expandedPaths.has(page.path);
              
              // Zeige Top 3 Queries inline, Rest bei Expand
              const inlineQueries = queries.slice(0, 3);
              const additionalQueries = queries.slice(3);

              return (
                <div key={i} className="group">
                  <div 
                    className={`flex items-center gap-3 py-2 hover:bg-gray-50 rounded-lg px-2 transition-colors ${hasQueries ? 'cursor-pointer' : ''}`}
                    onClick={() => hasQueries && toggleExpanded(page.path)}
                  >
                    
                    <div className="flex-1 min-w-0">
                      {/* Pfad */}
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-[15px] font-medium text-gray-800 truncate" title={page.path}>
                          {page.path}
                        </div>
                        {hasQueries && (
                          <span className="text-gray-400 flex-shrink-0">
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </span>
                        )}
                      </div>
                      
                      {/* Inline Queries (subtil) */}
                      {hasQueries && (
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <TagFill size={10} className="text-indigo-400 flex-shrink-0" />
                          {inlineQueries.map((q, qi) => (
                            <span 
                              key={qi}
                              className="inline-flex items-center text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded"
                              title={`${q.clicks} Klicks, ${q.impressions} Impressionen`}
                            >
                              {q.query}
                              {q.clicks > 0 && (
                                <span className="ml-1 text-[9px] text-indigo-400">({q.clicks})</span>
                              )}
                            </span>
                          ))}
                          {additionalQueries.length > 0 && !isExpanded && (
                            <span className="text-[10px] text-gray-400">
                              +{additionalQueries.length} weitere
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Balken */}
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${barWidthPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Metriken */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-md text-[12px] font-semibold whitespace-nowrap min-w-[140px] text-center shadow-sm">
                        {newUsers.toLocaleString()} Neue Besucher
                      </div>
                      <div className="bg-sky-500 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[75px] text-center shadow-sm">
                        {sessions.toLocaleString()} Sess.
                      </div>
                      <div className="bg-teal-500 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[70px] text-center shadow-sm">
                        {engagementRate.toFixed(0)}% Rate
                      </div>
                      <div className="bg-amber-500 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[65px] text-center shadow-sm">
                        {ctr !== undefined ? `${ctr.toFixed(1)}% CTR` : '– CTR'}
                      </div>
                      <div className="bg-slate-400 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[65px] text-center shadow-sm">
                        {conversions} Conv.
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Alle Queries anzeigen */}
                  {isExpanded && additionalQueries.length > 0 && (
                    <div className="ml-4 pl-4 border-l-2 border-indigo-100 py-2 mb-2">
                      <div className="text-[10px] text-gray-500 mb-1.5">Weitere Suchbegriffe:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {additionalQueries.map((q, qi) => (
                          <span 
                            key={qi}
                            className="inline-flex items-center text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded"
                            title={`${q.clicks} Klicks, ${q.impressions} Impressionen`}
                          >
                            {q.query}
                            {q.clicks > 0 && (
                              <span className="ml-1 text-[9px] text-indigo-400">({q.clicks})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
