// src/components/TableauKpiGrid.tsx
'use client';

import React, { useMemo } from 'react';
import TableauKpiCard from './tableau-kpi-card';
import { KpiDatum, ChartPoint, ApiErrorStatus } from '@/lib/dashboard-shared';
import { getRangeLabel, DateRangeOption } from '@/components/DateRangeSelector';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ExtendedKpis {
  // GSC
  clicks: KpiDatum;
  impressions: KpiDatum;
  
  // GA4 Traffic
  sessions: KpiDatum;
  totalUsers: KpiDatum;
  newUsers?: KpiDatum;
  
  // GA4 Engagement
  conversions?: KpiDatum;
  engagementRate?: KpiDatum;
  bounceRate?: KpiDatum;
  avgEngagementTime?: KpiDatum;
}

interface TableauKpiGridProps {
  kpis: ExtendedKpis;
  isLoading?: boolean;
  allChartData?: Record<string, ChartPoint[]>;
  apiErrors?: ApiErrorStatus;
  dateRange?: string;
}

export default function TableauKpiGrid({
  kpis,
  isLoading = false,
  allChartData,
  apiErrors,
  dateRange = '30d'
}: TableauKpiGridProps) {

  if (!kpis) return null;

  const gscError = apiErrors?.gsc;
  const ga4Error = apiErrors?.ga4;

  const formatPercent = (v: number) => `${v.toFixed(1)}%`;
  const formatTime = (v: number) => {
    const minutes = Math.floor(v / 60);
    const seconds = Math.floor(v % 60);
    return `${minutes}m ${seconds}s`;
  };

  const dateSubtitle = useMemo(() => {
    const dataPoints = allChartData?.sessions || allChartData?.clicks;
    if (dataPoints && dataPoints.length > 0) {
      const sorted = [...dataPoints].sort((a, b) => a.date - b.date);
      const startDate = sorted[0].date;
      const endDate = sorted[sorted.length - 1].date;
      try {
        return `${format(startDate, 'dd.MM.', { locale: de })} - ${format(endDate, 'dd.MM.yyyy', { locale: de })}`;
      } catch (e) {
        console.error(e);
      }
    }
    return 'Zeitraum';
  }, [allChartData]);

  const rangeLabel = getRangeLabel(dateRange as DateRangeOption);

  return (
    <div className="space-y-8">
      
      {/* ZEILE 1: Traffic & Reichweite */}
      {/* Farben: Kühle Töne (Lila -> Blau -> Cyan) */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 px-1">
          Traffic & Reichweite
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          
          {/* 1. Impressionen (Lila) */}
          <TableauKpiCard
            title="Impressionen"
            description="Wie oft ein Link zu Ihrer Webseite in den Google Suchergebnissen angezeigt wurde (auch ohne Klick)."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.impressions.value}
            change={kpis.impressions.change}
            data={allChartData?.impressions}
            color="#8b5cf6" // Violet
            error={gscError}
            isLoading={isLoading}
            barComparison={{ current: 15231, previous: 15007 }}
          />

          {/* 2. Google Klicks (Blau) */}
          <TableauKpiCard
            title="Google Klicks"
            description="Wie oft Nutzer in der Google Suche auf einen Link zu Ihrer Webseite geklickt haben."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.clicks.value}
            change={kpis.clicks.change}
            data={allChartData?.clicks}
            color="#3b82f6" // Blue
            error={gscError}
            isLoading={isLoading}
            barComparison={{ current: 56804, previous: 58172 }}
          />

          {/* 3. Neue Besucher (Indigo) */}
          {kpis.newUsers && (
            <TableauKpiCard
              title="Neue Besucher"
              description="Anzahl der Nutzer, die Ihre Webseite zum allerersten Mal besucht haben."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.newUsers.value}
              change={kpis.newUsers.change}
              data={allChartData?.newUsers}
              color="#6366f1" // Indigo
              error={ga4Error}
              isLoading={isLoading}
              barComparison={{ current: 1779128, previous: 1438809 }}
            />
          )}

          {/* 4. Besucher (Sky Blue) */}
          <TableauKpiCard
            title="Besucher"
            description="Anzahl der eindeutigen Nutzer, die Ihre Webseite im gewählten Zeitraum besucht haben."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.totalUsers.value}
            change={kpis.totalUsers.change}
            data={allChartData?.totalUsers}
            color="#0ea5e9" // Sky Blue - Distinct from normal Blue
            error={ga4Error}
            isLoading={isLoading}
            barComparison={{ current: 5265447, previous: 3301386 }}
          />

          {/* 5. Sessions (Cyan/Teal) */}
          <TableauKpiCard
            title="Sessions"
            description="Anzahl der Sitzungen (Besuche) auf Ihrer Webseite. Ein Nutzer kann mehrere Sitzungen generieren."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.sessions.value}
            change={kpis.sessions.change}
            data={allChartData?.sessions}
            color="#06b6d4" // Cyan
            error={ga4Error}
            isLoading={isLoading}
            barComparison={{ current: 8838555, previous: 6173228 }}
          />

        </div>
      </div>

      {/* ZEILE 2: Qualität & Engagement */}
      {/* Farben: Warme / Signalfarben (Pink, Grün, Amber, Rose) */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 px-1">
          Qualität & Engagement
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          
          {/* 1. Engagement Rate (Pink) */}
          {kpis.engagementRate && (
            <TableauKpiCard
              title="Engagement Rate"
              description="Prozentsatz der Sitzungen, die länger als 10s dauerten oder eine Conversion enthielten."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.engagementRate.value}
              change={kpis.engagementRate.change}
              data={allChartData?.engagementRate}
              color="#ec4899" // Pink
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatPercent}
              barComparison={{ current: 4410644, previous: 2459714 }}
            />
          )}

          {/* 2. Conversions (Emerald/Grün) */}
          {kpis.conversions && (
            <TableauKpiCard
              title="Conversions"
              description="Anzahl der erreichten Ziele (z.B. Käufe, Kontaktanfragen), die als wertvoll definiert wurden."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.conversions.value}
              change={kpis.conversions.change}
              data={allChartData?.conversions}
              color="#10b981" // Emerald
              error={ga4Error}
              isLoading={isLoading}
              barComparison={{ current: 854802, previous: 841672 }}
            />
          )}

          {/* 3. Ø Verweildauer (Amber/Gelb-Orange) */}
          {kpis.avgEngagementTime && (
            <TableauKpiCard
              title="Ø Verweildauer"
              description="Durchschnittliche Zeit, die ein aktiver Nutzer auf Ihrer Webseite verbracht hat."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.avgEngagementTime.value}
              change={kpis.avgEngagementTime.change}
              data={allChartData?.avgEngagementTime}
              color="#f59e0b" // Amber - Distinct from Traffic colors
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatTime}
              barComparison={{ current: 328182, previous: 418105 }}
            />
          )}

          {/* 4. Absprungrate (Rose/Rot) */}
          {kpis.bounceRate && (
            <TableauKpiCard
              title="Absprungrate"
              description="Prozentsatz der Sitzungen ohne Interaktion. Eine niedrige Rate ist in der Regel besser."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.bounceRate.value}
              change={kpis.bounceRate.change}
              data={allChartData?.bounceRate}
              color="#f43f5e" // Rose - Signaling "Exit"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatPercent}
              barComparison={{ current: 306907, previous: 250013 }}
            />
          )}

        </div>
      </div>

    </div>
  );
}
