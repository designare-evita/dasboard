'use client';

import useSWR from 'swr';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Label,
} from 'recharts';
import { 
  CalendarCheck, 
  CalendarX,
  CheckCircleFill, 
  ClockHistory, 
  GraphUpArrow, 
  HourglassSplit,
  ExclamationTriangleFill,
  InfoCircle,
  FlagFill
} from 'react-bootstrap-icons';
import { addMonths, format, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) {
    return res.json().then(errorData => {
      throw new Error(errorData.message || 'Fehler beim Laden der Timeline-Daten.');
    });
  }
  return res.json();
});

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
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 min-h-[300px] flex flex-col items-center justify-center animate-pulse">
        <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
           <HourglassSplit size={24} className="text-indigo-400 animate-spin" />
        </div>
        <p className="text-gray-400 font-medium">Analysiere Projekt-Daten...</p>
      </div>
    );
  }

  if (error || !data || !data.project) return null;

  const { project, progress, gscImpressionTrend } = data;
  const { counts, percentage: workProgress } = progress;
  
  // Datumsberechnungen
  const startDate = project?.startDate ? new Date(project.startDate) : new Date();
  const duration = project?.durationMonths || 6;
  const endDate = addMonths(startDate, duration);
  const today = new Date();
  
  // Zeit-Fortschritt berechnen
  const totalProjectDays = differenceInCalendarDays(endDate, startDate) || 1; 
  const elapsedProjectDays = differenceInCalendarDays(today, startDate);
  // Begrenzen auf 0-100%
  let timeProgress = Math.round((elapsedProjectDays / totalProjectDays) * 100);
  if (timeProgress < 0) timeProgress = 0;
  if (timeProgress > 100) timeProgress = 100;

  // "Sind wir im Plan?" Logik
  // Wenn Zeit (z.B. 50%) > Arbeit (z.B. 20%) = Rückstand
  const progressDelta = workProgress - timeProgress;
  
  let statusColor = 'text-green-600';
  let statusBg = 'bg-green-50 border-green-200';
  let statusText = 'Hervorragend im Plan';
  let StatusIcon = CheckCircleFill;

  if (progressDelta < -15) {
    statusColor = 'text-red-600';
    statusBg = 'bg-red-50 border-red-200';
    statusText = 'Kritischer Rückstand';
    StatusIcon = ExclamationTriangleFill;
  } else if (progressDelta < -5) {
    statusColor = 'text-orange-600';
    statusBg = 'bg-orange-50 border-orange-200';
    statusText = 'Leichter Verzug';
    StatusIcon = InfoCircle;
  }

  const chartData = (gscImpressionTrend || []).map(d => ({
    date: new Date(d.date).getTime(), 
    impressions: d.value,
  }));

  const xTicks = [ startDate.getTime(), today.getTime(), endDate.getTime() ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print-timeline">
      
      {/* --- HEADER & STATUS --- */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FlagFill className="text-indigo-600" />
              Projekt-Status
              {domain && <span className="text-gray-400 font-normal ml-2 text-sm hidden sm:inline">| {domain}</span>}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Projektlaufzeit: {format(startDate, 'MM.yyyy')} - {format(endDate, 'MM.yyyy')} ({duration} Monate)
            </p>
          </div>

          {/* Status Badge */}
          <div className={cn("px-4 py-2 rounded-lg border flex items-center gap-2 shadow-sm", statusBg)}>
            <StatusIcon className={statusColor} size={18} />
            <div>
              <p className={cn("text-xs font-bold uppercase tracking-wider", statusColor)}>{statusText}</p>
              <p className="text-xs text-gray-600">
                Fortschritt: <span className="font-semibold">{workProgress}%</span> vs. Zeit: <span className="font-semibold">{timeProgress}%</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- TIMELINE & PROGRESS SECTION --- */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center bg-gray-50/50">
        
        {/* Linke Spalte: Meilensteine / Zeitstrahl */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Visueller Zeitstrahl */}
          <div className="relative pt-6 pb-2">
            <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2 px-1">
              <span className="flex items-center gap-1"><CalendarCheck/> Start</span>
              <span className="text-indigo-600 flex items-center gap-1"><ClockHistory/> Heute</span>
              <span className="flex items-center gap-1">Ende <CalendarX/></span>
            </div>
            
            {/* Timeline Track */}
            <div className="h-3 w-full bg-gray-200 rounded-full relative overflow-visible">
              {/* Füllung (Verstrichene Zeit) */}
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-300 to-indigo-500 rounded-full transition-all duration-1000"
                style={{ width: `${timeProgress}%` }}
              />
              
              {/* Heute-Marker (Pin) */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 z-10 shadow-sm transition-all duration-1000"
                style={{ left: `${timeProgress}%` }}
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  HEUTE
                </div>
              </div>
            </div>
            
            <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
              <span>{format(startDate, 'dd.MM.yy')}</span>
              <span>{format(endDate, 'dd.MM.yy')}</span>
            </div>
          </div>

          {/* Detail-Fortschritt (Landingpages) */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-medium text-gray-700">
                Inhaltliche Fertigstellung
              </span>
              <span className="text-2xl font-bold text-gray-900">
                {counts.Freigegeben} <span className="text-sm text-gray-400 font-normal">/ {counts.Total} LPs</span>
              </span>
            </div>
            
            {/* Multi-Color Progress Bar */}
            <div className="flex w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              {/* Freigegeben */}
              <div 
                className="bg-green-500 transition-all duration-700" 
                style={{ width: `${(counts.Freigegeben / counts.Total) * 100}%` }} 
                title="Freigegeben"
              />
              {/* In Prüfung */}
              <div 
                className="bg-yellow-400 transition-all duration-700" 
                style={{ width: `${(counts['In Prüfung'] / counts.Total) * 100}%` }} 
                title="In Prüfung"
              />
              {/* Gesperrt */}
              <div 
                className="bg-red-400 transition-all duration-700" 
                style={{ width: `${(counts.Gesperrt / counts.Total) * 100}%` }} 
                title="Gesperrt"
              />
            </div>
            
            <div className="flex gap-4 mt-2 justify-end text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>Fertig</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span>Prüfung</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200"></span>Offen</span>
            </div>
          </div>
        </div>

        {/* Rechte Spalte: GSC Mini-Chart */}
        <div className="lg:col-span-1 h-full flex flex-col">
          <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 h-full">
            <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
              <GraphUpArrow /> Reichweite (Trend)
            </h3>
            
            {chartData.length > 0 ? (
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="miniChartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="impressions" 
                      stroke="#6366f1" 
                      strokeWidth={2} 
                      fill="url(#miniChartGradient)" 
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex justify-between items-center mt-2 text-xs text-indigo-700/70">
                  <span>Letzte 90 Tage</span>
                  <span className="font-bold">
                    ~{chartData.reduce((acc, curr) => acc + curr.impressions, 0).toLocaleString()} Impr.
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-xs text-indigo-300 italic border border-dashed border-indigo-200 rounded">
                Keine GSC Daten
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
