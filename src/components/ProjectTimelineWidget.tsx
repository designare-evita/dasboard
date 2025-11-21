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

// Tooltip Komponente
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dateLabel = new Date(label);
    return (
      <div className="bg-white p-2 shadow-md rounded border border-gray-200 text-xs">
        <p className="font-bold text-gray-800 mb-1">{format(dateLabel, 'd. MMM yyyy', { locale: de })}</p>
        <p className="text-indigo-600">
          {new Intl.NumberFormat('de-DE').format(payload[0].value)} Impr.
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
  
  let timeProgress = Math.round((elapsedProjectDays / totalProjectDays) * 100);
  if (timeProgress < 0) timeProgress = 0;
  if (timeProgress > 100) timeProgress = 100;

  // Status Logik
  const progressDelta = workProgress - timeProgress;
  let statusColor = 'text-green-600';
  let statusBg = 'bg-green-50 border-green-200';
  let statusText = 'Im Plan';
  let StatusIcon = CheckCircleFill;

  if (progressDelta < -15) {
    statusColor = 'text-red-600';
    statusBg = 'bg-red-50 border-red-200';
    statusText = 'Rückstand';
    StatusIcon = ExclamationTriangleFill;
  } else if (progressDelta < -5) {
    statusColor = 'text-orange-600';
    statusBg = 'bg-orange-50 border-orange-200';
    statusText = 'Leichter Verzug';
    StatusIcon = InfoCircle;
  }

  // Chart Data Vorbereitung
  const chartData = (gscImpressionTrend || []).map(d => ({
    date: new Date(d.date).getTime(), 
    impressions: d.value,
  }));

  // WICHTIG: Die X-Achse Ticks exakt auf Start, Heute, Ende setzen
  const xTicks = [startDate.getTime(), today.getTime(), endDate.getTime()];
  const domainRange = [startDate.getTime(), endDate.getTime()];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print-timeline">
      
      {/* --- HEADER --- */}
      <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <FlagFill className="text-indigo-600" />
          Projekt-Status
          {domain && <span className="text-gray-400 font-normal text-sm hidden sm:inline">| {domain}</span>}
        </h2>
        
        <div className={cn("px-3 py-1 rounded-full border flex items-center gap-2 text-xs font-bold uppercase tracking-wide", statusBg, statusColor)}>
          <StatusIcon size={14} />
          {statusText}
        </div>
      </div>

      {/* --- CONTENT GRID (50% / 50%) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
        
        {/* --- LINKE SPALTE: TIMELINE & FORTSCHRITT --- */}
        <div className="p-6 bg-gray-50/30 flex flex-col justify-center">
          
          {/* Visueller Zeitstrahl (Links) */}
          <div className="relative pt-8 pb-2 mb-6">
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 px-1 absolute w-full -top-1">
              <span className="flex flex-col items-start">
                <span className="flex items-center gap-1 text-indigo-900"><CalendarCheck/> Start</span>
                <span className="font-normal opacity-70">{format(startDate, 'dd.MM.yy')}</span>
              </span>
              <span className="flex flex-col items-end">
                <span className="flex items-center gap-1 text-indigo-900">Ende <CalendarX/></span>
                <span className="font-normal opacity-70">{format(endDate, 'dd.MM.yy')}</span>
              </span>
            </div>
            
            <div className="h-4 w-full bg-gray-200 rounded-full relative overflow-visible mt-6 shadow-inner">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-1000"
                style={{ width: `${timeProgress}%` }}
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-8 bg-indigo-800 z-10 transition-all duration-1000"
                style={{ left: `${timeProgress}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-indigo-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap">
                  HEUTE ({timeProgress}%)
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-800 rotate-45"></div>
              </div>
            </div>
          </div>

          {/* Fortschrittsbalken Landingpages */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-2">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-semibold text-gray-700">Inhaltliche Fertigstellung</span>
              <span className="text-xl font-bold text-gray-900">{counts.Freigegeben} <span className="text-xs text-gray-400 font-normal">/ {counts.Total} LPs</span></span>
            </div>
            <div className="flex w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="bg-green-500" style={{ width: `${(counts.Freigegeben / counts.Total) * 100}%` }} title="Freigegeben" />
              <div className="bg-yellow-400" style={{ width: `${(counts['In Prüfung'] / counts.Total) * 100}%` }} title="In Prüfung" />
              <div className="bg-red-400" style={{ width: `${(counts.Gesperrt / counts.Total) * 100}%` }} title="Gesperrt" />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-500">
              <div className="flex gap-3">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Fertig</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>Prüfung</span>
              </div>
              <span className="font-semibold text-indigo-600">{workProgress}% Gesamtfortschritt</span>
            </div>
          </div>
        </div>

        {/* --- RECHTE SPALTE: CHART ALS TIMELINE --- */}
        <div className="p-6 h-full flex flex-col bg-white">
          
          {/* Header passend zur Timeline links */}
          <div className="flex justify-between items-end mb-4 border-b border-gray-50 pb-2">
             <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <GraphUpArrow /> Reichweite (Timeline)
            </h3>
             {/* Datums-Labels auch hier anzeigen für Klarheit */}
             <div className="text-[10px] text-gray-400 font-mono">
                {format(startDate, 'dd.MM.yy')} - {format(endDate, 'dd.MM.yy')}
             </div>
          </div>
          
          <div className="flex-grow min-h-[200px] w-full relative">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  
                  {/* X-Achse festgenagelt auf Projekt Start/Ende */}
                  <XAxis
                    dataKey="date"
                    type="number"
                    domain={domainRange} // Zwingt die Achse auf Start->Ende
                    ticks={xTicks} // Zeigt explizit Start, Heute, Ende
                    stroke="#9ca3af"
                    fontSize={10}
                    tickFormatter={(timestamp) => {
                      // Einfache Formatierung für die 3 Ticks
                      if (timestamp === today.getTime()) return 'HEUTE';
                      return format(new Date(timestamp), 'dd.MM.yy', { locale: de });
                    }}
                    interval={0} // Erzwingt Anzeige aller Ticks
                  />
                  
                  {/* Y-Achse versteckt oder minimal */}
                  <YAxis 
                    hide={true} 
                    domain={['auto', 'auto']} 
                  />
                  
                  <Tooltip content={<CustomTooltip />} />

                  {/* Linie für HEUTE */}
                  <ReferenceLine 
                    x={today.getTime()} 
                    stroke="#4f46e5" 
                    strokeDasharray="3 3"
                  >
                    <Label 
                      value="HEUTE" 
                      position="insideTop" 
                      fill="#4f46e5" 
                      fontSize={10} 
                      offset={10}
                    />
                  </ReferenceLine>

                  {/* Trend-Area */}
                  <Area 
                    type="monotone" 
                    dataKey="impressions" 
                    stroke="#6366f1" 
                    strokeWidth={2} 
                    fill="url(#timelineGradient)" 
                    baseLine={0}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-xs text-indigo-300 italic bg-indigo-50/30 rounded border border-dashed border-indigo-100">
                <GraphUpArrow size={24} className="mb-2 opacity-50"/>
                Keine Daten im Projektzeitraum
              </div>
            )}
          </div>

          <div className="mt-2 text-center text-[10px] text-gray-400">
            Zeigt Impressionen im Projektverlauf
          </div>
        </div>

      </div>
    </div>
  );
}
