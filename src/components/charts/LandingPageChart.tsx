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
    return <div className="h-[400px] w-full bg-gray-50 rounded-xl animate-pulse flex items-center justify-center text-gray-400">Lade Daten...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-[400px] w-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Keine Daten verfügbar</div>;
  }

  // Daten filtern und sortieren
  const sortedData = [...data]
    .filter(item => item.newUsers !== undefined && item.newUsers !== null) 
    .filter(item => !item.path?.toLowerCase().includes('danke')) 
    .sort((a, b) => (b.newUsers || 0) - (a.newUsers || 0))
    .slice(0, 50); 

  if (sortedData.length === 0) {
    return (
      <div className="h-[400px] w-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
        Keine validen Daten
      </div>
    );
  }

  // --- LOGIK FÜR SMARTE SKALIERUNG ---
  
  // Berechne Gesamt-Score für jeden Eintrag (Sessions + gewichtete Conversions)
  const getScore = (p: ConvertingPageData) => (p.sessions || 0) + (p.conversions || 0) * 10;
  
  const firstScore = getScore(sortedData[0]);
  const secondScore = sortedData.length > 1 ? getScore(sortedData[1]) : 0;

  // Prüfen, ob der erste Platz ein extremer Ausreißer ist (mehr als doppelt so groß wie der zweite)
  const isOutlier = secondScore > 0 && firstScore > (secondScore * 2);

  // Wenn Ausreißer: Skaliere Basis auf den ZWEITEN Platz (+20% Puffer)
  // Sonst: Normal auf den ersten Platz
  const scaleMax = isOutlier ? secondScore * 1.2 : firstScore;

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

      {/* Container OHNE horizontales Scrollen */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="space-y-2.5">
          {sortedData.map((page, i) => {
            const currentScore = getScore(page);
            
            // Ist dieser spezielle Balken der Ausreißer?
            const isThisTheOutlier = i === 0 && isOutlier;

            // Breitenberechnung
            const safeMax = scaleMax > 0 ? scaleMax : 1;
            
            // Wenn Ausreißer -> Gesamtlänge künstlich begrenzen (damit er nicht rausragt)
            // Ansonsten normal skalieren
            const totalWidthPercent = isThisTheOutlier 
              ? 100 // Volle Breite, aber Break-Symbol
              : Math.min((currentScore / safeMax) * 100, 100);

            // Verhältnis der Segmente zueinander innerhalb des Balkens
            const rawNewUsers = page.newUsers || 0;
            const rawSessions = page.sessions || 0;
            const rawConv = (page.conversions || 0) * 10; // Gewichtung wie oben
            const rawEng = (page.engagementRate || 0); // Hier etwas vereinfacht für Visualisierung

            // Summe der Teile für relative Verteilung im Balken
            // (Wir nehmen Sessions als Basis für Länge, aber teilen visuell auf)
            // Vereinfachung: Wir nutzen feste Verhältnisse basierend auf dem Wert
            
            // Breite relativ zum Skalen-Max
            let wNewUsers = (rawNewUsers / safeMax) * 100;
            let wSessions = ((rawSessions - rawNewUsers) / safeMax) * 100; // Rest-Sessions
            let wEng = 15; // Fixe Breite für Rate reservieren, wenn möglich? Nein, dynamisch.
            // Engagement ist schwer in "Summe" zu packen. Wir machen es als festen Block.
            
            // BESSERER ANSATZ FÜR STACKED BAR MIT "FESTEN" PROPORTIONEN:
            // Wir nutzen Flex-Grow basierend auf den Werten, aber begrenzen die Gesamtbreite des Containers.
            
            return (
              <div key={i} className="group relative">
                {/* Break-Symbol für den Ausreißer (Platz 1) */}
                {isThisTheOutlier && (
                   <div 
                     className="absolute top-0 bottom-0 z-20 flex items-center justify-center" 
                     style={{ left: '50%' }}
                   >
                     <div className="bg-white px-1 transform -skew-x-12 border-l-2 border-r-2 border-gray-300 h-full flex flex-col justify-center">
                       {/* Zick-Zack Linie oder einfach leerer Schnitt */}
                     </div>
                   </div>
                )}

                <div className="h-9 flex rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow relative bg-gray-50 w-full">
                  
                  {/* 1. Label (Seite) - Fixe Breite */}
                  <div className="bg-gray-700 flex items-center px-3 gap-2 flex-shrink-0 z-30 relative" style={{ width: '200px' }}>
                    <span className="text-[10px] font-black text-gray-400 w-5">#{i+1}</span>
                    <span className="text-[13px] font-medium text-white truncate" title={page.path}>
                      {page.path}
                    </span>
                  </div>
                  
                  {/* Der eigentliche Daten-Balken Bereich */}
                  <div className="flex flex-1 relative bg-gray-100 min-w-0">
                    {/* Wir wrappen die Balken in einen Container, dessen Breite dem Wert entspricht */}
                    <div className="flex h-full transition-all duration-500 ease-out" style={{ width: `${totalWidthPercent}%` }}>
                      
                      {/* Neue Besucher */}
                      <div 
                        className="bg-[#188BDB] flex items-center px-2 overflow-hidden"
                        style={{ width: `${(rawNewUsers / currentScore) * 100}%` }}
                      >
                         <span className="text-[12px] text-white whitespace-nowrap truncate">
                           {rawNewUsers.toLocaleString()} Neu
                         </span>
                      </div>

                      {/* Total Sessions (Rest) */}
                      <div 
                        className="bg-teal-600 flex items-center px-2 overflow-hidden"
                        style={{ width: `${((rawSessions - rawNewUsers) / currentScore) * 100}%` }}
                      >
                         <span className="text-[12px] text-white whitespace-nowrap truncate">
                           {rawSessions.toLocaleString()} Sess.
                         </span>
                      </div>

                      {/* Interaktionsrate (Fake-Anteil für Visualisierung oder fest) */}
                      {/* Da Rate % ist und Sessions absolut, passt das nicht in einen Stack. 
                          Wir mogeln hier etwas: Wir geben der Rate festen Platz im Balken oder hängen sie an */}
                       <div 
                        className={`flex items-center px-2 overflow-hidden ${
                          (page.engagementRate || 0) > 60 ? 'bg-emerald-500' : 
                          (page.engagementRate || 0) > 40 ? 'bg-blue-500' : 
                          'bg-gray-400'
                        }`}
                        style={{ width: '15%' }} // Feste relative Breite im Stack
                      >
                        <span className="text-[12px] text-white whitespace-nowrap truncate">
                          {(page.engagementRate || 0).toFixed(0)}% Rate
                        </span>
                      </div>

                      {/* Conversions */}
                      <div 
                        className="bg-amber-500 flex items-center px-2 overflow-hidden"
                        style={{ flex: 1 }} // Nimmt den Rest des zugewiesenen Platzes
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
