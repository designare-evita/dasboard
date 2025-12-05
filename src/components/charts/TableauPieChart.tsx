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
import { ExclamationTriangleFill } from 'react-bootstrap-icons'; 
import NoDataState from '@/components/NoDataState';
// HINZUGEFÜGT: Imports für Datum
import { format, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

// Farben definieren
const KPI_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
];

const LIGHT_COLORS = ['#f59e0b', '#06b6d4', '#10b981', '#fcd34d'];

interface TableauPieChartProps {
  data?: ChartEntry[];
  title: string;
  isLoading?: boolean;
  className?: string;
  error?: string | null;
  dateRange?: string; // HINZUGEFÜGT: Prop für Datum
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
  totalValue?: number;
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, totalValue }: CustomTooltipProps) => {
  if (active && payload && payload.length && totalValue) {
    const data = payload[0];
    const percent = (data.value / totalValue) * 100;
    
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-gray-100 p-3 rounded-xl shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.fill }} />
          <span className="font-semibold text-gray-700 text-sm">{data.payload.name}</span>
        </div>
        <div className="flex items-baseline gap-2 pl-4">
          <span className="text-lg font-bold text-gray-900">
            {data.value.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-gray-500">
            ({percent.toFixed(1)}%)
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Label Render
const renderCustomLabel = (props: PieLabelRenderProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  const RADIAN = Math.PI / 180;
  const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
  const x = Number(cx) + radius * Math.cos(-midAngle * RADIAN);
  const y = Number(cy) + radius * Math.sin(-midAngle * RADIAN);

  if ((percent || 0) < 0.05) return null;

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor={x > Number(cx) ? 'start' : 'end'} 
      dominantBaseline="central"
      className="text-[10px] font-bold pointer-events-none"
    >
      {`${((percent || 0) * 100).toFixed(0)}%`}
    </text>
  );
};

export default function TableauPieChart({
  data,
  title,
  isLoading = false,
  className,
  error,
  dateRange = '30d' // Standardwert
}: TableauPieChartProps) {

  // HINZUGEFÜGT: Berechnung des Datums für die Anzeige
  const formattedDateRange = useMemo(() => {
    const end = new Date();
    let start = subDays(end, 30); // Default

    switch (dateRange) {
      case '7d': start = subDays(end, 7); break;
      case '30d': start = subDays(end, 30); break;
      case '3m': start = subMonths(end, 3); break;
      case '6m': start = subMonths(end, 6); break;
      case '12m': start = subMonths(end, 12); break;
      default: start = subDays(end, 30);
    }
    return `${format(start, 'dd.MM.yyyy', { locale: de })} - ${format(end, 'dd.MM.yyyy', { locale: de })}`;
  }, [dateRange]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((entry, index) => ({
        ...entry,
        fill: KPI_COLORS[index % KPI_COLORS.length]
      }));
  }, [data]);

  const totalValue = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);

  if (isLoading) {
    return (
      <div className={cn('card-glass p-6 flex flex-col h-[350px]', className)}>
        <div className="h-6 w-1/3 bg-gray-100 rounded mb-4 animate-pulse" />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-40 h-40 rounded-full border-4 border-gray-100 border-t-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
     return (
        <div className={cn('card-glass p-6 flex flex-col h-[350px]', className)}>
           <h3 className="text-lg font-semibold text-gray-900 mb-2 flex-shrink-0">
             {title}
           </h3>
           <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-400">
             <ExclamationTriangleFill size={24} className="mb-2 text-amber-500/50" />
             <p className="text-sm">Daten konnten nicht geladen werden</p>
           </div>
        </div>
     );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col h-[350px]', className)}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex-shrink-0">
          {title}
        </h3>
        <div className="flex-grow relative">
           <NoDataState message="Keine Daten für diesen Zeitraum" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col h-[350px] hover:shadow-md transition-shadow', className)}>
      <h3 className="text-lg font-semibold text-gray-900 flex-shrink-0">
        {title}
      </h3>
      
      {/* HINZUGEFÜGT: Quelle und Datum Block (Design wie Top Landingpages) */}
      <div className="text-[11px] text-gray-500 mt-1 mb-4 flex items-center gap-2">
        <span className="font-medium bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">Quelle: GA4</span>
        <span className="text-gray-400">•</span>
        <span>{formattedDateRange}</span>
      </div>

      <div className="flex-grow min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
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
            
            <Tooltip content={<CustomTooltip totalValue={totalValue} />} />
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
