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
  GraphDownArrow, 
  HourglassSplit, 
  ListCheck, 
  BoxSeam, 
  Trophy, 
  ArrowUp, 
  ArrowDown, 
  Dash,
  Search,
  Cpu
} from 'react-bootstrap-icons';
import { addMonths, format, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { motion } from 'framer-motion'; // ✅ Animation Import

interface StatusCounts {
  'Offen': number;
  'In Prüfung': number;
  'Gesperrt': number;
  'Freigegeben': number;
  'Total': number;
}
interface TrendPoint {
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
  gscImpressionTrend: TrendPoint[];
  aiTrafficTrend?: TrendPoint[];
  topMovers?: TopMover[];
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ProjectTimelineWidget({ projectId }: { projectId: string }) {
  const { data, error, isLoading } = useSWR<TimelineData>(`/api/project-timeline?projectId=${projectId}`, fetcher);

  if (isLoading) return <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />;
  if (error || !data) return <div className="h-64 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">Keine Daten verfügbar</div>;

  const { project, progress, gscImpressionTrend, aiTrafficTrend, topMovers } = data;
  const today = new Date();
  
  // Datumsberechnungen
  const startDate = new Date(project.startDate);
  const endDate = addMonths(startDate, project.durationMonths);
  const totalDays = differenceInCalendarDays(endDate, startDate);
  const daysPassed = differenceInCalendarDays(today, startDate);
  const progressPercent = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
  
  const currentMonth = Math.ceil((daysPassed / totalDays) * project.durationMonths);
  const displayMonth = Math.min(Math.max(1, currentMonth), project.durationMonths);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CalendarWeek className="text-indigo-600" />
            Projekt-Zeitplan & Fortschritt
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Laufzeit: {format(startDate, 'dd.MM.yyyy')} - {format(endDate, 'dd.MM.yyyy')}
          </p>
        </div>
        <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
          Monat {displayMonth} von {project.durationMonths}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SPALTE 1: Timeline & Status (Links) */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* 1. Projektfortschritt (Zeitachse) */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-700 flex items-center gap-2">
                <ClockHistory /> Zeitlicher Fortschritt
              </span>
              <span className="font-bold text-indigo-600">{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              {/* ✅ ANIMATION: Zeit-Balken */}
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-sm"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Noch {Math.max(0, totalDays - daysPassed)} Tage bis Projektende
            </p>
          </div>

          {/* 2. Landingpage Status (Verteilung) */}
          <div>
            <div className="flex justify-between text-sm mb-3">
              <span className="font-medium text-gray-700 flex items-center gap-2">
                <BoxSeam /> Landingpages
              </span>
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                Gesamt: {progress.counts.Total}
              </span>
            </div>
            
            {/* Multi-Color Progress Bar */}
            <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
              {/* Offen */}
              {progress.counts['Offen'] > 0 && (
                <motion.div 
                  className="bg-blue-400 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.counts['Offen'] / progress.counts.Total) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  title={`Offen: ${progress.counts['Offen']}`}
                />
              )}
              {/* In Prüfung */}
              {progress.counts['In Prüfung'] > 0 && (
                <motion.div 
                  className="bg-amber-400 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.counts['In Prüfung'] / progress.counts.Total) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  title={`In Prüfung: ${progress.counts['In Prüfung']}`}
                />
              )}
              {/* Freigegeben */}
              {progress.counts['Freigegeben'] > 0 && (
                <motion.div 
                  className="bg-emerald-500 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.counts['Freigegeben'] / progress.counts.Total) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  title={`Freigegeben: ${progress.counts['Freigegeben']}`}
                />
              )}
              {/* Gesperrt */}
              {progress.counts['Gesperrt'] > 0 && (
                <motion.div 
                  className="bg-red-400 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress.counts['Gesperrt'] / progress.counts.Total) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  title={`Gesperrt: ${progress.counts['Gesperrt']}`}
                />
              )}
            </div>

            {/* Legende */}
            <div className="grid grid-cols-2 gap-2 mt-3">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center gap-1.5 text-xs text-gray-600">
                 <div className="w-2 h-2 rounded-full bg-blue-400" /> Offen ({progress.counts['Offen']})
               </motion.div>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center gap-1.5 text-xs text-gray-600">
                 <div className="w-2 h-2 rounded-full bg-amber-400" /> Prüfung ({progress.counts['In Prüfung']})
               </motion.div>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex items-center gap-1.5 text-xs text-gray-600">
                 <div className="w-2 h-2 rounded-full bg-emerald-500" /> Fertig ({progress.counts['Freigegeben']})
               </motion.div>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex items-center gap-1.5 text-xs text-gray-600">
                 <div className="w-2 h-2 rounded-full bg-red-400" /> Gesperrt ({progress.counts['Gesperrt']})
               </motion.div>
            </div>
          </div>

          {/* 3. Top Mover (Mini Liste) */}
          {topMovers && topMovers.length > 0 && (
            <motion.div 
              className="bg-gray-50 rounded-xl p-4 border border-gray-100"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                <Trophy className="text-amber-500" /> Top Performer (30 Tage)
              </h3>
              <div className="space-y-3">
                {topMovers.map((page, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="truncate pr-2">
                      <div className="font-medium text-gray-900 truncate max-w-[140px]" title={page.haupt_keyword || 'Kein Keyword'}>
                        {page.haupt_keyword || page.url}
                      </div>
                    </div>
                    <div className={`text-xs font-bold flex items-center gap-1 ${page.gsc_impressionen_change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {page.gsc_impressionen_change >= 0 ? <ArrowUp/> : <ArrowDown/>}
                      {Math.abs(page.gsc_impressionen_change).toLocaleString()} Impr.
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* SPALTE 2 & 3: Großer Chart (Rechts) */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <GraphUpArrow /> Performance Trend
            </h3>
            <div className="flex gap-4 text-xs">
               <span className="flex items-center gap-1 text-blue-600 font-medium">
                 <span className="w-2 h-2 rounded-full bg-blue-500"></span> GSC Impressionen
               </span>
               <span className="flex items-center gap-1 text-purple-600 font-medium">
                 <span className="w-2 h-2 rounded-full bg-purple-500"></span> AI Traffic
               </span>
            </div>
          </div>
          
          <div className="flex-grow min-h-[300px] relative">
            <div className="absolute inset-0">
              {gscImpressionTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gscImpressionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10, fill: '#9ca3af' }} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => {
                        const d = new Date(value);
                        return d.getDate() === 1 ? format(d, 'MMM', { locale: de }) : '';
                      }}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#9ca3af' }} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ color: '#6b7280', marginBottom: '4px', fontSize: '12px' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                      formatter={(value: number) => [value.toLocaleString(), '']}
                      labelFormatter={(label) => format(new Date(label), 'dd. MMMM yyyy', { locale: de })}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      name="GSC Impressions" 
                      stroke="#3b82f6" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#colorImpressions)" 
                      connectNulls={true}
                      animationDuration={1500} // ✅ Chart Animation
                    />
                    {aiTrafficTrend && (
                      <Area 
                        type="monotone" 
                        data={aiTrafficTrend}
                        dataKey="value" 
                        name="AI Traffic" 
                        stroke="#8b5cf6" 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill="url(#colorAi)"
                        animationDuration={1500} // ✅ Chart Animation
                        animationBegin={300}
                      />
                    )}
                    {/* Reference Line für HEUTE */}
                    <ReferenceLine 
                      x={today.toISOString().split('T')[0]} 
                      stroke="#f59e0b" 
                      strokeDasharray="3 3" 
                      label={{ 
                        value: 'Heute', 
                        position: 'top', 
                        fill: '#f59e0b', 
                        fontSize: 10 
                      }} 
                    />
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
