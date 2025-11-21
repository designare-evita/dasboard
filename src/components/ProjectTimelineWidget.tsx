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
  CalendarX, 
  CheckCircle, 
  ClockHistory, 
  GraphUpArrow, 
  HourglassSplit,
  BoxSeam
} from 'react-bootstrap-icons';
import { addMonths, format, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils'; // Sicherstellen, dass cn verfügbar ist

// Interfaces
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
      <div className="bg-white p-3 shadow-md rounded border border-gray-200 text-xs">
        <p className="font-bold text-gray-800 mb-1">{format(dateLabel, 'd. MMMM yyyy', { locale: de })}</p>
        <p className="text-sm text-indigo-600">
          Reichweite: <span className="font-semibold">{formatImpressions(payload.find((p) => p.dataKey === 'impressions')?.value || 0)}</span>
        </p>
      </div>
    );
  }
  return null;
};

// Benutzerdefinierte Tick-Komponente für die X-Achse
// Hebt Start, Ende und Heute hervor
const CustomXAxisTick = (props: any) => {
  const { x, y, payload, todayTime } = props;
  const dateValue = payload.value;
  
  let labelText = format(new Date(dateValue), 'dd.MM.yy');
  let fontWeight = 'normal';
  let fill = '#6b7280';
  let isToday = false;

  // Prüfen, ob es "Heute" ist (mit kleiner Toleranz für Uhrzeiten)
  if (Math.abs(dateValue - todayTime) < 86400000) {
    labelText = 'HEUTE';
    fontWeight = 'bold';
    fill = '#ea580c'; // Orange für Heute
    isToday = true;
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={0} 
        y={0} 
        dy={16} 
        textAnchor="middle" 
        fill={fill} 
        fontSize={12} 
        fontWeight={fontWeight}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {labelText}
      </text>
    </g>
  );
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
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 min-h-[300px] flex items-center justify-center">
        <HourglassSplit size={30} className="animate-spin text-indigo-500" />
        <p className="ml-3 text-gray-600">Lade Projekt-Timeline...</p>
      </div>
    );
  }

  if (error || !data || !data.project) return null;

  const { project, progress, gscImpressionTrend } = data;
  const { counts, percentage } = progress;
  
  // Datumsberechnungen
  const startDate = project?.startDate ? new Date(project.startDate) : new Date();
  const duration = project?.durationMonths || 6;
  const endDate = addMonths(startDate, duration);
  const today = new Date();
  
  // Fortschrittsberechnungen
  const totalProjectDays = differenceInCalendarDays(endDate, startDate) || 1; 
  const elapsedProjectDays = differenceInCalendarDays(today, startDate);
  const timeElapsedPercentage = Math.max(0, Math.min(100, (elapsedProjectDays / totalProjectDays) * 100));
  
  // Chart Daten
  const chartData = (gscImpressionTrend || []).map(d => ({
    date: new Date(d.date).getTime(), 
    impressions: d.value,
  }));

  // Ticks für die X-Achse: Start, Heute, Ende
  const xTicks = [ startDate.getTime(), today.getTime(), endDate.getTime() ];
  const todayTime = today.getTime();

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 print-timeline">
      
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 flex-wrap text-gray-900">
        <BarChart size={20} className="text-indigo-600" />
        <span>Projekt-Fortschritt</span>
        {domain && (
          <span className="text-indigo-600 font-semibold">: {domain}</span>
        )}
      </h2>

      {/* --- 1. Fortschritts-Balken (Landingpages) --- */}
      <div className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-semibold text-gray-700">
            Landingpage-Freigaben
          </span>
          <span className="text-lg font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
            {counts.Freigegeben} <span className="text-sm font-normal text-gray-500">/ {counts.Total}</span>
          </span>
        </div>
        {counts.Total > 0 ? (
          <div className="flex w-full h-5 bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200">
            <div
              className="bg-green-500 transition-all duration-1000"
              style={{ width: `${(counts.Freigegeben / counts.Total) * 100}%` }}
              title={`Freigegeben: ${counts.Freigegeben}`}
            ></div>
            <div
              className="bg-yellow-400 transition-all duration-1000"
              style={{ width: `${(counts['In Prüfung'] / counts.Total) * 100}%` }}
              title={`In Prüfung: ${counts['In Prüfung']}`}
            ></div>
            <div
              className="bg-red-500 transition-all duration-1000"
              style={{ width: `${(counts.Gesperrt / counts.Total) * 100}%` }}
              title={`Gesperrt: ${counts.Gesperrt}`}
            ></div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Noch keine Landingpages angelegt.</p>
        )}
        
        {/* Legende */}
        <div className="flex justify-end space-x-4 mt-2 text-[11px] uppercase font-semibold tracking-wide text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Freigegeben</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span> In Prüfung</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 border border-gray-300"></span> Offen</span>
        </div>
      </div>

      {/* --- 2. KPI-Übersicht --- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 text-center">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 transition-colors">
          <CheckCircle size={22} className="text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{Math.round(percentage)}%</p>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Freigabe-Quote</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors">
          <ClockHistory size={22} className="text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{Math.round(timeElapsedPercentage)}%</p>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Zeit Verbraucht</p>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-300 transition-colors">
          <CalendarCheck size={22} className="text-gray-700 mx-auto mb-2" />
          <p className="text-lg font-bold text-gray-900">{format(startDate, 'dd.MM.yy')}</p>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Projekt-Start</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-300 transition-colors">
          <CalendarX size={22} className="text-gray-700 mx-auto mb-2" />
          <p className="text-lg font-bold text-gray-900">{format(endDate, 'dd.MM.yy')}</p>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Projekt-Ende</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-300 transition-colors">
          <BoxSeam size={22} className="text-gray-700 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{counts.Total}</p>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">LPs Gesamt</p>
        </div>
      </div>

      {/* --- 3. Graphen-Titel --- */}
      <div className="border-t pt-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <GraphUpArrow className="text-indigo-600" /> 
            Reichweiten-Entwicklung (Impressionen)
          </h3>
          <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">
            Timeline & Trend
          </span>
        </div>

        {/* --- 4. Reichweiten-Chart (Volle Breite) --- */}
        {chartData.length > 0 ? (
          <div className="w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="timelineGradientMain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                
                {/* X-Achse: Volle Projektlaufzeit mit hervorgehobenen Ticks */}
                <XAxis
                  dataKey="date"
                  type="number"
                  domain={[startDate.getTime(), endDate.getTime()]}
                  ticks={xTicks}
                  stroke="#9ca3af"
                  tick={<CustomXAxisTick todayTime={todayTime} />} // Hier nutzen wir die Custom Komponente
                  interval={0}
                  height={50}
                />
                
                {/* Y-Achse */}
                <YAxis
                  yAxisId="left"
                  stroke="#6b7280"
                  fontSize={11}
                  tickFormatter={(value) => new Intl.NumberFormat('de-DE', { notation: 'compact' }).format(value)}
                  tickLine={false}
                  axisLine={false}
                />
                
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                
                {/* Der eigentliche Trend */}
                <Area
                  type="monotone"
                  dataKey="impressions"
                  yAxisId="left"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fill="url(#timelineGradientMain)"
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }}
                />
                
                {/* Vertikale Linie für "Heute" */}
                <ReferenceLine 
                  x={todayTime} 
                  stroke="#ea580c" 
                  strokeDasharray="3 3" 
                  strokeWidth={2}
                  isFront={true}
                >
                  <Label 
                    value="IST-STAND" 
                    position="top" 
                    fill="#ea580c" 
                    fontSize={10} 
                    fontWeight="bold"
                    offset={10}
                    className="bg-white"
                  />
                </ReferenceLine>

              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <GraphUpArrow size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">Noch keine Reichweiten-Daten vorhanden.</p>
            <p className="text-xs mt-1">Daten werden automatisch von Google geladen, sobald verfügbar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
