// src/components/charts/KpiTrendChart.tsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChartEntry } from '@/lib/dashboard-shared';
import { XCircle, BarChartLine, ArrowLeftRight } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';

// --- KONFIGURATION ---
// Hier definieren wir Labels und Farben für alle bekannten Metriken
const KPI_CONFIG: Record<string, { label: string; color: string; gradientId: string }> = {
  clicks: { label: 'Klicks', color: '#4f46e5', gradientId: 'colorClicks' },       // Indigo
  impressions: { label: 'Impressionen', color: '#8b5cf6', gradientId: 'colorImpressions' }, // Violet
  sessions: { label: 'Sitzungen', color: '#10b981', gradientId: 'colorSessions' },    // Emerald
  totalUsers: { label: 'Nutzer', color: '#f59e0b', gradientId: 'colorUsers' },      // Amber
  bounceRate: { label: 'Absprungrate', color: '#ef4444', gradientId: 'colorBounce' },   // Red
  avgEngagementTime: { label: 'Engagement Zeit', color: '#06b6d4', gradientId: 'colorEngagement' }, // Cyan
  // Fallbacks für mögliche andere Keys
  users: { label: 'Nutzer', color: '#f59e0b', gradientId: 'colorUsers' },
  engagementRate: { label: 'Engagement Rate', color: '#06b6d4', gradientId: 'colorEngagement' },
};

const DEFAULT_CONFIG = { label: 'Wert', color: '#6b7280', gradientId: 'colorDefault' };

interface KpiTrendChartProps {
  activeKpi: string;
  onKpiChange: (kpi: string) => void;
  allChartData?: Record<string, ChartEntry[]>;
  className?: string;
}

