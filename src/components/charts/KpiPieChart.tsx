// src/components/charts/KpiPieChart.tsx
'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartEntry } from '@/lib/dashboard-shared';
import { cn } from '@/lib/utils';
import { ArrowRepeat } from 'react-bootstrap-icons';

// Props für das wiederverwendbare Diagramm
interface KpiPieChartProps {
  data?: ChartEntry[];
  title: string;
  isLoading?: boolean;
  className?: string;
}

// Typen für Tooltip
interface TooltipPayload {
  payload: ChartEntry;
  percent: number;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

// Benutzerdefinierter Tooltip
const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const percent = payload[0].percent;
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold" style={{ color: data.fill }}>
          {data.name}
        </p>
        <p className="text-xs text-gray-700">
          Sitzungen: {data.value.toLocaleString('de-DE')} (
          {(percent * 100).toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

// Typen für Legend
interface LegendPayloadItem {
  value: string;
  color: string;
  payload: ChartEntry;
}

interface CustomLegendProps {
  payload?: LegendPayloadItem[];
}

// Benutzerdefiniertes Legend
const CustomLegend = (props: CustomLegendProps) => {
  const { payload } = props;
  return (
    <ul className="flex flex-col gap-1.5 pt-4">
      {payload?.map((entry: LegendPayloadItem, index: number) => (
        <li key={`item-${index}`} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-gray-700 truncate">
            {entry.value} ({entry.payload.value.toLocaleString('de-DE')})
          </span>
        </li>
      ))}
    </ul>
  );
};

export default function KpiPieChart({
  data,
  title,
  isLoading = false,
  className,
}: KpiPieChartProps) {
  
  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-white rounded-lg shadow-md border border-gray-200 p-6 flex flex-col h-[350px] justify-center items-center',
          className
        )}
      >
        <ArrowRepeat className="animate-spin text-indigo-600 mb-2" size={24} />
        <p className="text-sm text-gray-500">Lade {title}...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          'bg-white rounded-lg shadow-md border border-gray-200 p-6 flex flex-col h-[350px] justify-center items-center',
          className
        )}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-sm text-gray-500 italic text-center">
          Keine Daten für {title} verfügbar.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-md border border-gray-200 p-6 flex flex-col h-[350px]',
        className
      )}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex-shrink-0">
        {title}
      </h3>
      <div className="flex-grow min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="80%"
              labelLine={false}
              label={({ percent }: { percent: number }) => `${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} layout="vertical" align="right" verticalAlign="middle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
