// src/components/charts/LandingPageChart.tsx
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

  // Debug: Daten prüfen
  // console.log('[LandingPageChart] Rohdaten:', data);

  // Sortiere nach Neuen Nutzern und filtere ungültige Einträge
  const sortedData = [...data]
    .filter(item => item.newUsers !== undefined && item.newUsers !== null) 
    .filter(item => !item.path?.toLowerCase().includes('danke')) 
    .sort((a, b) => (b.newUsers || 0) - (a.newUsers || 0))
    .slice(0, 50); 

  // Fallback wenn keine validen Daten
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
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
        <h3 className="text-[18px] font-semibold text-gray-900 flex items-center gap-2">
          <FileEarmarkText className="text-indigo-500" size={18} />
          {title}
        </h3>

        {/* Legende */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
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

      {/* ✅ UPDATE: Scrollbarer Container für die Balken */}
      <div className="overflow-x-auto pb-2 flex-1">
        {/* Min-Width erzwingt, dass die Balken nicht gequetscht werden -> Scrollbar erscheint */}
        <div className="space-y-2.5 min-w-[900px]">
          {sortedData.map((page, i) => {
            
            // Berechnungsgrundlage: MaxValue = Sessions + (Conversions * 10)
            const maxValue = Math.max(...sortedData.map(p => (p.sessions || 0) + (p.conversions || 0) * 10));
            
            // Verhindert Division durch Null
            const safeMax = maxValue > 0 ? maxValue : 1;

            const newUsers = page.newUsers || 0;
            const sessions = page.sessions || 0;
            
            // Sichere Berechnung der Breiten
            const newUsersWidth = (newUsers / safeMax) * 100;
            
            // Sessions-Balken ist der Rest (Total - Neue)
            // Math.max(0, ...) verhindert negative Werte bei Datenfehlern
            const sessionsWidth = (Math.max(0, sessions - newUsers) / safeMax) * 100;
            
            const engagementWidth = ((page.engagementRate || 0) / 100) * 15; 
            const conversionWidth = ((page.conversions || 0) / safeMax) * 100 * 10;
            
            return (
              <div key={i} className="group">
                <div className="h-9 flex rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow relative bg-gray-50">
                  
                  {/* 1. Seite */}
                  <div className="bg-gray-700 flex items-center px-3 gap-2 flex-shrink-0" style={{ width: '220px' }}>
                    <span className="text-[10px] font-black text-gray-400 w-5">#{i+1}</span>
                    <span className="text-[13px] font-medium text-white truncate" title={page.path}>
                      {page.path}
                    </span>
                  </div>
                  
                  {/* 2. Neue Besucher */}
                  <div 
                    className="flex items-center px-2 transition-all hover:brightness-110"
                    style={{ 
                      flex: `0 0 ${Math.max(newUsersWidth, 1)}%`, 
                      minWidth: '140px', // Etwas mehr Platz für Text
                      backgroundColor: '#188BDB' 
                    }}
                  >
                    <span className="text-[13px] text-white whitespace-nowrap">
                      {newUsers.toLocaleString()} Neue Besucher
                    </span>
                  </div>
                  
                  {/* 3. Total Sessions (Rest) */}
                  <div 
                    className="bg-teal-600 flex items-center px-2 transition-all hover:brightness-110"
                    style={{ 
                      flex: `0 0 ${Math.max(sessionsWidth, 1)}%`,
                      minWidth: '140px' 
                    }}
                  >
                    <span className="text-[13px] text-white whitespace-nowrap">
                      {sessions.toLocaleString()} Total Sessions
                    </span>
                  </div>
                  
                  {/* 4. Interaktionsrate */}
                  <div 
                    className={`flex items-center px-2 transition-all hover:brightness-110 ${
                      (page.engagementRate || 0) > 60 ? 'bg-emerald-500' : 
                      (page.engagementRate || 0) > 40 ? 'bg-blue-500' : 
                      'bg-gray-400'
                    }`}
                    style={{ 
                      flex: `0 0 ${Math.max(engagementWidth, 1)}%`,
                      minWidth: '180px' // Genug Platz für "55.20% Interaktionsrate"
                    }}
                  >
                    <span className="text-[13px] text-white whitespace-nowrap">
                      {(page.engagementRate || 0).toFixed(2)}% Interaktionsrate
                    </span>
                  </div>
                  
                  {/* 5. Conversions */}
                  <div 
                    className="bg-amber-500 flex items-center px-2 transition-all hover:brightness-110"
                    style={{ 
                      flex: `0 0 ${Math.max(conversionWidth, 1)}%`,
                      minWidth: '120px'
                    }}
                  >
                    <span className="text-[13px] text-white whitespace-nowrap font-medium">
                      {page.conversions || 0} Conversions
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {sortedData.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Keine Landing Pages mit Daten gefunden
        </div>
      )}
    </div>
  );
}
