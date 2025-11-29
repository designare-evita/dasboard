// src/components/tableau-kpi-card.tsx
'use client';

import React, { useState } from 'react';
import { ArrowUp, ArrowDown, InfoCircle } from 'react-bootstrap-icons'; // InfoCircle hinzugefügt
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ChartPoint } from '@/lib/dashboard-shared';
import { cn } from '@/lib/utils';

interface TableauKpiCardProps {
  title: string;
  subtitle?: string;
  value: number;
  valueLabel?: string;
  change?: number;
  changeLabel?: string;
  isLoading?: boolean;
  data?: ChartPoint[];
  color?: string;
  error?: string | null;
  className?: string;
  barComparison?: {
    current: number;
    previous: number;
  };
  goalMet?: boolean;
  formatValue?: (value: number) => string;
  description?: string; // ✅ NEU: Beschreibungstext
}

export default function TableauKpiCard({
  title,
  subtitle = 'vs YTD PY',
  value,
  valueLabel = 'Latest Month',
  change,
  changeLabel = 'Veränderung',
  isLoading = false,
  data,
  color = '#3b82f6',
  error = null,
  className = '',
  barComparison,
  goalMet,
  formatValue = (v) => new Intl.NumberFormat('de-DE').format(v),
  description // ✅ NEU
}: TableauKpiCardProps) {

  const isPositive = change !== undefined && change >= 0;
  const isNeutral = change === 0;

  // Kleines Helfer-Component für den Tooltip
  const InfoIcon = () => {
    if (!description) return null;
    
    return (
      <div className="group relative ml-2 inline-flex items-center">
        <InfoCircle 
          size={13} 
          className="text-gray-400 hover:text-blue-600 cursor-help transition-colors"
        />
        {/* Tooltip Box */}
        <div className="absolute left-1/2 bottom-full mb-2 w-48 -translate-x-1/2 p-3 
                        bg-gray-800 text-white text-xs rounded-lg shadow-xl 
                        opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                        transition-all duration-200 z-50 pointer-events-none text-center">
          {description}
          {/* Kleiner Pfeil nach unten */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn(
      "bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col h-[180px] relative overflow-visible transition-all hover:shadow-md",
      className
    )}>
      
      {/* HEADER: Title & Date & Info */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col">
          <div className="flex items-center">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">
              {title}
            </h3>
            {/* ✅ Info Icon hier einfügen */}
            <InfoIcon />
          </div>
          <span className="text-[10px] text-gray-400 font-medium mt-0.5">
            {subtitle}
          </span>
        </div>
        
        {/* Trend Indicator (Pill Shape) */}
        {!isLoading && !error && change !== undefined && (
          <div className={cn(
            "flex items-center px-2 py-1 rounded-full text-[10px] font-bold border",
            isNeutral 
              ? "bg-gray-50 text-gray-600 border-gray-200"
              : isPositive 
                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                : "bg-rose-50 text-rose-700 border-rose-100"
          )}>
            {isNeutral ? (
              <span>-</span>
            ) : isPositive ? (
              <ArrowUp className="mr-1" size={10} />
            ) : (
              <ArrowDown className="mr-1" size={10} />
            )}
            {change > 0 && '+'}{change.toFixed(1)}%
          </div>
        )}
      </div>

      {/* CONTENT: Value & Chart */}
      <div className="flex-grow flex flex-col justify-end relative">
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-6 bg-gray-100 rounded w-1/2"></div>
            <div className="h-10 bg-gray-50 rounded w-full"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-rose-500">
            <span className="text-xs text-center">{error}</span>
          </div>
        ) : (
          <>
            {/* Main Value */}
            <div className="text-2xl font-bold text-gray-900 mb-2 z-10 relative">
              {formatValue(value)}
            </div>

            {/* Sparkline Chart */}
            <div className="h-[50px] -mx-2 opacity-60 hover:opacity-100 transition-opacity">
              {data && data.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id={`tableau-grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={color}
                      strokeWidth={2}
                      fill={`url(#tableau-grad-${title})`}
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                 // Fallback Visualisierung wenn keine History-Daten da sind
                <div className="h-full flex items-end pb-1 px-2">
                  <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: '50%',
                        backgroundColor: color,
                        opacity: 0.3
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Goal Line / Comparison Bar (Optional Visual) */}
            {barComparison && (
               <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-gray-300" 
                    style={{ width: `${Math.min((barComparison.previous / (barComparison.current + barComparison.previous)) * 100, 100)}%` }}
                  />
                  <div 
                    className="h-full" 
                    style={{ 
                      width: `${Math.min((barComparison.current / (barComparison.current + barComparison.previous)) * 100, 100)}%`,
                      backgroundColor: goalMet ? '#10b981' : color // Grün wenn Ziel erreicht
                    }}
                  />
               </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
