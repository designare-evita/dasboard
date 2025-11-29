// src/components/tableau-kpi-card.tsx
'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ChartPoint } from '@/types/dashboard';

interface TableauKpiCardProps {
  title: string;
  subtitle?: string; // z.B. "vs YTD PY"
  value: number;
  valueLabel?: string; // z.B. "Latest Month"
  change?: number;
  changeLabel?: string; // z.B. "MoM Δ"
  isLoading?: boolean;
  data?: ChartPoint[];
  color?: string;
  error?: string | null;
  className?: string;
  barComparison?: {
    current: number;
    previous: number;
  };
  goalMet?: boolean; // Für "Goal met" / "Goal not met"
  formatValue?: (value: number) => string; // Custom Formatter (z.B. für %)
}

export default function TableauKpiCard({
  title,
  subtitle = 'vs YTD PY',
  value,
  valueLabel = 'Latest Month',
  change,
  changeLabel = 'MoM Δ',
  isLoading = false,
  data,
  color = '#3b82f6',
  error = null,
  className = '',
  barComparison,
  goalMet,
  formatValue = (v) => v.toLocaleString('de-DE')
}: TableauKpiCardProps) {

  const isPositive = change !== undefined && change >= 0;

  // Loading State
  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          <div className="h-6 bg-gray-200 rounded w-full"></div>
          <div className="h-8 bg-gray-200 rounded w-2/3"></div>
          <div className="h-16 bg-gray-100 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 transition-all duration-300 hover:shadow-md relative overflow-hidden ${className}`}>
      
      {/* Hintergrund-Balken (wie im Tableau) */}
      {barComparison && (
        <div 
          className="absolute left-0 top-0 bottom-0 opacity-15"
          style={{ 
            width: `${Math.min((barComparison.current / Math.max(barComparison.current, barComparison.previous)) * 100, 100)}%`,
            backgroundColor: color 
          }}
        />
      )}

      <div className="relative z-10">
        
        {/* Goal Indicator */}
        {goalMet !== undefined && (
          <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${goalMet ? 'text-green-600' : 'text-red-600'}`}>
            {goalMet ? 'Ziel erreicht' : 'Ziel nicht erreicht'}
          </div>
        )}

        {/* Titel */}
        <div className="mb-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide leading-tight">
            {title}
          </h3>
          <div className="text-[10px] text-gray-400 font-normal">{subtitle}</div>
        </div>

        {/* Bar Comparison (wie Tableau) */}
        {barComparison && !error && (
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="flex-1 h-6 rounded-sm flex items-center justify-end pr-2 text-white text-xs font-bold"
              style={{ backgroundColor: color }}
            >
              {formatValue(barComparison.current)}
            </div>
            <div className="w-px h-6 bg-gray-300"></div>
            <div className="w-20 text-right text-xs text-gray-400">
              {formatValue(barComparison.previous)}
            </div>
          </div>
        )}

        {error ? (
          // Error State
          <div className="flex flex-col justify-center py-4">
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
            {/* Hauptwert */}
            <div className="mb-1">
              <div className="text-2xl font-bold text-gray-900 tracking-tight">
                {formatValue(value)}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                {valueLabel}
              </div>
            </div>

            {/* Change Badge */}
            {change !== undefined && (
              <div className="flex items-center gap-2 mb-3">
                <div className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{change.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">
                  {changeLabel}
                </div>
              </div>
            )}

            {/* Sparkline Chart */}
            <div className="h-[60px] -mx-2">
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
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
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
          </>
        )}
      </div>
    </div>
  );
}
