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
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <FileEarmarkText className="text-indigo-500" />
          {title}
        </h3>
        <div className="text-xs text-gray-400 hidden sm:block">
          Sortiert nach neuen Besuchern
        </div>
      </div>

      {/* Chart Bereich - nur wenn mehr als 1 Eintrag */}
      {sortedData.length > 1 && (
        <div className="w-full mb-4" style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={sortedData}
              margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              barSize={32}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              
              {/* Y-Achse (Pfade) */}
              <YAxis 
                dataKey="path" 
                type="category" 
                width={180}
                tick={{ fontSize: 12, fill: '#4b5563' }}
                tickFormatter={(value) => truncatePath(value, 40)}
              />
              
              {/* X-Achse (Neue Nutzer) */}
              <XAxis 
                type="number" 
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                label={{ value: 'Neue Besucher', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#6b7280' } }}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />

              {/* Balken für Neue Nutzer */}
              <Bar dataKey="newUsers" radius={[0, 8, 8, 0]} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detail-Tabelle */}
      <div className="mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 w-8">#</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">Seite</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-20">Neue</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-24">Sessions</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-24">Engagement</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 w-20">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((page, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-2.5 px-2 text-gray-400 font-medium">#{i+1}</td>
                  <td className="py-2.5 px-2 text-gray-700 font-medium truncate max-w-xs" title={page.path}>
                    {page.path}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="inline-flex items-center gap-1 text-indigo-600 font-bold">
                      {page.newUsers || 0}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-600 font-medium">
                    {page.sessions || 0}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      (page.engagementRate || 0) > 60 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : (page.engagementRate || 0) > 40 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-gray-50 text-gray-600 border border-gray-200'
                    }`}>
                      {page.engagementRate || 0}%
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                      {page.conversions || 0} ★
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {sortedData.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Keine Landing Pages mit Daten gefunden
          </div>
        )}
      </div>
    </div>
  );
}
