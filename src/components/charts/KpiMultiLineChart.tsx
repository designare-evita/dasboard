// src/components/charts/KpiMultiLineChart.tsx
'use client';

import React, { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { KPI_TAB_META } from '@/lib/dashboard-shared';

// Typ für die Eingangs-Datenpunkte (aus KpiTrendChart.tsx)
interface ChartDataPoint {
  date: string;
  value: number;
}

// Typ für die Daten, die wir an Recharts übergeben
interface CombinedChartData {
  date: string;
  clicks?: number;
  impressions?: number;
  sessions?: number;
  totalUsers?: number;
  formattedDate: string; 
}

// Typ für die Props der Komponente
interface KpiMultiLineChartProps {
  allChartData?: {
    clicks?: ChartDataPoint[];
    impressions?: ChartDataPoint[];
    sessions?: ChartDataPoint[];
    totalUsers?: ChartDataPoint[];
  };
}

// ✅ KORREKTUR: Typen für den Custom Tooltip
interface TooltipPayloadEntry {
  stroke: string;
  name: string; // Der "name" prop von <Line />
  value: number;
  payload: CombinedChartData; 
  dataKey: string; 
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string; // Dies ist der x-Achsen-Wert (unser formattedDate)
}

/**
 * CustomTooltip, der alle vier Werte anzeigt
 * ✅ KORREKTUR: 'any' durch 'CustomTooltipProps' ersetzt
 */
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length && label) {
    // Wir verwenden das 'date'-Feld aus dem Payload, da 'label' formatiert ist
    const originalDate = payload[0].payload.date; 
    
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900 mb-2">
          {format(new Date(originalDate), 'dd. MMM yyyy', { locale: de })}
        </p>
        <ul className="space-y-1">
          {/* ✅ KORREKTUR: 'any' entfernt, 'entry' wird korrekt hergeleitet */}
          {payload.map((entry) => (
            <li key={entry.dataKey} style={{ color: entry.stroke }}>
              <span className="text-sm font-medium">
                {entry.name}: {entry.value?.toLocaleString('de-DE')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
};

/**
 * Formatiert das Datum für die X-Achse
 */
const formatXAxis = (dateStr: string) => {
  try {
    // Annahme: dateStr ist bereits 'dd.MM.'
    // Wenn es ein volles Datum ist, formatiere es
    if (dateStr.includes('-')) {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return format(date, 'dd.MM.', { locale: de });
    }
    return dateStr; // Gebe das bereits formatierte Datum zurück
  } catch {
    return dateStr;
  }
};


export default function KpiMultiLineChart({ allChartData }: KpiMultiLineChartProps) {
  
  /**
   * 1. DATEN-TRANSFORMATION
   */
  const combinedData = useMemo((): CombinedChartData[] => {
    if (!allChartData) return [];

    const dataMap = new Map<string, Partial<CombinedChartData>>();

    const processKpi = (kpiData: ChartDataPoint[] | undefined, kpiName: keyof CombinedChartData) => {
      if (!kpiData) return;
      for (const point of kpiData) {
        const entry = dataMap.get(point.date) || { date: point.date };
        entry[kpiName] = point.value;
        dataMap.set(point.date, entry);
      }
    };

    processKpi(allChartData.clicks, 'clicks');
    processKpi(allChartData.impressions, 'impressions');
    processKpi(allChartData.sessions, 'sessions');
    processKpi(allChartData.totalUsers, 'totalUsers');

    return Array.from(dataMap.values())
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
      .map(d => ({
        ...d,
        date: d.date!, 
        // WICHTIG: Wir übergeben das formatierte Datum für die X-Achse
        formattedDate: formatXAxis(d.date!) 
      }));
      
  }, [allChartData]);


  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">KPI Trend</h3>
      
      {/* 2. CHART-ANZEIGE */}
      {combinedData.length > 0 ? (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={combinedData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="formattedDate" // Formatiertes Datum für die Achse
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => value.toLocaleString('de-DE')}
            />
            
            {/* 3. TOOLTIP & LEGENDE */}
            <Tooltip content={<CustomTooltip />} />
            <Legend /> 

            {/* 4. VIER <Line /> KOMPONENTEN */}
            <Line 
              type="monotone" 
              dataKey="clicks" 
              name={KPI_TAB_META.clicks.title}
              stroke={KPI_TAB_META.clicks.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="impressions" 
              name={KPI_TAB_META.impressions.title}
              stroke={KPI_TAB_META.impressions.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="sessions" 
              name={KPI_TAB_META.sessions.title}
              stroke={KPI_TAB_META.sessions.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="totalUsers" 
              name={KPI_TAB_META.totalUsers.title}
              stroke={KPI_TAB_META.totalUsers.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[350px] flex items-center justify-center text-gray-500">
          <p>Keine Chart-Daten verfügbar</p>
        </div>
      )}
    </div>
  );
}
