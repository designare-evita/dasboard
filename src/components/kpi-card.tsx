// src/components/kpi-card.tsx
'use client';

import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';
import { ChartPoint } from '@/types/dashboard'; 

interface KpiCardProps {
  title: string;
  value: number;
  change?: number; 
  isLoading?: boolean;
  data?: ChartPoint[];
  color?: string;
  error?: string | null;
  className?: string;
}

export default function KpiCard({ 
  title, 
  value, 
  change, 
  isLoading = false, 
  data,
  color = '#3b82f6',
  error = null,
  className = ''
}: KpiCardProps) {
  
  const isPositive = change !== undefined && change >= 0;

  // ✅ FIX: Berechne min/max mit Puffer für korrekte Skalierung
  const yDomain = useMemo(() => {
    if (!data || data.length === 0) return [0, 100];
    
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Falls alle Werte gleich sind, kleinen Bereich erstellen
    if (min === max) {
      return [min * 0.9, max * 1.1];
    }
    
    // 10% Puffer oben und unten hinzufügen
    const padding = (max - min) * 0.1;
    return [
      Math.max(0, min - padding), // Nicht unter 0 gehen
      max + padding
    ];
  }, [data]);

  if (isLoading) {
    return (
      <div className={`p-6 rounded-xl border border-gray-100 ${className || 'bg-white shadow-sm'}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="h-16 bg-gray-100 rounded-lg w-full mt-2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-xl transition-all duration-300 ${className || 'bg-white shadow-sm border border-gray-200 hover:shadow-md'}`}>
      <div className="flex justify-between items-start mb-1">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h3>
        
        {/* Trend Indikator oben rechts */}
        {!error && change !== undefined && (
          <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
            isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {isPositive ? <ArrowUp className="mr-1" size={10} /> : <ArrowDown className="mr-1" size={10} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>

      {error ? (
        <div className="flex flex-col justify-center h-[80px]">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <ExclamationTriangleFill size={14} />
            <span className="text-xs font-semibold">Datenfehler</span>
          </div>
          <p className="text-[10px] text-gray-500 leading-tight">
            {error}
          </p>
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-gray-900 mb-4 tracking-tight">
            {value.toLocaleString('de-DE')}
          </div>

          {/* ✨ SPARKLINE CHART - MIT FIX ✨ */}
          <div className="h-[50px] -mx-2">
            {data && data.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={data}
                  margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                >
                  <defs>
                    <linearGradient id={`grad-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  
                  {/* ✅ FIX: Versteckte Y-Achse mit korrekter Domain */}
                  <YAxis 
                    domain={yDomain}
                    hide={true}
                    allowDataOverflow={false}
                  />
                  
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#grad-${title.replace(/\s+/g, '-')})`}
                    animationDuration={1000}
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              // Fallback, wenn keine Historie da ist
              <div className="h-full flex items-end pb-1 px-2">
                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-300 w-1/2 rounded-full"></div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
