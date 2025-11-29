// src/components/charts/TableauPieChart.tsx
'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  PieLabelRenderProps,
} from 'recharts';
import { ChartEntry } from '@/lib/dashboard-shared';
import { cn } from '@/lib/utils';
import { ArrowRepeat, ExclamationTriangleFill } from 'react-bootstrap-icons';

// ✅ Definiere die exakte Farbpalette der KPI Cards
const KPI_COLORS = [
  '#3b82f6', // Blue (Sessions, Users)
  '#8b5cf6', // Purple (Impressions, Engagement Time)
  '#10b981', // Emerald (Conversions) -> Hell, braucht dunklen Text
  '#f59e0b', // Amber (Bounce Rate) -> Hell, braucht dunklen Text
  '#ec4899', // Pink (Engagement Rate)
  '#6366f1', // Indigo (New Users)
  '#06b6d4', // Cyan -> Hell, braucht dunklen Text
];

// Farben, die dunklen Text erfordern
const LIGHT_COLORS = ['#f59e0b', '#06b6d4', '#10b981', '#fcd34d'];

interface TableauPieChartProps {
  data?: ChartEntry[];
  title: string;
  isLoading?: boolean;
  className?: string;
  error?: string | null;
}

interface TooltipPayload {
  payload: ChartEntry;
  percent?: number;
  value: number;
  fill?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const rawPercent = payload[0].percent;
    
    let percentValue = 0;
    if (typeof rawPercent === 'number' && !isNaN(rawPercent)) {
      percentValue = rawPercent * 100;
    }
    
    const color = payload[0].fill || data.fill;

    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <div 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-medium text-gray-500">{data.name}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-900">
            {new Intl.NumberFormat('de-DE').format(data.value)}
          </span>
          <span className="text-xs font-medium text-gray-400">
            ({percentValue.toFixed(1)}%)
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Label mit Kontrast-Check
const renderCustomLabel = (props: PieLabelRenderProps & { index?: number }) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, index } = props;

  // Sicherheitscheck
  if (typeof midAngle !== 'number') return null;
  
  // Zeige Label nur wenn > 5% Platz ist
  if ((percent || 0) < 0.05) return null;

  const RADIAN = Math.PI / 180;
  // Radius: Mittig im Segment positionieren
  const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
  
  const x = Number(cx) + radius * Math.cos(-midAngle * RADIAN);
  const y = Number(cy) + radius * Math.sin(-midAngle * RADIAN);

  // Farbe ermitteln für Kontrast
  const fillColor = (typeof index === 'number') ? KPI_COLORS[index % KPI_COLORS.length] : '#000';
  const textColor = LIGHT_COLORS.includes(fillColor) ? '#0f172a' : '#ffffff';

  return (
    <text 
      x={x} 
      y={y} 
      fill={textColor} 
      textAnchor="middle" 
      dominantBaseline="central"
      className="text-[11px] font-bold pointer-events-none"
      style={{ textShadow: textColor === '#ffffff' ? '0px 0px 2px rgba(0,0,0,0.3)' : 'none' }}
    >
      {`${((percent || 0) * 100).toFixed(0)}%`}
    </text>
  );
};

export default function TableauPieChart({
  data,
  title,
  isLoading,
  className,
  error
}: TableauPieChartProps) {

  // Daten vorbereiten & Farben zuweisen
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((entry, index) => ({
      ...entry,
      fill: KPI_COLORS[index % KPI_COLORS.length]
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col h-[350px] animate-pulse', className)}>
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="flex-grow flex items-center justify-center">
          <div className="w-48 h-48 bg-gray-200 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
     return (
      <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col h-[350px]', className)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex-grow flex flex-col items-center justify-center text-red-500 gap-2">
          <ExclamationTriangleFill size={24} />
          <p className="text-sm font-medium text-center">{error}</p>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col h-[350px] justify-center items-center', className)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 self-start">{title}</h3>
        <div className="flex-grow flex flex-col items-center justify-center text-gray-400">
           <ArrowRepeat size={24} className="mb-2 opacity-50" />
           <p className="text-sm italic">Keine Daten verfügbar</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col h-[350px] hover:shadow-md transition-shadow', className)}>
      <h3 className="text-lg font-semibold text-gray-900 mb-2 flex-shrink-0">
        {title}
      </h3>
      <div className="flex-grow min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              // ✅ Dickerer Ring für bessere Lesbarkeit
              innerRadius={45} 
              outerRadius={90}
              paddingAngle={2} 
              labelLine={false}
              label={renderCustomLabel}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill} 
                  stroke="#ffffff" 
                  strokeWidth={2} 
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              formatter={(value) => <span className="text-xs text-gray-600 font-medium ml-1">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
