// src/components/charts/LandingPageChart.tsx
'use client';

import React from 'react';
import { ConvertingPageData } from '@/lib/dashboard-shared';

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
    // ✅ UPDATE: Filter erweitert für Impressum & Datenschutz
    .filter(item => {
      const path = item.path?.toLowerCase() || '';
      return !path.includes('danke') && !path.includes('impressum') && !path.includes('datenschutz');
    })
    .sort((a, b) => (b.newUsers || 0) - (a.newUsers || 0))
    .slice(0, 50); 

  if (sortedData.length === 0) {
    return (
      <div className="h-[50vh] w-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
        Keine validen Daten (Neue Nutzer) gefunden
      </div>
    );
  }

  // Max-Wert für Balken-Skalierung
  const maxUsers = Math.max(...sortedData.map(d => d.newUsers || 0));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          {title}
        </h3>
        <div className="text-xs text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded">
          Sortiert nach Neuen Nutzern
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-4">
          {sortedData.map((page, idx) => {
            const rawUsers = page.newUsers || 0;
            const percent = maxUsers > 0 ? (rawUsers / maxUsers) * 100 : 0;
            const rawSessions = page.sessions || 0;
            
            return (
              <div key={idx} className="group relative">
                <div className="flex items-center gap-3 w-full">
                  
                  {/* Pfad & Balken */}
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm font-medium text-gray-700 truncate w-full" title={page.path}>
                        {page.path}
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out group-hover:bg-emerald-400"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Metriken Container - Fest ausgerichtet */}
                  <div className="flex-shrink-0 flex items-center justify-end" style={{ width: '280px' }}>
                    <div className="flex items-center gap-1 w-full justify-end">
                      
                      {/* Neue Nutzer */}
                      <div className="w-20 text-right">
                        <span className="block text-sm font-bold text-gray-900">{rawUsers.toLocaleString()}</span>
                        <span className="block text-[10px] text-gray-400 uppercase">User</span>
                      </div>

                      {/* Sitzungen (Blau) */}
                       <div 
                        className="bg-blue-500 flex items-center px-2 overflow-hidden flex-shrink-0 rounded-l-md"
                        style={{ 
                          width: '90px',
                          minWidth: '90px'
                        }}
                      >
                         <span className="text-[12px] text-white whitespace-nowrap truncate">
                           {rawSessions.toLocaleString()} Sess.
                         </span>
                      </div>


                      {/* Interaktionsrate */}
                       <div 
                        className="bg-emerald-500 flex items-center px-2 overflow-hidden flex-shrink-0"
                        style={{ width: '90px' }} 
                      >
                        <span className="text-[12px] text-white whitespace-nowrap truncate">
                          {(page.engagementRate || 0).toFixed(0)}% Rate
                        </span>
                      </div>

                      {/* Conversions */}
                      <div 
                        className="bg-amber-500 flex items-center px-2 overflow-hidden flex-shrink-0 rounded-r-md"
                        style={{ width: '90px' }}
                      >
                        <span className="text-[12px] text-white whitespace-nowrap truncate">
                          {page.conversions || 0} Conv.
                        </span>
                      </div>

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
