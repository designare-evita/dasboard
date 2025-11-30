// src/components/TableauKpiGrid.tsx
'use client';

import React from 'react';
import { 
  GraphUpArrow, 
  GraphDownArrow, 
  People, 
  Activity, 
  Mouse, 
  Eye, 
  Cart, 
  ClockHistory, 
  PersonPlus, 
  BoxArrowRight,
  ExclamationTriangleFill
} from 'react-bootstrap-icons';
import { KpiDatum, ApiErrorStatus } from '@/lib/dashboard-shared';
import { DateRangeOption, getRangeLabel } from '@/components/DateRangeSelector';
import { cn } from '@/lib/utils';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

interface TableauKpiGridProps {
  kpis: {
    clicks: KpiDatum;
    impressions: KpiDatum;
    sessions: KpiDatum;
    totalUsers: KpiDatum;
    conversions: KpiDatum;
    engagementRate: KpiDatum;
    bounceRate: KpiDatum;
    newUsers: KpiDatum;
    avgEngagementTime: KpiDatum;
  };
  isLoading: boolean;
  allChartData?: any; 
  apiErrors?: ApiErrorStatus;
  dateRange: DateRangeOption;
}

// --- Hilfskomponenten ---

function MiniSparkline({ data, color }: { data: any[], color: string }) {
  if (!data || data.length < 2) return null;
  return (
    <div className="h-8 w-16 opacity-50">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={1.5} 
            fill={`url(#grad-${color})`} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  colorClass, 
  chartColor, 
  format = 'number', 
  suffix = '',
  isLoading,
  chartData,
  hasError
}: any) {
  
  if (hasError) {
    return (
      <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between opacity-70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-md text-red-400">
            <ExclamationTriangleFill size={16} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">{title}</p>
            <p className="text-xs text-red-400">Datenfehler</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm animate-pulse flex justify-between items-center h-[72px]">
        <div className="flex items-center gap-3 w-full">
          <div className="w-10 h-10 bg-gray-100 rounded-md shrink-0" />
          <div className="space-y-2 w-full">
            <div className="h-3 bg-gray-100 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  // Formatierung
  let displayValue = '0';
  if (value !== undefined && value !== null) {
    if (format === 'compact') {
      displayValue = new Intl.NumberFormat('de-DE', { notation: "compact", maximumFractionDigits: 1 }).format(value);
    } else if (format === 'time') {
      const minutes = Math.floor(value / 60);
      const seconds = Math.round(value % 60);
      displayValue = `${minutes}m ${seconds}s`;
    } else {
      displayValue = new Intl.NumberFormat('de-DE').format(value);
    }
  }

  const isPositive = change > 0;
  const isNeutral = change === 0;
  // Bei Bounce Rate ist Steigerung schlecht -> Logik umdrehen? 
  // Standard: Grün = Hoch, Rot = Runter.
  // Für Bounce Rate: Rot = Hoch (Schlecht), Grün = Runter (Gut).
  const isBounceRate = title === 'Absprungrate';
  
  let trendColor = isPositive ? 'text-emerald-600' : 'text-red-500';
  if (isBounceRate) trendColor = isPositive ? 'text-red-500' : 'text-emerald-600';
  if (isNeutral) trendColor = 'text-gray-400';

  const TrendIcon = isPositive ? GraphUpArrow : (isNeutral ? Activity : GraphDownArrow);

  return (
    <div className="group bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between relative overflow-hidden">
      {/* Background Decor */}
      <div className={cn("absolute right-0 top-0 w-16 h-16 opacity-[0.03] rounded-bl-3xl -mr-2 -mt-2 transition-transform group-hover:scale-110", colorClass.replace('text-', 'bg-'))} />

      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2 z-10">
          <div className={cn("p-1.5 rounded-md bg-opacity-10", colorClass.replace('text-', 'bg-'), colorClass)}>
            <Icon size={14} />
          </div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">{title}</span>
        </div>
        {/* Sparkline Chart */}
        {chartData && <MiniSparkline data={chartData} color={chartColor} />}
      </div>

      <div className="flex items-end justify-between z-10 mt-1">
        <div className="text-xl font-bold text-gray-900 leading-none">
          {displayValue}<span className="text-sm font-normal text-gray-400 ml-0.5">{suffix}</span>
        </div>
        
        {change !== 0 && (
          <div className={cn("flex items-center gap-0.5 text-xs font-bold bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100", trendColor)}>
            <TrendIcon size={10} />
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Hauptkomponente ---

export default function TableauKpiGrid({ 
  kpis, 
  isLoading, 
  allChartData, 
  apiErrors,
  dateRange 
}: TableauKpiGridProps) {
  
  const rangeLabel = getRangeLabel(dateRange);

  return (
    <div className="w-full space-y-5">
      
      {/* GRUPPE 1: Traffic & Reichweite */}
      <div>
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          Traffic & Reichweite <span className="text-[10px] font-normal normal-case opacity-60">({rangeLabel})</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard 
            title="Sitzungen" 
            value={kpis.sessions?.value} 
            change={kpis.sessions?.change} 
            icon={Activity} 
            colorClass="text-emerald-600" 
            chartColor="#10b981"
            isLoading={isLoading}
            chartData={allChartData?.sessions}
            hasError={apiErrors?.ga4}
          />
          <KpiCard 
            title="Nutzer" 
            value={kpis.totalUsers?.value} 
            change={kpis.totalUsers?.change} 
            icon={People} 
            colorClass="text-blue-600" 
            chartColor="#3b82f6"
            isLoading={isLoading}
            chartData={allChartData?.totalUsers}
            hasError={apiErrors?.ga4}
          />
          <KpiCard 
            title="Klicks (Google)" 
            value={kpis.clicks?.value} 
            change={kpis.clicks?.change} 
            icon={Mouse} 
            colorClass="text-indigo-600" 
            chartColor="#6366f1"
            isLoading={isLoading}
            chartData={allChartData?.clicks}
            hasError={apiErrors?.gsc}
          />
          <KpiCard 
            title="Impressionen" 
            value={kpis.impressions?.value} 
            change={kpis.impressions?.change} 
            icon={Eye} 
            format="compact"
            colorClass="text-violet-600" 
            chartColor="#8b5cf6"
            isLoading={isLoading}
            chartData={allChartData?.impressions}
            hasError={apiErrors?.gsc}
          />
        </div>
      </div>

      {/* GRUPPE 2: Qualität & Interaktion (VORHER: Qualität & Engagement) */}
      <div>
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
          {/* ✅ HIER GEÄNDERT: Neue Überschrift */}
          Qualität & Interaktion
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard 
            title="Conversions" 
            value={kpis.conversions?.value} 
            change={kpis.conversions?.change} 
            icon={Cart} 
            colorClass="text-amber-500" 
            chartColor="#f59e0b"
            isLoading={isLoading}
            chartData={allChartData?.conversions}
            hasError={apiErrors?.ga4}
          />
          <KpiCard 
            // ✅ HIER GEÄNDERT: Label korrigiert
            title="Interaktionsrate" 
            value={kpis.engagementRate?.value} 
            change={kpis.engagementRate?.change} 
            icon={Activity} 
            colorClass="text-pink-500" 
            chartColor="#ec4899"
            suffix="%"
            format="decimal"
            isLoading={isLoading}
            chartData={allChartData?.engagementRate}
            hasError={apiErrors?.ga4}
          />
          <KpiCard 
            title="Ø Verweildauer" 
            value={kpis.avgEngagementTime?.value} 
            change={kpis.avgEngagementTime?.change} 
            icon={ClockHistory} 
            colorClass="text-cyan-500" 
            chartColor="#06b6d4"
            format="time"
            isLoading={isLoading}
            chartData={allChartData?.avgEngagementTime}
            hasError={apiErrors?.ga4}
          />
           <KpiCard 
            title="Absprungrate" 
            value={kpis.bounceRate?.value} 
            change={kpis.bounceRate?.change} 
            icon={BoxArrowRight} 
            colorClass="text-red-500" 
            chartColor="#ef4444"
            suffix="%"
            format="decimal"
            isLoading={isLoading}
            chartData={allChartData?.bounceRate}
            hasError={apiErrors?.ga4}
          />
           <KpiCard 
            title="Neue Nutzer" 
            value={kpis.newUsers?.value} 
            change={kpis.newUsers?.change} 
            icon={PersonPlus} 
            colorClass="text-teal-500" 
            chartColor="#14b8a6"
            isLoading={isLoading}
            chartData={allChartData?.newUsers}
            hasError={apiErrors?.ga4}
          />
        </div>
      </div>

    </div>
  );
}
