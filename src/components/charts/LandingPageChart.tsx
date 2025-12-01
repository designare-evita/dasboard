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

  // ✅ Sortiere nach Neuen Nutzern und filtere ungültige Einträge
  const sortedData = [...data]
    .filter(item => item.newUsers !== undefined && item.newUsers !== null) // Nur valide Daten
    .sort((a, b) => (b.newUsers || 0) - (a.newUsers || 0))
    .slice(0, 10); // Top 10

  // Max-Werte für die Berechnung der Balken-Länge (damit der größte Balken 100% füllt)
  const maxNewUsers = Math.max(...sortedData.map(d => d.newUsers || 0), 1);
  const maxSessions = Math.max(...sortedData.map(d => d.sessions || 0), 1);
  // Engagement und Conversions sind oft kleiner, daher eigene Skalierung oder fix 100% wenn es Raten sind
  // Hier nehmen wir an, dass Engagement eine Rate (0-100) ist.
  // Conversions sind absolute Zahlen, also auch max-basiert.
  const maxConversions = Math.max(...sortedData.map(d => d.conversions || 0), 1);

  return (
    <div className="w-full bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <FileEarmarkText className="text-indigo-500" />
          {title}
        </h3>
      </div>

      <div className="space-y-6">
        {sortedData.map((item, index) => {
          // Prozentuale Breite berechnen
          const percentNewUsers = ((item.newUsers || 0) / maxNewUsers) * 100;
          const percentSessions = ((item.sessions || 0) / maxSessions) * 100;
          const percentEngagement = item.engagementRate || 0; // Ist meist schon Prozent
          const percentConversions = ((item.conversions || 0) / maxConversions) * 100;

          return (
            <div key={index} className="flex flex-col gap-2">
              {/* Titel & Pfad */}
              <div className="flex justify-between items-end text-xs">
                 <span className="font-medium text-gray-700 truncate max-w-[70%]" title={item.path}>
                    {index + 1}. {item.path}
                 </span>
                 <span className="text-gray-400 text-[10px]">{item.pageTitle?.substring(0, 30)}...</span>
              </div>

              {/* Balken-Container */}
              <div className="flex flex-col gap-1 w-full bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                
                {/* 1. Neue Besucher (Blau) */}
                <div className="w-full h-5 bg-gray-200 rounded overflow-hidden relative">
                    <div
                      className="h-full bg-[#188BDB] rounded relative group transition-all duration-300 hover:brightness-110"
                      style={{ width: `${Math.max(percentNewUsers, 1)}%` }} // Mindestens 1% Breite
                    >
                      {/* ÄNDERUNG: justify-start pl-2 (Linksbündig) */}
                      <span className="absolute inset-0 flex items-center justify-start pl-2 text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 drop-shadow-md">
                        {item.newUsers?.toLocaleString('de-DE')} Neue Besucher
                      </span>
                    </div>
                </div>

                {/* 2. Total Sessions (Teal) */}
                <div className="w-full h-5 bg-gray-200 rounded overflow-hidden relative">
                    <div
                      className="h-full bg-teal-600 rounded relative group transition-all duration-300 hover:brightness-110"
                      style={{ width: `${Math.max(percentSessions, 1)}%` }}
                    >
                       {/* ÄNDERUNG: justify-start pl-2 */}
                       <span className="absolute inset-0 flex items-center justify-start pl-2 text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 drop-shadow-md">
                        {item.sessions?.toLocaleString('de-DE')} Sessions
                      </span>
                    </div>
                </div>

                {/* 3. Interaktionsrate (Emerald) */}
                <div className="w-full h-5 bg-gray-200 rounded overflow-hidden relative">
                    <div
                      className="h-full bg-emerald-500 rounded relative group transition-all duration-300 hover:brightness-110"
                      style={{ width: `${Math.max(percentEngagement, 1)}%` }}
                    >
                       {/* ÄNDERUNG: justify-start pl-2 */}
                       <span className="absolute inset-0 flex items-center justify-start pl-2 text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 drop-shadow-md">
                        ⚡ {item.engagementRate?.toFixed(2)}% Rate
                      </span>
                    </div>
                </div>

                 {/* 4. Conversions (Violett) */}
                 <div className="w-full h-5 bg-gray-200 rounded overflow-hidden relative">
                    <div
                      className="h-full bg-violet-500 rounded relative group transition-all duration-300 hover:brightness-110"
                      style={{ width: `${Math.max(percentConversions, 1)}%` }}
                    >
                       {/* ÄNDERUNG: justify-start pl-2 */}
                       <span className="absolute inset-0 flex items-center justify-start pl-2 text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 drop-shadow-md">
                        {item.conversions} ★ Conversions
                      </span>
                    </div>
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
          <div className="w-3 h-3 rounded bg-violet-500"></div>
          <span className="text-gray-600 font-medium">Conversions</span>
        </div>
      </div>
    </div>
  );
}
