// src/components/charts/LandingPageChart.tsx
'use client';

import React from 'react';
import { ConvertingPageData } from '@/lib/dashboard-shared';
import { FileEarmarkText } from 'react-bootstrap-icons';
import { format, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

interface Props {
  data?: ConvertingPageData[];
  isLoading?: boolean;
  title?: string;
  dateRange?: string; 
}

export default function LandingPageChart({ 
  data, 
  isLoading, 
  title = "Top Landingpages",
  dateRange = '30d' 
}: Props) {
  
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

  const maxNewUsers = Math.max(...sortedData.map(p => p.newUsers || 0));
  const formattedDateRange = getDateRangeString(dateRange);

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col h-[50vh]">
      
      {/* Header Bereich */}
      <div className="mb-4 flex-shrink-0 border-b border-gray-50 pb-2">
        
        {/* Zeile 1: Titel und Sortierung */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[18px] font-semibold text-gray-900 flex items-center gap-2">
            <FileEarmarkText className="text-indigo-500" size={18} />
            {title}
          </h3>
          <span className="text-xs text-gray-400">Sortiert nach Neuen Nutzern</span>
        </div>
        
        {/* Zeile 2: Kombiniert (Links: Quelle, Rechts: Legende) */}
        <div className="ml-7 flex flex-wrap items-center justify-between gap-4 mt-1">
          
          {/* Linke Seite: Quelle & Datum */}
          <div className="text-[11px] text-gray-500 flex items-center gap-2">
            <span className="font-medium bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">Quelle: GA4</span>
            <span className="text-gray-400">•</span>
            <span>{formattedDateRange}</span>
          </div>

          {/* Rechte Seite: Legende (Rechtsbündig in der gleichen Zeile) */}
          <div className="flex items-center gap-x-4">
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              Sessions = Gesamtsitzungen
            </span>
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              Rate = Interaktionsrate
            </span>
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              Conv. = Schlüsselereignisse (z.B. Anfrage)
            </span>
          </div>
          
        </div>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-1">
          {sortedData.map((page, i) => {
            const newUsers = page.newUsers || 0;
            const sessions = page.sessions || 0;
            const engagementRate = page.engagementRate || 0;
            const conversions = page.conversions || 0;
            
            const barWidthPercent = maxNewUsers > 0 
              ? Math.max((newUsers / maxNewUsers) * 60, 2) 
              : 2;

            return (
              <div key={i} className="group">
                <div className="flex items-center gap-3 py-2 hover:bg-gray-50 rounded-lg px-2 transition-colors">
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-gray-800 truncate mb-1" title={page.path}>
                      {page.path}
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${barWidthPercent}%` }}
                      />
                    </div>
                  </div>

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
                    <div className="bg-slate-400 text-white px-2 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap min-w-[65px] text-center shadow-sm">
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
