// src/components/TopQueriesList.tsx
'use client';

import React, { useState } from 'react';
import { ClockHistory, FunnelFill, ExclamationTriangleFill, Search, X } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';
import { type DateRangeOption, getRangeLabel } from '@/components/DateRangeSelector';

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
  className?: string;
  dateRange?: DateRangeOption;
  error?: string | null;
}

export default function TopQueriesList({
  queries,
  isLoading = false,
  className,
  dateRange,
  error = null
}: TopQueriesListProps) {
  const [sortField, setSortField] = useState<keyof TopQueryData | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState(''); // NEU: Such-State

  const rangeLabel = dateRange ? getRangeLabel(dateRange) : null;

  const handleSort = (field: keyof TopQueryData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter- und Sortierlogik
  const displayedQueries = React.useMemo(() => {
    let data = queries || [];

    // 1. Filtern
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      data = data.filter(q => q.query.toLowerCase().includes(lowerTerm));
    }

    // 2. Sortieren
    if (!sortField) return data;
    
    return [...data].sort((a, b) => {
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
  }, [queries, sortField, sortDirection, searchTerm]);

  // Ladezustand
  if (isLoading) {
    return (
      // Wenn card-glass global verfügbar ist, nutze es, sonst Standard
      <div className={cn("bg-white rounded-lg shadow-md border border-gray-200 card-glass", className)}>
        <div className="p-4 bg-[#188BDB] rounded-t-lg">
          <div className="flex items-center gap-2 text-white">
            <ClockHistory size={20} />
            <h3 className="text-lg font-semibold">Top 100 Suchanfragen</h3>
          </div>
        </div>
        <div className="p-6 animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Fehlerzustand
  if (error) {
    return (
      <div className={cn("bg-white rounded-lg shadow-md border border-gray-200 card-glass", className)}>
        <div className="p-4 bg-[#188BDB] rounded-t-lg">
          <div className="flex items-center gap-2 text-white">
            <ClockHistory size={20} />
            <h3 className="text-lg font-semibold">Top 100 Suchanfragen</h3>
          </div>
        </div>
        <div className="p-6 text-center text-sm text-red-700 flex flex-col items-center gap-2 min-h-[200px] justify-center">
          <ExclamationTriangleFill className="text-red-500 w-6 h-6" />
          <span className="font-semibold">Fehler bei GSC-Daten</span>
          <p className="text-xs text-gray-500" title={error}>
            Die Suchanfragen konnten nicht geladen werden.
          </p>
        </div>
      </div>
    );
  }

  // Haupt-Komponente
  return (
    <div className={cn("bg-white rounded-lg shadow-md border border-gray-200 flex flex-col card-glass", className)}>
      
      {/* Header Card */}
      <div className="p-4 bg-[#188BDB] rounded-t-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Titel */}
        <div className="flex items-center gap-2">
          <ClockHistory className="text-white" size={20} />
          <h3 className="text-lg font-semibold text-white">Top 100 Suchanfragen</h3>
          {rangeLabel && (
             <span className="text-xs text-white/90 bg-black/10 px-2 py-0.5 rounded-full ml-2 hidden sm:inline-block">
               {rangeLabel}
             </span>
           )}
        </div>

        {/* Suche & Counter */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Suchfeld */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/70" size={14} />
            <input 
              type="text" 
              placeholder="Suchen..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-48 bg-white/20 text-white placeholder-white/70 text-sm rounded-full py-1.5 pl-8 pr-8 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="text-xs text-white/80 whitespace-nowrap hidden sm:block">
            {displayedQueries.length} {displayedQueries.length === 1 ? 'Eintrag' : 'Einträge'}
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto flex-grow">
        {displayedQueries.length === 0 ? (
           <div className="p-8 text-center text-sm text-gray-500 italic min-h-[200px] flex flex-col items-center justify-center">
             <Search className="text-gray-300 mb-2" size={32} />
             {searchTerm ? `Keine Ergebnisse für "${searchTerm}"` : 'Keine Suchanfragen gefunden.'}
           </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#188BDB] text-white">
                  <th 
                    onClick={() => handleSort('query')}
                    className="px-4 py-3 text-left text-sm font-semibold border-r border-white/20 cursor-pointer hover:bg-[#1479BF] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Suchanfrage
                      <FunnelFill size={12} className="opacity-60" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('clicks')}
                    className="px-4 py-3 text-right text-sm font-semibold border-r border-white/20 cursor-pointer hover:bg-[#1479BF] transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-2">
                      Klicks
                      <FunnelFill size={12} className="opacity-60" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('impressions')}
                    className="px-4 py-3 text-right text-sm font-semibold border-r border-white/20 cursor-pointer hover:bg-[#1479BF] transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-2">
                      Impr.
                      <FunnelFill size={12} className="opacity-60" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('ctr')}
                    className="px-4 py-3 text-right text-sm font-semibold border-r border-white/20 cursor-pointer hover:bg-[#1479BF] transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-2">
                      CTR
                      <FunnelFill size={12} className="opacity-60" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('position')}
                    className="px-4 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-[#1479BF] transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-2">
                      Pos.
                      <FunnelFill size={12} className="opacity-60" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedQueries.map((query, index) => (
                  <tr 
                    key={`${query.query}-${index}`}
                    className={cn(
                      "border-b border-gray-200 hover:bg-blue-50 transition-colors",
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    )}
                  >
                    {/* Suchanfrage */}
                    <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                      <div className="break-words max-w-md font-medium">
                        {query.query}
                      </div>
                    </td>
                    
                    {/* Klicks */}
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-200 whitespace-nowrap">
                      {query.clicks.toLocaleString('de-DE')}
                    </td>
                    
                    {/* Impressionen */}
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-200 whitespace-nowrap">
                      {query.impressions.toLocaleString('de-DE')}
                    </td>
                    
                    {/* CTR */}
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-200 whitespace-nowrap">
                      {(query.ctr * 100).toFixed(1)}%
                    </td>
                    
                    {/* Position */}
                    <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold w-12 justify-center",
                        query.position <= 3 ? "bg-green-100 text-green-800" :
                        query.position <= 10 ? "bg-blue-100 text-blue-800" :
                        query.position <= 20 ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {query.position.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span>
              ∑ Klicks: <span className="font-semibold text-gray-900">
                {displayedQueries.reduce((sum, q) => sum + q.clicks, 0).toLocaleString('de-DE')}
              </span>
            </span>
            <span>
              ∑ Impressionen: <span className="font-semibold text-gray-900">
                {displayedQueries.reduce((sum, q) => sum + q.impressions, 0).toLocaleString('de-DE')}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
