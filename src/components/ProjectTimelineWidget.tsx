// src/components/ProjectTimelineWidget.tsx
'use client';

import useSWR from 'swr';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Label,
} from 'recharts';
import { 
  BarChart, 
  CalendarCheck, 
  CalendarX, // Icon für Enddatum
  CheckCircle, 
  ClockHistory, 
  GraphUpArrow, 
  HourglassSplit,
  BoxSeam
} from 'react-bootstrap-icons';
import { addMonths, format, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';

// ... (Interfaces und Fetcher bleiben unverändert)
interface StatusCounts {
  'Offen': number;
  'In Prüfung': number;
  'Gesperrt': number;
  'Freigegeben': number;
  'Total': number;
}
interface GscDataPoint {
  date: string;
  value: number;
}
interface TimelineData {
  project: {
    startDate: string;
    durationMonths: number;
  };
  progress: {
    counts: StatusCounts;
    percentage: number;
  };
  gscImpressionTrend: GscDataPoint[];
}
interface TooltipPayload {
  dataKey: string;
  value: number;
}
interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    return res.json().then(errorData => {
      throw new Error(errorData.message || 'Fehler beim Laden der Timeline-Daten.');
    });
  }
  return res.json();
});

const formatImpressions = (value: number) => {
  return new Intl.NumberFormat('de-DE').format(value);
};
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const dateLabel = typeof label === 'number' ? new Date(label) : (typeof label === 'string' ? new Date(label) : new Date());
    return (
      <div className="bg-white p-3 shadow-md rounded border border-gray-200">
        <p className="font-bold text-gray-800">{format(dateLabel, 'd. MMMM yyyy', { locale: de })}</p>
        <p className="text-sm text-indigo-600">
          Reichweite: {formatImpressions(payload.find((p) => p.dataKey === 'impressions')?.value || 0)}
        </p>
      </div>
    );
  }
  return null;
};

interface ProjectTimelineWidgetProps {
  projectId?: string;
  domain?: string | null;
}

export default function ProjectTimelineWidget({ projectId, domain }: ProjectTimelineWidgetProps) {
  const apiUrl = projectId 
    ? `/api/project-timeline?projectId=${projectId}` 
    : '/api/project-timeline';
  
  const { data, error, isLoading } = useSWR<TimelineData>(apiUrl, fetcher);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 min-h-[300px] flex items-center justify-center print-hidden">
        <HourglassSplit size={30} className="animate-spin text-indigo-500" />
        <p className="ml-3 text-gray-600">Lade Projekt-Timeline...</p>
      </div>
    );
  }

  if (error || !data || !data.project) return null;

  const { project, progress, gscImpressionTrend } = data;
  const { counts, percentage } = progress;
  const startDate = project?.startDate ? new Date(project.startDate) : new Date();
  const duration = project?.durationMonths || 6;
  const endDate = addMonths(startDate, duration);
  const today = new Date();
  const totalProjectDays = differenceInCalendarDays(endDate, startDate) || 1; 
  const elapsedProjectDays = differenceInCalendarDays(today, startDate);
  const timeElapsedPercentage = Math.max(0, Math.min(100, (elapsedProjectDays / totalProjectDays) * 100));
  
  const chartData = (gscImpressionTrend || []).map(d => ({
    date: new Date(d.date).getTime(), 
    impressions: d.value,
  }));
  const xTicks = [ startDate.getTime(), today.getTime(), endDate.getTime() ];
  
  return (
    // HIER: Klasse "print-timeline" hinzugefügt
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 print-timeline">
      
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 flex-wrap">
        <BarChart size={20} />
        <span>Projekt-Fortschritt</span>
        {domain && (
          <span className="text-indigo-600 font-semibold">: {domain}</span>
        )}
      </h2>

      {/* Fortschritts-Balken */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">Landingpage-Freigaben</span>
          <span className="text-lg font-bold text-indigo-600">{counts.Freigegeben} / {counts.Total}</span>
        </div>
        {counts.Total > 0 ? (
          <div className="flex w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div className="bg-green-500" style={{ width: `${(counts.Freigegeben / counts.Total) * 100}%` }} />
            <div className="bg-yellow-500" style={{ width: `${(counts['In Prüfung'] / counts.Total) * 100}%` }} />
            <div className="bg-red-500" style={{ width: `${(counts.Gesperrt / counts.Total) * 100}%` }} />
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Noch keine Landingpages.</p>
        )}
      </div>

      {/* KPI-Übersicht */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 text-center">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <CheckCircle size={24} className="text-green-600 mx-auto mb-1" />
          <p className="text-xl font-bold">{Math.round(percentage)}%</p>
          <p className="text-xs text-gray-600">Freigabe-Quote</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <ClockHistory size={24} className="text-blue-600 mx-auto mb-1" />
          <p className="text-xl font-bold">{Math.round(timeElapsedPercentage)}%</p>
          <p className="text-xs text-gray-600">Zeit Verbraucht</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <CalendarCheck size={24} className="text-gray-700 mx-auto mb-1" />
          <p className="text-xl font-bold">{format(startDate, 'dd.MM.yy')}</p>
          <p className="text-xs text-gray-600">Start</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <CalendarX size={24} className="text-gray-700 mx-auto mb-1" />
          <p className="text-xl font-bold">{format(endDate, 'dd.MM.yy')}</p>
          <p className="text-xs text-gray-600">Ende</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <BoxSeam size={24} className="text-gray-700 mx-auto mb-1" />
          <p className="text-xl font-bold">{counts.Total}</p>
          <p className="text-xs text-gray-600">LPs Gesamt</p>
        </div>
      </div>

      {/* Reichweiten-Chart */}
      <h3 className="text-lg font-semibold mb-4 mt-8 pt-4 border-t flex items-center gap-2">
        <GraphUpArrow size={18} /> Reichweite (Impressionen)
      </h3>
      {chartData.length > 0 ? (
        <div className="w-full h-80 print-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                fontSize={11}
                tickFormatter={(timestamp) => format(new Date(timestamp), 'd. MMM', { locale: de })}
                domain={[startDate.getTime(), endDate.getTime()]}
                type="number"
                ticks={xTicks}
              />
              <YAxis
                yAxisId="left"
                stroke="#4f46e5"
                fontSize={11}
                tickFormatter={(value) => new Intl.NumberFormat('de-DE', { notation: 'compact' }).format(value)}
              />
              {/* Tooltip im Druck ausblenden, falls er stört, aber meist ok */}
              <Area type="monotone" dataKey="impressions" stroke="#4f46e5" fill="#c7d2fe" strokeWidth={2} dot={false} yAxisId="left" />
              <ReferenceLine x={today.getTime()} stroke="#fb923c" strokeDasharray="4 4" strokeWidth={2}>
                <Label value="Heute" position="top" fill="#fb923c" fontSize={11} />
              </ReferenceLine>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic text-center py-8">Keine Daten.</p>
      )}
    </div>
  );
}
