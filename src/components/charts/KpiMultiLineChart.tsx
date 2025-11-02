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
import { KPI_TAB_META } from '@/lib/dashboard-shared'; // Wir nutzen deine Farbdefinitionen

// Typ für die Eingangs-Datenpunkte
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

// ✅ KORREKTUR 1: Ein Typ nur für die KPI-Keys (die 'number' erwarten)
type KpiKey = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

// Typ für die Props der Komponente
interface KpiMultiLineChartProps {
  allChartData?: {
    clicks?: ChartDataPoint[];
    impressions?: ChartDataPoint[];
    sessions?: ChartDataPoint[];
    totalUsers?: ChartDataPoint[];
  };
}

// Typen für den Custom Tooltip
interface TooltipPayloadEntry {
  stroke: string;
  name: string; 
  value: number;
  payload: CombinedChartData; 
  dataKey: string; 
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string; 
}

/**
 * CustomTooltip, der alle vier Werte anzeigt
 */
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length && label) {
    const originalDate = payload[0].payload.date; 
    
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900 mb-2">
          {format(new Date(originalDate), 'dd. MMM yyyy', { locale: de })}
        </p>
        <ul className="space-y-1">
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
    if (dateStr.includes('-')) {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return format(date, 'dd.MM.', { locale: de });
    }
    return dateStr; 
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

    // Helfer, um ein KPI-Array in die Map einzufügen
    // ✅ KORREKTUR 2: kpiName ist jetzt vom Typ KpiKey
    const processKpi = (kpiData: ChartDataPoint[] | undefined, kpiName: KpiKey) => {
      if (!kpiData) return;
      for (const point of kpiData) {
        // Expliziter Typ für 'entry' hilft TypeScript
        const entry: Partial<CombinedChartData> & { date: string } = 
          dataMap.get(point.date) || { date: point.date };
        
        // ✅ KORREKTUR 3: Diese Zuweisung ist jetzt typsicher
        entry[kpiName] = point.value; 
        
        dataMap.set(point.date, entry);
      }
    };

    // Alle KPIs verarbeiten
    processKpi(allChartData.clicks, 'clicks');
    processKpi(allChartData.impressions, 'impressions');
    processKpi(allChartData.sessions, 'sessions');
    processKpi(allChartData.totalUsers, 'totalUsers');

    return Array.from(dataMap.values())
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
      .map(d => ({
        // Standardwerte für fehlende Datenpunkte (verhindert Lücken im Chart)
        clicks: d.clicks,
        impressions: d.impressions,
        sessions: d.sessions,
        totalUsers: d.totalUsers,
        ...d,
        date: d.date!, 
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
              dataKey="formattedDate" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => value.toLocaleString('de-DE')}
            />
            
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
              connectNulls // Verbindet Lücken, falls Daten fehlen
            />
            <Line 
              type="monotone" 
              dataKey="impressions" 
              name={KPI_TAB_META.impressions.title}
              stroke={KPI_TAB_META.impressions.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="sessions" 
              name={KPI_TAB_META.sessions.title}
              stroke={KPI_TAB_META.sessions.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="totalUsers" 
              name={KPI_TAB_META.totalUsers.title}
              stroke={KPI_TAB_META.totalUsers.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
              connectNulls
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