export default function KpiTrendChart({
  activeKpi,
  onKpiChange,
  allChartData,
  className
}: KpiTrendChartProps) {
  
  // Lokaler State für die Vergleichs-Metrik
  const [compareKpi, setCompareKpi] = useState<string | null>(null);

  // 1. Verfügbare KPIs ermitteln (nur die, die auch Daten haben)
  const availableKpis = useMemo(() => {
    if (!allChartData) return [];
    return Object.keys(allChartData).filter(key => 
      allChartData[key] && allChartData[key].length > 0
    );
  }, [allChartData]);

  // 2. Helper um Config abzurufen
  const getKpiConfig = (key: string) => KPI_CONFIG[key] || { ...DEFAULT_CONFIG, label: key };

  const activeConfig = getKpiConfig(activeKpi);
  const compareConfig = compareKpi ? getKpiConfig(compareKpi) : null;

  // 3. Daten zusammenführen (Merge)
  // Wir mappen über das Array der aktiven KPI und suchen das passende Datum in der Vergleichs-KPI
  const chartData = useMemo(() => {
    if (!allChartData || !allChartData[activeKpi]) return [];

    const primaryData = allChartData[activeKpi];
    
    // Wenn kein Vergleich aktiv ist, einfach Daten durchreichen
    if (!compareKpi || !allChartData[compareKpi]) {
      return primaryData.map(d => ({
        date: d.date,
        value: d.value,
        compareValue: null
      }));
    }

    const secondaryData = allChartData[compareKpi];
    
    // Map für schnellen Zugriff: "2023-01-01" -> Value
    const secondaryMap = new Map(secondaryData.map(d => [d.date, d.value]));

    return primaryData.map(d => ({
      date: d.date,
      value: d.value, // Wert Active KPI
      compareValue: secondaryMap.get(d.date) ?? null // Wert Compare KPI
    }));
  }, [allChartData, activeKpi, compareKpi]);


  // --- ERROR STATE ---
  if (!allChartData || !allChartData[activeKpi]) {
    return (
      <div className={cn("card-glass p-6 min-h-[400px] flex items-center justify-center text-gray-400", className)}>
        <div className="text-center">
          <BarChartLine size={32} className="mx-auto mb-2 opacity-50" />
          <p>Keine Chart-Daten verfügbar</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("card-glass p-6 flex flex-col", className)}>
      
      {/* --- HEADER & CONTROLS --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6 border-b border-gray-100 pb-4 sm:pb-0 sm:border-0">
        
        {/* LINKSEITIG: Primäre KPI Auswahl */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm">
             <BarChartLine size={22} />
          </div>
          <div className="flex flex-col">
             <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider leading-tight">
               Primäre Analyse
             </span>
             <div className="relative group">
               <select
                 value={activeKpi}
                 onChange={(e) => onKpiChange(e.target.value)}
                 className="appearance-none bg-transparent text-xl font-bold text-gray-900 focus:outline-none cursor-pointer pr-6 hover:text-indigo-600 transition-colors"
               >
                 {availableKpis.map(kpi => (
                   <option key={kpi} value={kpi} disabled={kpi === compareKpi}>
                     {getKpiConfig(kpi).label}
                   </option>
                 ))}
               </select>
               {/* Kleines Icon für Dropdown-Hinweis */}
               <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-600">
                 <ArrowLeftRight size={12} className="rotate-90" />
               </div>
             </div>
          </div>
        </div>

        {/* RECHTSEITIG: Vergleichsauswahl */}
        <div className="flex items-center gap-2 bg-white/60 border border-gray-200/60 rounded-lg p-1.5 pr-3 shadow-sm backdrop-blur-sm transition-all hover:shadow-md w-full sm:w-auto">
             <span className="text-xs font-medium text-gray-500 pl-2 whitespace-nowrap">Vergleich mit:</span>
             <select
               value={compareKpi || ''}
               onChange={(e) => setCompareKpi(e.target.value || null)}
               className="bg-transparent text-sm font-bold text-gray-800 focus:outline-none cursor-pointer py-1 w-full sm:w-auto"
             >
               <option value="">-- Keiner --</option>
               {availableKpis.map(kpi => (
                 <option key={kpi} value={kpi} disabled={kpi === activeKpi}>
                   {getKpiConfig(kpi).label}
                 </option>
               ))}
             </select>
             
             {compareKpi && (
               <button 
                 onClick={() => setCompareKpi(null)}
                 className="text-gray-400 hover:text-red-500 transition-colors ml-1 p-1 hover:bg-red-50 rounded-full"
                 title="Vergleich entfernen"
               >
                 <XCircle size={14} />
               </button>
             )}
        </div>
      </div>

      {/* --- CHART AREA --- */}
      <div className="w-full h-[350px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {/* Gradient für Active KPI */}
              <linearGradient id={activeConfig.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={activeConfig.color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={activeConfig.color} stopOpacity={0}/>
              </linearGradient>
              
              {/* Gradient für Compare KPI */}
              {compareConfig && (
                <linearGradient id={compareConfig.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={compareConfig.color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={compareConfig.color} stopOpacity={0}/>
                </linearGradient>
              )}
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            
            <XAxis
              dataKey="date"
              tickFormatter={(str) => format(new Date(str), 'd.MM', { locale: de })}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickMargin={10}
              minTickGap={30}
              axisLine={false}
              tickLine={false}
            />
            
            {/* Linke Y-Achse (Active KPI) */}
            <YAxis
              yAxisId="left"
              tickFormatter={(val) => new Intl.NumberFormat('de-DE', { notation: 'compact' }).format(val)}
              tick={{ fontSize: 11, fill: activeConfig.color, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={45}
            />

            {/* Rechte Y-Achse (Compare KPI) */}
            {compareKpi && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(val) => new Intl.NumberFormat('de-DE', { notation: 'compact' }).format(val)}
                tick={{ fontSize: 11, fill: compareConfig?.color, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
            )}

            <Tooltip
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                fontSize: '12px',
                padding: '12px'
              }}
              labelFormatter={(label) => format(new Date(label), 'd. MMMM yyyy', { locale: de })}
              formatter={(value: number, name: string) => {
                if (name === 'value') return [new Intl.NumberFormat('de-DE').format(value), activeConfig.label];
                if (name === 'compareValue') return [new Intl.NumberFormat('de-DE').format(value), compareConfig?.label || ''];
                return [value, name];
              }}
            />

            <Legend 
              verticalAlign="top" 
              height={36}
              content={({ payload }) => (
                <div className="flex justify-center gap-6 mb-2">
                  {payload?.map((entry, index) => {
                     // Wir filtern die Legend Items manuell für bessere Kontrolle
                     const isPrimary = entry.value === 'value';
                     const conf = isPrimary ? activeConfig : compareConfig;
                     if (!conf) return null;
                     
                     return (
                       <div key={index} className="flex items-center gap-2 text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm">
                         <span 
                           className="w-2.5 h-2.5 rounded-full" 
                           style={{ backgroundColor: conf.color }}
                         />
                         {conf.label}
                       </div>
                     );
                  })}
                </div>
              )}
            />

            {/* Active KPI Area */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="value"
              name="value"
              stroke={activeConfig.color}
              strokeWidth={3}
              fillOpacity={1}
              fill={`url(#${activeConfig.gradientId})`}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
              animationDuration={1000}
            />

            {/* Compare KPI Area (Gestrichelt) */}
            {compareKpi && compareConfig && (
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="compareValue"
                name="compareValue"
                stroke={compareConfig.color}
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={0.4}
                fill={`url(#${compareConfig.gradientId})`}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                animationDuration={1000}
              />
            )}

          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
