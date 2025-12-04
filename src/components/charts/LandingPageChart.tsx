// src/components/charts/LandingPageChart.tsx
'use client';

import React from 'react';
import { ConvertingPageData } from '@/lib/dashboard-shared';
import { FileEarmarkText } from 'react-bootstrap-icons';

interface Props {
  data?: ConvertingPageData[];
  isLoading?: boolean;
  title?: string;
}

export default function LandingPageChart({ data, isLoading, title = "Top Landingpages" }: Props) {
  if (isLoading) {
    return <div className="h-[50vh] w-full bg-gray-50 rounded-xl animate-pulse flex items-center justify-center text-gray-400">Lade Daten...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-[50vh] w-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Keine Daten verfügbar</div>;
  }

  const sortedData = [...data]
    .filter(item => item.newUsers !== undefined && item.newUsers !== null) 
    .filter(item => {
      const path = item.path?.toLowerCase() || '';
      return !path.includes('danke') && !path.includes('impressum') && !path.includes('datenschutz');
    })
    .sort((a, b) => (b.newUsers || 0) - (a.newUsers || 0))
    .slice(0, 50);

  if (sortedData.length === 0) {
    return (
      <div className="h-[50vh] w-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
        Keine validen Daten
      </div>
    );
  }

  // Maximaler Wert für die Balkenbreite
  const maxNewUsers = Math.max(...sortedData.map(p => p.newUsers || 0));

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col h-[50vh]">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-[18px] font-semibold text-gray-900 flex items-center gap-2">
          <FileEarmarkText className="text-indigo-500" size={18} />
          {title}
        </h3>
        <span className="text-xs text-gray-400">Sortiert nach Neuen Nutzern</span>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-1">
          {sortedData.map((page, i) => {
            const newUsers = page.newUsers || 0;
            const sessions = page.sessions || 0;
            const engagementRate = page.engagementRate || 0;
            const conversions = page.conversions || 0;
            
            // Balkenbreite relativ zum Maximum (max 60% der verfügbaren Breite)
            const barWidthPercent = maxNewUsers > 0 
              ? Math.max((newUsers / maxNewUsers) * 60, 2) 
              : 2;

            return (
              <div key={i} className="group">
                {/* Zeile */}
                <div className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded-lg px-2 transition-colors">
                  
                  {/* Linke Seite: Seitenname mit grünem Balken darunter */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-gray-700 truncate mb-1" title={page.path}>
                      {page.path}
                    </div>
                    {/* Grüner Fortschrittsbalken */}
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${barWidthPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Rechte Seite: Metriken als Badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    
                    {/* Neue Besucher - Grüner Badge (prominent) */}
                    <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-md text-[12px] font-semibold whitespace-nowrap min-w-[140px] text-center">
                      {newUsers.toLocaleString()} Neue Besucher
                    </div>

                    {/* Sessions - Blauer Badge */}
                    <div className="bg-sky-500 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[75px] text-center">
                      {sessions.toLocaleString()} Sess.
                    </div>

                    {/* Engagement Rate - Türkis Badge */}
                    <div className="bg-teal-500 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[70px] text-center">
                      {engagementRate.toFixed(0)}% Rate
                    </div>

                    {/* Conversions - Grauer Badge */}
                    <div className="bg-slate-400 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[65px] text-center">
                      {conversions} Conv.
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
