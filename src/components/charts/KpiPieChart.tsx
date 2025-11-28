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
  PieLabelRenderProps,
} from 'recharts';
import { ChartEntry } from '@/lib/dashboard-shared';
import { cn } from '@/lib/utils';
// +++ KORREKTUR: Icons für Laden & Fehler importiert +++
import { ArrowRepeat, ExclamationTriangleFill } from 'react-bootstrap-icons';

// Props für das wiederverwendbare Diagramm
interface KpiPieChartProps {
  data?: ChartEntry[];
  title: string;
  isLoading?: boolean;
  className?: string;
  error?: string | null; // +++ KORREKTUR: error-Prop hinzugefügt +++
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

// Benutzerdefinierter Tooltip (bleibt gleich)
const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const rawPercent = payload[0].percent;
    
    let percentValue = 0;
    if (typeof rawPercent === 'number' && !isNaN(rawPercent)) {
      if (rawPercent >= 0 && rawPercent <= 1) {
        percentValue = rawPercent * 100;
      } else {
        percentValue = rawPercent;
      }
    }
    
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold" style={{ color: data.fill }}>
          {data.name}
        </p>
        <p className="text-xs text-gray-700">
          Sitzungen: {data.value.toLocaleString('de-DE')} (
          {percentValue.toFixed(1)}%)
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

// Benutzerdefiniertes Legend (bleibt gleich)
const CustomLegend = (props: CustomLegendProps) => {
  const { payload } = props;
  const total = payload?.reduce((sum, entry) => sum + (entry.payload?.value || 0), 0) || 0;
  
  return (
    <ul className="flex flex-col gap-1.5 pt-4">
      {payload?.map((entry: LegendPayloadItem, index: number) => {
        const percent = total > 0 ? ((entry.payload.value / total) * 100).toFixed(1) : '0';
        return (
          <li key={`item-${index}`} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-gray-700 truncate">
              {entry.value} ({entry.payload.value.toLocaleString('de-DE')} - {percent}%)
            </span>
          </li>
        );
      })}
    </ul>
  );
};

// Label-Rendering (bleibt gleich)
const renderCustomLabel = (props: PieLabelRenderProps): string => {
  const rawPercent = props.percent;
  if (typeof rawPercent === 'number' && !isNaN(rawPercent)) {
    if (rawPercent >= 0 && rawPercent <= 1) {
      const percentValue = rawPercent * 100;
      return `${Math.round(percentValue)}%`;
    }
    return `${Math.round(rawPercent)}%`;
  }
  
  if (props.value && props.payload && Array.isArray(props.payload)) {
    const total = props.payload.reduce((sum: number, item: ChartEntry) => {
      return sum + (typeof item.value === 'number' ? item.value : 0);
    }, 0);
    if (total > 0 && typeof props.value === 'number') {
      const manualPercent = (props.value / total) * 100;
      return `${Math.round(manualPercent)}%`;
    }
  }
  return '0%';
};

export default function KpiPieChart({
  data,
  title,
  isLoading = false,
  className,
  error = null // +++ KORREKTUR: error-Prop empfangen +++
}: KpiPieChartProps) {
  
  // (Debug-Log bleibt gleich)
  React.useEffect(() => {
    if (data && data.length > 0) {
      const total = data.reduce((sum, item) => sum + item.value, 0);
      data.forEach(item => {
        const percent = (item.value / total) * 100;
      });
    }
  }, [data]);
  
  // (isLoading-Zustand bleibt gleich)
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

  // +++ KORREKTUR: Fehlerzustand hinzugefügt +++
  if (error) {
    return (
      <div
        className={cn(
          'bg-white rounded-lg shadow-md border border-gray-200 p-6 flex flex-col h-[350px] justify-center items-center',
          className
        )}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4 absolute top-6 left-6">{title}</h3>
        <div className="flex flex-col items-center justify-center text-center text-red-700">
          <ExclamationTriangleFill className="text-red-500 w-8 h-8 mb-3" />
          <p className="text-sm font-semibold">Fehler bei GA4-Daten</p>
          <p className="text-xs text-gray-500 mt-1" title={error}>
            {title} konnten nicht geladen werden.
          </p>
        </div>
      </div>
    );
  }

  // (Leer-Zustand bleibt gleich)
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

  // (Erfolgs-Zustand bleibt gleich)
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
              outerRadius="70%"
              labelLine={false}
              label={renderCustomLabel}
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
