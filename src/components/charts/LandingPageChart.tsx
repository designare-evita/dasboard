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

  // ✅ Sortiere nach Neuen Nutzern und filtere "Danke"-Seiten aus
  const sortedData = [...data]
    .filter(item => {
      // 1. Nur valide Daten
      if (item.newUsers === undefined || item.newUsers === null) return false;
      
      // 2. "Danke"-Seiten ausschließen (Case-Insensitive Prüfung)
      const path = (item.path || '').toLowerCase();
      // Liste der Begriffe, die auf eine Danke-Seite hinweisen
      const blacklistedTerms = [
        'danke', 
        'thank', 
        'success', 
        'bestätigung', 
        'confirmation',
        'order-received'
      ];
      
      // Wenn einer der Begriffe im Pfad vorkommt -> Rausfiltern (return false)
      if (blacklistedTerms.some(term => path.includes(term))) {
        return false;
      }

      return true;
    })
    .sort((a, b) => (b.newUsers || 0) - (a.newUsers || 0))
    .slice(0, 5); // Nur die Top 5 anzeigen

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-50 rounded-lg">
          <FileEarmarkText className="text-blue-600 text-lg" />
        </div>
        <div>
           <h3 className="font-semibold text-gray-900">{title}</h3>
           <p className="text-xs text-gray-500">Seiten mit den meisten neuen Besuchern (ohne Danke-Seiten)</p>
        </div>
      </div>

      {/* Liste der Balken */}
      <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {sortedData.map((item, idx) => {
          // Maximale Breite für Balken berechnen (basierend auf höchstem Wert in der Liste)
          const maxVal = sortedData[0]?.newUsers || 1;
          const percentage = Math.max(5, ((item.newUsers || 0) / maxVal) * 100);

          return (
            <div key={idx} className="group">
              <div className="flex justify-between text-sm mb-1.5">
                <div className="font-medium text-gray-900 truncate max-w-[70%]" title={item.path}>
                  {item.path}
                </div>
                <div className="text-gray-900 font-bold">
                  {item.newUsers?.toLocaleString()} <span className="text-xs font-normal text-gray-500">Neu</span>
                </div>
              </div>
              
              {/* Balken Hintergrund */}
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                {/* Balken Füllung */}
                <div 
                  className="h-full rounded-full transition-all duration-500 ease-out group-hover:brightness-95"
                  style={{ 
                    width: `${percentage}%`,
                    backgroundColor: '#188BDB' // Konsistentes Blau
                  }}
                />
              </div>

              {/* Zusätzliche Metriken (Sessions & Engagement) */}
              <div className="flex items-center gap-4 mt-1.5 pl-0.5">
                 <div className="text-[10px] text-gray-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                    Sessions: <span className="font-medium text-gray-600">{item.sessions?.toLocaleString() || 0}</span>
                 </div>
                 <div className="text-[10px] text-gray-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Engagement: <span className="font-medium text-gray-600">{(item.engagementRate ? (item.engagementRate * 100).toFixed(1) : 0)}%</span>
                 </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fallback wenn keine Daten nach Filterung übrig bleiben */}
      {sortedData.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Keine Landing Pages gefunden (nach Filterung)
        </div>
      )}
      
      {/* Legende (Wichtig: War vorher abgeschnitten) */}
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
      </div>
      
    </div>
  );
}
