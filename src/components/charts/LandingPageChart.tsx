'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { ConvertingPageData } from '@/lib/dashboard-shared';
import { cn } from '@/lib/utils';
import { FileEarmarkText } from 'react-bootstrap-icons';

interface Props {
  data?: ConvertingPageData[];
  isLoading?: boolean;
  title?: string;
}

// Helfer zum Kürzen von langen URLs
const truncatePath = (path: string, maxLength = 30) => {
  if (path.length <= maxLength) return path;
  return '...' + path.slice(-maxLength); // Zeige das Ende der URL (oft wichtiger)
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ConvertingPageData;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm z-50">
        <p className="font-bold text-gray-900 mb-1 break-all">{data.path}</p>
        <div className="space-y-1 text-gray-600">
          <p>🆕 Neue Besucher: <span className="font-medium text-indigo-600">{data.newUsers || 0}</span></p>
          <p>👥 Sitzungen gesamt: <span className="font-medium">{data.sessions || 0}</span></p>
          <hr className="border-gray-100 my-1"/>
          <p>⚡ Interaktionsrate: <span className={`font-medium ${data.engagementRate && data.engagementRate > 50 ? 'text-emerald-600' : 'text-amber-600'}`}>{data.engagementRate || 0}%</span></p>
          <p>🎯 Conversions: <span className="font-medium text-amber-600">{data.conversions || 0}</span></p>
        </div>
      </div>
    );
  }
  return null;
};

export default function LandingPageChart({ data, isLoading, title = "Top Landingpages" }: Props) {
  if (isLoading) {
    return <div className="h-[400px] w-full bg-gray-50 rounded-xl animate-pulse flex items-center justify-center text-gray-400">Lade Daten...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-[400px] w-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Keine Daten verfügbar</div>;
  }

  // ✅ Debug: Daten in Konsole ausgeben
  console.log('[LandingPageChart] Rohdaten:', data);

  // ✅ Sortiere nach Neuen Nutzern und filtere ungültige Einträge
  const sortedData = [...data]
    .filter(item => item.newUsers !== undefined && item.newUsers !== null) // Nur valide Daten
    .sort((a, b) => (b.newUsers || 0) - (a.newUsers || 0))
    .slice(0, 7);

  console.log('[LandingPageChart] Sortierte Daten:', sortedData);

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
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <FileEarmarkText className="text-indigo-500" />
          {title}
        </h3>
        <div className="text-xs text-gray-400 text-right hidden sm:block">
          Balken: Neue Besucher<br/>Werte: Engagement | Conv.
        </div>
      </div>

      <div className="flex-grow w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={sortedData}
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            barSize={24} // Schlankere Balken
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            
            {/* Y-Achse (Pfade) */}
            <YAxis 
              dataKey="path" 
              type="category" 
              width={140}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(value) => truncatePath(value)}
            />
            
            {/* X-Achse (Neue Nutzer) */}
            <XAxis type="number" hide />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />

            {/* Balken für Neue Nutzer */}
            <Bar dataKey="newUsers" radius={[0, 4, 4, 0]}>
              {sortedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#6366f1" /> // Indigo
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail-Tabelle unter dem Chart für die genauen Raten */}
      <div className="mt-4 grid grid-cols-1 gap-1">
         {sortedData.map((page, i) => (
           <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
              <span className="text-gray-500 w-8">#{i+1}</span>
              <span className="truncate flex-1 text-gray-700 mr-2" title={page.path}>{page.path}</span>
              <div className="flex gap-3 text-right">
                 <span className="w-12 text-indigo-600 font-medium">{page.newUsers || 0} Neu</span>
                 <span className={`w-12 font-medium ${page.engagementRate && page.engagementRate > 60 ? 'text-emerald-600' : 'text-gray-600'}`}>{page.engagementRate || 0}% Eng.</span>
                 <span className="w-8 text-amber-600 font-bold">{page.conversions || 0} ★</span>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}
