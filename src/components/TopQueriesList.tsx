// src/components/TopQueriesList.tsx
'use client';

import React, { useState } from 'react';
import { ClockHistory, FunnelFill, ExclamationTriangleFill } from 'react-bootstrap-icons';
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

  const rangeLabel = dateRange ? getRangeLabel(dateRange) : null;

  const handleSort = (field: keyof TopQueryData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedQueries = React.useMemo(() => {
    if (!sortField) return queries;
    
    return [...queries].sort((a, b) => {
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
  }, [queries, sortField, sortDirection]);

  // Ladezustand
  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-lg shadow-md border border-gray-200", className)}>
        <div className="p-4 bg-[#188BDB] rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClockHistory className="text-white" size={20} />
              <h3 className="text-lg font-semibold text-white">Top 100 Suchanfragen</h3>
            </div>
            {rangeLabel && (
              <span className="text-xs text-white/90 bg-black/10 px-2 py-0.5 rounded-full">
                {rangeLabel}
              </span>
            )}
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
      <div className={cn("bg-white rounded-lg shadow-md border border-gray-200", className)}>
        <div className="p-4 bg-[#188BDB] rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClockHistory className="text-white" size={20} />
              <h3 className="text-lg font-semibold text-white">Top 100 Suchanfragen</h3>
            </div>
            {rangeLabel && (
              <span className="text-xs text-white/90 bg-black/10 px-2 py-0.5 rounded-full">
                {rangeLabel}
              </span>
            )}
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

  // Leer-Zustand
  if (!queries || queries.length === 0) {
    return (
      <div className={cn("bg-white rounded-lg shadow-md border border-gray-200", className)}>
        <div className="p-4 bg-[#188BDB] rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClockHistory className="text-white" size={20} />
              <h3 className="text-lg font-semibold text-white">Top 100 Suchanfragen</h3>
            </div>
            {rangeLabel && (
              <span className="text-xs text-white/90 bg-black/10 px-2 py-0.5 rounded-full">
                {rangeLabel}
              </span>
            )}
          </div>
        </div>
        <div className="p-6 text-center text-sm text-gray-500 italic min-h-[200px] flex items-center justify-center">
          Keine Suchanfragen gefunden.
        </div>
      </div>
    );
  }

  // Haupt-Komponente
  return (
    <div className={cn("bg-white rounded-lg shadow-md border border-gray-200 flex flex-col", className)}>
      {/* Header Card */}
      <div className="p-4 bg-[#188BDB] rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClockHistory className="text-white" size={20} />
            <h3 className="text-lg font-semibold text-white">Top 100 Suchanfragen</h3>
          </div>
          <div className="flex items-center gap-3">
            {rangeLabel && (
              <span className="text-xs text-white/90 bg-black/10 px-2 py-0.5 rounded-full">
                {rangeLabel}
              </span>
            )}
            <div className="text-xs text-white/80">
              {queries.length} {queries.length === 1 ? 'Eintrag' : 'Einträge'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto">
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
                    Impressionen
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
                    Position
                    <FunnelFill size={12} className="opacity-60" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedQueries.map((query, index) => (
                <tr 
                  key={`${query.query}-${index}`}
                  className={cn(
                    "border-b border-gray-200 hover:bg-blue-50 transition-colors",
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  )}
                >
                  {/* Suchanfrage */}
                  <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                    <div className="break-words max-w-md">
                      {query.query}
                    </div>
                  </td>
                  
                  {/* Klicks */}
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium border-r border-gray-200 whitespace-nowrap">
                    {query.clicks.toLocaleString('de-DE')}
                  </td>
                  
                  {/* Impressionen */}
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium border-r border-gray-200 whitespace-nowrap">
                    {query.impressions.toLocaleString('de-DE')}
                  </td>
                  
                  {/* CTR */}
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium border-r border-gray-200 whitespace-nowrap">
                    {(query.ctr * 100).toFixed(2)}%
                  </td>
                  
                  {/* Position */}
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium whitespace-nowrap">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold",
                      query.position <= 3 ? "bg-green-100 text-green-800" :
                      query.position <= 10 ? "bg-blue-100 text-blue-800" :
                      query.position <= 20 ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    )}>
                      {query.position.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span>
              Gesamt Klicks: <span className="font-semibold text-gray-900">
                {sortedQueries.reduce((sum, q) => sum + q.clicks, 0).toLocaleString('de-DE')}
              </span>
            </span>
            <span>
              Gesamt Impressionen: <span className="font-semibold text-gray-900">
                {sortedQueries.reduce((sum, q) => sum + q.impressions, 0).toLocaleString('de-DE')}
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
