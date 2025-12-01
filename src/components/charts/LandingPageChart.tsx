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
    .slice(0, 10); // Top 10

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
      <div className="space-y-1.5">
        {sortedData.map((page, i) => {
          // Berechne Breiten basierend auf Metriken
          const maxValue = Math.max(...sortedData.map(p => (p.sessions || 0) + (p.conversions || 0) * 10));
          const newUsersWidth = ((page.newUsers || 0) / maxValue) * 100;
          const sessionsWidth = (((page.sessions || 0) - (page.newUsers || 0)) / maxValue) * 100;
          const engagementWidth = ((page.engagementRate || 0) / 100) * 15; // Max 15% Breite
          const conversionWidth = ((page.conversions || 0) / maxValue) * 100 * 10;
          
          return (
            <div key={i} className="group">
              {/* Stacked Bar mit allen Daten drin */}
              <div className="h-9 flex rounded-lg overflow-hidden shadow-sm hover:shadow transition-shadow relative">
                
                {/* Segment 1: Rank & Page */}
                <div className="bg-gray-700 flex items-center px-3 gap-2 flex-shrink-0" style={{ minWidth: '200px' }}>
                  <span className="text-[10px] font-black text-gray-400">#{i+1}</span>
                  <span className="text-[14px] font-medium text-white truncate" title={page.path}>
                    {page.path}
                  </span>
                </div>
                
                {/* Segment 2: Neue Besucher */}
                <div 
                  className="flex items-center justify-center px-2"
                  style={{ minWidth: '80px', flex: `0 0 ${Math.max(newUsersWidth, 10)}%`, backgroundColor: '#188BDB' }}
                >
                  <span className="text-[14px] font-bold text-white whitespace-nowrap">
                    {page.newUsers || 0} neu
                  </span>
                </div>
                
                {/* Segment 3: Total Sessions */}
                <div 
                  className="bg-teal-600 flex items-center justify-center px-2"
                  style={{ minWidth: '90px', flex: `0 0 ${Math.max(sessionsWidth, 12)}%` }}
                >
                  <span className="text-[14px] font-bold text-white whitespace-nowrap">
                    {page.sessions || 0} total
                  </span>
                </div>
                
                {/* Segment 4: Interaktionsrate */}
                <div 
                  className={`flex items-center justify-center px-2 ${
                    (page.engagementRate || 0) > 60 ? 'bg-emerald-500' : 
                    (page.engagementRate || 0) > 40 ? 'bg-blue-500' : 
                    'bg-gray-400'
                  }`}
                  style={{ minWidth: '95px', flex: `0 0 ${Math.max(engagementWidth, 12)}%` }}
                >
                  <span className="text-[14px] font-bold text-white whitespace-nowrap">
                    ⚡ {(page.engagementRate || 0).toFixed(2)}%
                  </span>
                </div>
                
                {/* Segment 5: Conversions */}
                <div 
                  className="bg-amber-500 flex items-center justify-center px-2"
                  style={{ minWidth: '80px', flex: `0 0 ${Math.max(conversionWidth, 10)}%` }}
                >
                  <span className="text-[14px] font-bold text-white whitespace-nowrap">
                    {page.conversions || 0} ★
                  </span>
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
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-700"></div>
          <span className="text-gray-600 font-medium">Seite</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#188BDB' }}></div>
          <span className="text-gray-600 font-medium">Neue Besucher</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-teal-600"></div>
          <span className="text-gray-600 font-medium">Total Sessions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500"></div>
          <span className="text-gray-600 font-medium">Interaktionsrate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500"></div>
          <span className="text-gray-600 font-medium">Conversions</span>
        </div>
      </div>
    </div>
  );
}
