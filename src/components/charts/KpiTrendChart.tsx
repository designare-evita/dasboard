// src/components/charts/KpiTrendChart.tsx (Vereinfacht)
'use client';

import React, { useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ActiveKpi, KPI_TAB_META } from '@/lib/dashboard-shared';

interface ChartDataPoint {
  date: string;
  value: number;
}

interface KpiTrendChartProps {
  // data prop ist nicht mehr nötig, wenn allChartData vorhanden ist
  // data?: ChartDataPoint[]; 
  activeKpi?: ActiveKpi;
  onKpiChange?: (kpi: ActiveKpi) => void;
  allChartData?: {
    clicks?: ChartDataPoint[];
    impressions?: ChartDataPoint[];
    sessions?: ChartDataPoint[];
    totalUsers?: ChartDataPoint[];
  };
}

const KPI_TABS: ActiveKpi[] = ['clicks', 'impressions', 'sessions', 'totalUsers'];

export default function KpiTrendChart({ 
  // data, // Entfernt
  activeKpi = 'clicks',
  onKpiChange,
  allChartData
}: KpiTrendChartProps) {
  
  const [localActiveKpi, setLocalActiveKpi] = useState<ActiveKpi>(activeKpi);
  
  const currentKpi = onKpiChange ? activeKpi : localActiveKpi;
  const setCurrentKpi = (kpi: ActiveKpi) => {
    if (onKpiChange) {
      onKpiChange(kpi);
    } else {
      setLocalActiveKpi(kpi);
    }
  };

  // ✅ KORREKTUR: Wählt die Daten basierend auf currentKpi aus allChartData aus
  const currentData = allChartData?.[currentKpi] ?? []; // Fallback auf leeres Array
  const currentColor = KPI_TAB_META[currentKpi].color;
  const currentLabel = KPI_TAB_META[currentKpi].title;

  // Type-safe Custom Tooltip
  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
      value: number;
      payload: {
        date: string;
        value: number;
      };
    }>;
  }

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0];
      const dateValue = dataPoint.payload.date;
      
      let formattedDate = dateValue;
      try {
        const parsedDate = new Date(dateValue);
        if (!isNaN(parsedDate.getTime())) {
          formattedDate = format(parsedDate, 'dd. MMM yyyy', { locale: de });
        }
      } catch {
        // Fallback
      }

      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {formattedDate}
          </p>
          <p className="text-lg font-bold" style={{ color: currentColor }}>
            {currentLabel}: {dataPoint.value?.toLocaleString('de-DE') ?? 'N/A'}
          </p>
        </div>
      );
    }
    return null;
  };

  const formatXAxis = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return format(date, 'dd.MM.', { locale: de });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      {/* Tab-Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex items-center justify-between"> {/* NEU: justify-between */}
          <h3 className="text-lg font-semibold text-gray-900 hidden sm:block">
            KPI Trend
          </h3>
          <nav className="flex -mb-px space-x-4 sm:space-x-8 overflow-x-auto" aria-label="KPI Tabs">
            {KPI_TABS.map((kpi) => {
              const meta = KPI_TAB_META[kpi];
              const isActive = currentKpi === kpi;
              
              return (
                <button
                  key={kpi}
                  onClick={() => setCurrentKpi(kpi)}
                  className={cn(
                    "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    isActive
                      ? "border-current text-gray-900"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                  style={isActive ? { borderColor: meta.color, color: meta.color } : {}}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {meta.title}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Chart */}
      {currentData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={currentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxis}
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => value.toLocaleString('de-DE')}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={currentColor}
              strokeWidth={2}
              dot={{ fill: currentColor, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-gray-500">
          <p>Keine Daten für {currentLabel} verfügbar</p>
        </div>
      )}
    </div>
  );
}
