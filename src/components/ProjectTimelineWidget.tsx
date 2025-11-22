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
  CalendarWeek, 
  ClockHistory, 
  GraphUpArrow, 
  HourglassSplit,
  ListCheck,
  BoxSeam,
  Trophy,
  ArrowUp
} from 'react-bootstrap-icons';
import { addMonths, format, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';

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
interface TopMover {
  url: string;
  haupt_keyword: string | null;
  gsc_impressionen: number;
  gsc_impressionen_change: number;
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
  topMovers?: TopMover[];
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
      <div className="card-glass p-8 min-h-[300px] flex flex-col items-center justify-center animate-pulse">
        <HourglassSplit size={32} className="text-indigo-300 mb-3" />
        <p className="text-gray-400 text-sm font-medium">Lade Projekt-Daten...</p>
      </div>
    );
  }

  if (error || !data || !data.project) return null;

  const { project, progress, gscImpressionTrend, topMovers } = data;
  const { counts, percentage } = progress;
  
  const startDate = project?.startDate ? new Date(project.startDate) : new Date();
  const duration = project?.durationMonths || 6;
  const endDate = addMonths(startDate, duration);
  const today = new Date();
  
  const totalProjectDays = Math.max(1, differenceInCalendarDays(endDate, startDate)); 
  const elapsedProjectDays = differenceInCalendarDays(today, startDate);
  const timeElapsedPercentage = Math.max(0, Math.min(100, (elapsedProjectDays / totalProjectDays) * 100));
  
  const chartData = (gscImpressionTrend || []).map(d => ({
    date: new Date(d.date).getTime(), 
    impressions: d.value,
  }));

  return (
    <div className="card-glass p-6 lg:p-8 print-timeline">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-gray-200/50 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClockHistory className="text-indigo-600" size={22} />
            Projekt-Status
          </h2>
        </div>
        <div className="mt-2 sm:mt-0 flex gap-3">
           <div className="px-3 py-1 bg-indigo-50/80 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-100/50 backdrop-blur-sm">
             Laufzeit: {duration} Monate
           </div>
        </div>
      </div>

      {/* === GRID LAYOUT: 3 SPALTEN === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        
        {/* SPALTE 1: Zeitachse & Fortschritt */}
        <div className="flex flex-col gap-8 border-b lg:border-b-0 lg:border-r border-gray-100 pb-6 lg:pb-0 lg:pr-6">
          
          {/* 1. Zeitachse */}
          <div className="space-y-3">
            <div className="flex justify-between items-end mb-2">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-900"> {/* KORREKTUR: text-lg */}
                <CalendarWeek className="text-indigo-500" size={20} /> {/* Icon leicht vergrößert auf 20 */}
                <h3>Zeitachse</h3>
              </div>
              <span className="text-sm font-medium text-gray-500">
                {Math.round(timeElapsedPercentage)}% vergangen
              </span>
            </div>

            <div className="relative h-10 w-full bg-gray-100/80 rounded-lg border border-gray-200/60 overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-indigo-200 border-r-2 border-indigo-500 transition-all duration-1000"
                style={{ width: `${timeElapsedPercentage}%` }}
              />
              <div className="absolute inset-0 flex justify-between items-center px-4 text-xs font-medium text-gray-500 pointer-events-none">
                <div className="flex flex-col items-start z-10">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">Start</span>
                  <span className="text-gray-800">{format(startDate, 'dd.MM.yyyy')}</span>
                </div>
                
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

          {/* 2. Projektfortschritt */}
          <div className="space-y-3">
            <div className="flex justify-between items-end mb-2">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-900"> {/* KORREKTUR: text-lg */}
                <ListCheck className="text-green-600" size={22} /> {/* Icon leicht vergrößert auf 22 */}
                <h3>Landingpages Status</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900">{Math.round(percentage)}%</span>
                <span className="text-sm text-gray-500 font-medium">fertig</span>
              </div>
            </div>

            <div className="h-6 w-full bg-gray-100/80 rounded-full overflow-hidden flex shadow-inner border border-gray-200/60">
              {counts.Total > 0 ? (
                <>
                  <div className="bg-green-500 h-full hover:bg-green-600 relative group" style={{ width: `${(counts.Freigegeben / counts.Total) * 100}%` }}>
                    <span className="opacity-0 group-hover:opacity-100 absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-white font-bold pt-1 transition-opacity">{counts.Freigegeben}</span>
                  </div>
                  <div className="bg-amber-400 h-full hover:bg-amber-500 relative group" style={{ width: `${(counts['In Prüfung'] / counts.Total) * 100}%` }}>
                     <span className="opacity-0 group-hover:opacity-100 absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-white font-bold pt-1 transition-opacity">{counts['In Prüfung']}</span>
                  </div>
                  <div className="bg-red-400 h-full hover:bg-red-500 relative group" style={{ width: `${(counts.Gesperrt / counts.Total) * 100}%` }}>
                     <span className="opacity-0 group-hover:opacity-100 absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-white font-bold pt-1 transition-opacity">{counts.Gesperrt}</span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 bg-gray-50">Keine Daten</div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-gray-500 justify-between">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>Freig.: {counts.Freigegeben}</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Prüf.: {counts['In Prüfung']}</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span>Gesp.: {counts.Gesperrt}</div>
              <div className="flex items-center gap-1 font-medium text-gray-700"><BoxSeam size={10} />Ges: {counts.Total}</div>
            </div>
          </div>

        </div>

        {/* SPALTE 2: Top Movers (GSC) */}
        <div className="flex flex-col h-full border-b lg:border-b-0 lg:border-r border-gray-100 pb-6 lg:pb-0 lg:px-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900"> {/* KORREKTUR: text-lg */}
              <Trophy className="text-amber-500" size={20} />
              <h3>Top-Performer (GSC)</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
              Trend (90T)
            </span>
          </div>

          {topMovers && topMovers.length > 0 ? (
            <div className="flex-grow overflow-hidden">
              <div className="space-y-2">
                {topMovers.map((page, index) => (
                  <div key={index} className="bg-gray-50/50 rounded-lg border border-gray-100 p-3 hover:shadow-sm transition-all flex items-center justify-between group">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="font-medium text-sm text-gray-900 truncate" title={page.haupt_keyword || page.url}>
                        {page.haupt_keyword || <span className="text-gray-400 italic">Kein Keyword</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate mt-0.5">{new URL(page.url).pathname}</div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <div className="flex items-center gap-1 text-green-600 font-bold text-xs bg-white px-1.5 py-0.5 rounded border border-green-100 shadow-sm">
                        <ArrowUp size={10} />
                        {page.gsc_impressionen_change > 1000 
                          ? (page.gsc_impressionen_change / 1000).toFixed(1) + 'k' 
                          : page.gsc_impressionen_change}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-gray-400 text-xs italic border border-dashed border-gray-200 rounded-lg bg-gray-50">
              Keine Trend-Daten verfügbar
            </div>
          )}
        </div>

        {/* SPALTE 3: Reichweite Chart */}
        <div className="flex flex-col h-full">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"> {/* KORREKTUR: text-lg und text-gray-900 */}
              <GraphUpArrow className="text-blue-500" size={18} />
              Reichweitenentwicklung seit Projektstart
            </h3>
          </div>

          <div className="bg-gray-50/50 rounded-xl border border-gray-200/60 p-4 h-full min-h-[200px] flex flex-col shadow-inner backdrop-blur-sm">
            <div className="flex-grow w-full relative">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(timestamp) => format(new Date(timestamp), 'd.MM', { locale: de })}
                      domain={[startDate.getTime(), endDate.getTime()]}
                      type="number"
                      tick={{ fontSize: 9, fill: '#6b7280' }}
                      tickMargin={5}
                      minTickGap={30}
                    />
                    <YAxis 
                      tickFormatter={(value) => new Intl.NumberFormat('de-DE', { notation: 'compact' }).format(value)}
                      tick={{ fontSize: 9, fill: '#6b7280' }}
                      width={35}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.95)' }}
                      labelFormatter={(v) => format(new Date(v), 'd. MMM', { locale: de })}
                      formatter={(value: number) => [new Intl.NumberFormat('de-DE').format(value), 'Impressionen']}
                    />
                    <Area type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorImpressions)" />
                    <ReferenceLine x={today.getTime()} stroke="#f59e0b" strokeDasharray="3 3" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <GraphUpArrow size={24} className="mb-2 opacity-20" />
                  <span className="text-xs">Keine Daten</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
