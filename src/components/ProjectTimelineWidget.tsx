// src/components/ProjectTimelineWidget.tsx
'use client';

import useSWR from 'swr';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { 
  CalendarCheck, 
  CalendarX, 
  CheckCircle, 
  ClockHistory, 
  GraphUpArrow, 
  HourglassSplit,
  ListCheck,
  CalendarWeek,
  BoxSeam
} from 'react-bootstrap-icons';
import { addMonths, format, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// --- Interfaces & Fetcher (unverändert) ---
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

// --- Props ---
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
        <HourglassSplit size={32} className="text-indigo-300 mb-3" />
        <p className="text-gray-400 text-sm font-medium">Lade Projekt-Daten...</p>
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
  
  // Zeit-Fortschritt in %
  const totalProjectDays = Math.max(1, differenceInCalendarDays(endDate, startDate)); 
  const elapsedProjectDays = differenceInCalendarDays(today, startDate);
  const timeElapsedPercentage = Math.max(0, Math.min(100, (elapsedProjectDays / totalProjectDays) * 100));
  
  // Chart Daten aufbereiten
  const chartData = (gscImpressionTrend || []).map(d => ({
    date: new Date(d.date).getTime(), 
    impressions: d.value,
  }));

  return (
    <div className="bg-white p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200 print-timeline">
      
      {/* Header Bereich */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClockHistory className="text-indigo-600" size={22} />
            Projekt-Status
          </h2>
          {/* ÄNDERUNG: Domain-Anzeige hier entfernt */}
        </div>
        <div className="mt-2 sm:mt-0 flex gap-3">
           <div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-100">
             Laufzeit: {duration} Monate
           </div>
        </div>
      </div>

      {/* Haupt-Grid */}
      <div className="flex flex-col lg:flex-row gap-8 h-full">
        
        {/* --- LINKE SPALTE (50%) --- */}
        <div className="w-full lg:w-[50%] flex flex-col justify-center space-y-10">
          
          {/* 1. ZEITBALKEN: Timeline mit Zeitachse */}
          <div className="space-y-3">
            <div className="flex justify-between items-end mb-2">
              <div className="flex items-center gap-2 text-gray-700 font-semibold">
                <CalendarWeek className="text-indigo-500" size={18} />
                <span>Zeitachse</span>
              </div>
              <span className="text-sm font-medium text-gray-500">
                {Math.round(timeElapsedPercentage)}% vergangen
              </span>
            </div>

            {/* Visual Timeline Bar */}
            <div className="relative h-10 w-full bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
              {/* Füllung "Vergangene Zeit" - ÄNDERUNG: Farbe verstärkt (indigo-200) */}
              <div 
                className="absolute top-0 left-0 h-full bg-indigo-200 border-r-2 border-indigo-500 transition-all duration-1000"
                style={{ width: `${timeElapsedPercentage}%` }}
              />
              
              {/* Labels im Balken (Start/Ende) */}
              <div className="absolute inset-0 flex justify-between items-center px-4 text-xs font-medium text-gray-500 pointer-events-none">
                <div className="flex flex-col items-start z-10">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">Start</span>
                  <span className="text-gray-800">{format(startDate, 'dd.MM.yyyy')}</span>
                </div>
                
                {/* "Heute" Marker */}
                {timeElapsedPercentage > 5 && timeElapsedPercentage < 95 && (
                   <div className="flex flex-col items-center z-10" style={{ position: 'absolute', left: `${timeElapsedPercentage}%`, transform: 'translateX(-50%)' }}>
                      <div className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full mb-0.5 shadow-sm">
                        Heute
                      </div>
                   </div>
                )}

                <div className="flex flex-col items-end z-10">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">Ende</span>
                  <span className="text-gray-500">{format(endDate, 'dd.MM.yyyy')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. ZEITBALKEN: Projektfortschritt (Landingpages) */}
          <div className="space-y-3">
            <div className="flex justify-between items-end mb-2">
              <div className="flex items-center gap-2 text-gray-700 font-semibold">
                <ListCheck className="text-green-600" size={20} />
                <span>Projektfortschritt (Landingpages)</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900">{Math.round(percentage)}%</span>
                <span className="text-sm text-gray-500 font-medium">fertiggestellt</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-6 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner border border-gray-200">
              {counts.Total > 0 ? (
                <>
                  {/* Freigegeben (Grün) */}
                  <div 
                    className="bg-green-500 h-full transition-all duration-700 hover:bg-green-600 relative group"
                    style={{ width: `${(counts.Freigegeben / counts.Total) * 100}%` }}
                  >
                    <span className="opacity-0 group-hover:opacity-100 absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-white font-bold pt-1 transition-opacity">
                      {counts.Freigegeben}
                    </span>
                  </div>
                  
                  {/* In Prüfung (Gelb) */}
                  <div 
                    className="bg-amber-400 h-full transition-all duration-700 hover:bg-amber-500 relative group"
                    style={{ width: `${(counts['In Prüfung'] / counts.Total) * 100}%` }}
                  >
                     <span className="opacity-0 group-hover:opacity-100 absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-white font-bold pt-1 transition-opacity">
                      {counts['In Prüfung']}
                    </span>
                  </div>
                  
                  {/* Gesperrt (Rot) */}
                  <div 
                    className="bg-red-400 h-full transition-all duration-700 hover:bg-red-500 relative group"
                    style={{ width: `${(counts.Gesperrt / counts.Total) * 100}%` }}
                  >
                     <span className="opacity-0 group-hover:opacity-100 absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-white font-bold pt-1 transition-opacity">
                      {counts.Gesperrt}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 bg-gray-50">
                  Keine Landingpages angelegt
                </div>
              )}
            </div>

            {/* Legende */}
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                <span>Freigegeben ({counts.Freigegeben})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span>In Prüfung ({counts['In Prüfung']})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                <span>Gesperrt ({counts.Gesperrt})</span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto font-medium text-gray-800">
                <BoxSeam size={12} />
                <span>Gesamt: {counts.Total}</span>
              </div>
            </div>
          </div>

        </div>

        {/* --- RECHTE SPALTE (50%) --- */}
        <div className="w-full lg:w-[50%] flex flex-col">
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 h-full flex flex-col shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
            
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                <GraphUpArrow className="text-blue-500" size={16} />
                Reichweite
              </h3>
            </div>

            {/* Chart Container */}
            <div className="flex-grow min-h-[180px] w-full relative">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    
                    {/* X-Achse: Datum */}
                    <XAxis
                      dataKey="date"
                      tickFormatter={(timestamp) => format(new Date(timestamp), 'd.MM', { locale: de })}
                      domain={[startDate.getTime(), endDate.getTime()]}
                      type="number"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickMargin={10}
                      minTickGap={30}
                    />

                    {/* Y-Achse: Impressionen */}
                    <YAxis 
                      tickFormatter={(value) => new Intl.NumberFormat('de-DE', { notation: 'compact' }).format(value)}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      width={45}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                      labelFormatter={(v) => format(new Date(v), 'd. MMM', { locale: de })}
                      formatter={(value: number) => [new Intl.NumberFormat('de-DE').format(value), 'Impressionen']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="impressions" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorImpressions)" 
                    />
                    <ReferenceLine x={today.getTime()} stroke="#f59e0b" strokeDasharray="3 3" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <GraphUpArrow size={24} className="mb-2 opacity-20" />
                  <span className="text-xs">Keine Daten verfügbar</span>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
