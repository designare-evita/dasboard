'use client';

import React from 'react';
import { ConvertingPageData } from '@/lib/dashboard-shared';
import { cn } from '@/lib/utils';
import { FileEarmarkText } from 'react-bootstrap-icons';

interface Props {
  data?: ConvertingPageData[];
  isLoading?: boolean;
  title?: string;
}

export default function LandingPageChart({ data, isLoading, title = "Top Landingpages" }: Props) {
  if (isLoading) {
    return <div className="h-[400px] w-full bg-gray-50 rounded-xl animate-pulse flex items-center justify-center text-gray-400">Lade Daten...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-[400px] w-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Keine Daten verfügbar</div>;
  }

  // ✅ Debug: Daten in Konsole ausgeben
  console.log('[LandingPageChart] Rohdaten:', data);
  console.log('[LandingPageChart] Erstes Objekt:', data[0]);
  console.log('[LandingPageChart] Keys:', data[0] ? Object.keys(data[0]) : 'keine Daten');

  // ✅ Sortiere nach Neuen Nutzern und filtere ungültige Einträge
  const sortedData = [...data]
    .filter(item => item.newUsers !== undefined && item.newUsers !== null) // Nur valide Daten
    .sort((a, b) => (b.newUsers || 0) - (a.newUsers || 0))
    .slice(0, 7);

  console.log('[LandingPageChart] Sortierte Daten:', sortedData);
  console.log('[LandingPageChart] Anzahl sortierter Einträge:', sortedData.length);

  // ✅ Fallback wenn keine validen Daten
  if (sortedData.length === 0) {
    return (
      <div className="h-[400px] w-full bg-gray-50 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-2">Keine validen Landing Page Daten</p>
          <p className="text-xs text-gray-300">newUsers oder sessions fehlen in den Daten</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FileEarmarkText className="text-indigo-500" size={16} />
          {title}
        </h3>
      </div>

      {/* Kompakte Stacked Bar Visualisierung */}
      <div className="space-y-2">
        {sortedData.map((page, i) => {
          const total = (page.newUsers || 0) + (page.sessions || 0);
          const newUsersPercent = total > 0 ? ((page.newUsers || 0) / total) * 100 : 0;
          const sessionsPercent = total > 0 ? ((page.sessions || 0) / total) * 100 : 0;
          
          return (
            <div key={i} className="group">
              {/* Label & Werte */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-gray-400 w-6 flex-shrink-0">#{i+1}</span>
                  <span className="text-xs text-gray-700 truncate" title={page.path}>
                    {page.path}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-medium ml-2 flex-shrink-0">
                  <span className="text-indigo-600">{page.newUsers || 0} neu</span>
                  <span className="text-gray-500">{page.sessions || 0} total</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    (page.engagementRate || 0) > 60 ? 'bg-emerald-50 text-emerald-700' : 
                    (page.engagementRate || 0) > 40 ? 'bg-blue-50 text-blue-700' : 
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {page.engagementRate || 0}%
                  </span>
                  <span className="text-amber-600 font-bold">{page.conversions || 0}★</span>
                </div>
              </div>
              
              {/* Stacked Bar */}
              <div className="h-7 flex rounded-md overflow-hidden bg-gray-100 group-hover:shadow-sm transition-shadow">
                {/* Neue Besucher */}
                <div 
                  className="bg-indigo-500 flex items-center justify-center text-white text-[10px] font-semibold transition-all"
                  style={{ width: `${newUsersPercent}%` }}
                >
                  {newUsersPercent > 15 && (page.newUsers || 0)}
                </div>
                
                {/* Returning Sessions */}
                <div 
                  className="bg-teal-500 flex items-center justify-center text-white text-[10px] font-semibold transition-all"
                  style={{ width: `${sessionsPercent}%` }}
                >
                  {sessionsPercent > 15 && ((page.sessions || 0) - (page.newUsers || 0))}
                </div>
                
                {/* Total am Ende */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-1.5 py-0.5 rounded">
                  {total}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sortedData.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Keine Landing Pages mit Daten gefunden
        </div>
      )}
      
      {/* Legende */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-500"></div>
          <span className="text-gray-600">Neue Besucher</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-teal-500"></div>
          <span className="text-gray-600">Wiederkehrende</span>
        </div>
      </div>
    </div>
  );
}
