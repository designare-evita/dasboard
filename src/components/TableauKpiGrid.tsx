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
      } catch (e) { return 'Zeitraum'; }
    }
    return 'Zeitraum';
  }, [allChartData]);

  const currentRangeLabel = getRangeLabel(dateRange as DateRangeOption);

  return (
    <div className="space-y-6">
      
      {/* ZEILE 1: Traffic & Reichweite */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Traffic & Reichweite
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          
          <TableauKpiCard
            title="Sessions"
            description="Anzahl der Sitzungen (Besuche) auf Ihrer Webseite. Ein Nutzer kann mehrere Sitzungen generieren."
            subtitle={dateSubtitle}
            valueLabel={currentRangeLabel}
            value={kpis.sessions.value}
            change={kpis.sessions.change}
            data={allChartData?.sessions}
            color="#3b82f6"
            error={ga4Error}
            isLoading={isLoading}
            barComparison={{ current: 8838555, previous: 6173228 }}
          />

          <TableauKpiCard
            title="Besucher"
            description="Anzahl der eindeutigen Nutzer, die Ihre Webseite im gewählten Zeitraum besucht haben."
            subtitle={dateSubtitle}
            valueLabel={currentRangeLabel}
            value={kpis.totalUsers.value}
            change={kpis.totalUsers.change}
            data={allChartData?.totalUsers}
            color="#3b82f6"
            error={ga4Error}
            isLoading={isLoading}
            barComparison={{ current: 5265447, previous: 3301386 }}
          />

          {kpis.newUsers && (
            <TableauKpiCard
              title="Neue Besucher"
              description="Anzahl der Nutzer, die Ihre Webseite zum allerersten Mal besucht haben."
              subtitle={dateSubtitle}
              valueLabel={currentRangeLabel}
              value={kpis.newUsers.value}
              change={kpis.newUsers.change}
              data={allChartData?.newUsers}
              color="#6366f1"
              error={ga4Error}
              isLoading={isLoading}
              barComparison={{ current: 1779128, previous: 1438809 }}
            />
          )}

          <TableauKpiCard
            title="Google Klicks"
            description="Wie oft Nutzer in der Google Suche auf einen Link zu Ihrer Webseite geklickt haben."
            subtitle={dateSubtitle}
            valueLabel={currentRangeLabel}
            value={kpis.clicks.value}
            change={kpis.clicks.change}
            data={allChartData?.clicks}
            color="#3b82f6"
            error={gscError}
            isLoading={isLoading}
            barComparison={{ current: 56804, previous: 58172 }}
          />

          <TableauKpiCard
            title="Impressionen"
            description="Wie oft ein Link zu Ihrer Webseite in den Google Suchergebnissen angezeigt wurde (auch ohne Klick)."
            subtitle={dateSubtitle}
            valueLabel={currentRangeLabel}
            value={kpis.impressions.value}
            change={kpis.impressions.change}
            data={allChartData?.impressions}
            color="#8b5cf6"
            error={gscError}
            isLoading={isLoading}
            barComparison={{ current: 15231, previous: 15007 }}
          />

        </div>
      </div>

      {/* ZEILE 2: Qualität & Engagement */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Qualität & Engagement
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          
          {kpis.conversions && (
            <TableauKpiCard
              title="Conversions"
              description="Anzahl der erreichten Ziele (z.B. Käufe, Kontaktanfragen), die als wertvoll definiert wurden."
              subtitle={dateSubtitle}
              valueLabel={currentRangeLabel}
              value={kpis.conversions.value}
              change={kpis.conversions.change}
              data={allChartData?.conversions}
              color="#10b981"
              error={ga4Error}
              isLoading={isLoading}
              barComparison={{ current: 854802, previous: 841672 }}
            />
          )}
          
          {kpis.bounceRate && (
            <TableauKpiCard
              title="Absprungrate"
              description="Prozentsatz der Sitzungen ohne Interaktion. Eine niedrige Rate ist in der Regel besser."
              subtitle={dateSubtitle}
              valueLabel={currentRangeLabel}
              value={kpis.bounceRate.value}
              change={kpis.bounceRate.change}
              data={allChartData?.bounceRate}
              color="#f59e0b"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatPercent}
              barComparison={{ current: 306907, previous: 250013 }}
            />
          )}

          {kpis.avgEngagementTime && (
            <TableauKpiCard
              title="Ø Verweildauer"
              description="Durchschnittliche Zeit, die ein aktiver Nutzer auf Ihrer Webseite verbracht hat."
              subtitle={dateSubtitle}
              valueLabel={currentRangeLabel}
              value={kpis.avgEngagementTime.value}
              change={kpis.avgEngagementTime.change}
              data={allChartData?.avgEngagementTime}
              color="#8b5cf6"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatTime}
              barComparison={{ current: 328182, previous: 418105 }}
            />
          )}

          {kpis.engagementRate && (
            <TableauKpiCard
              title="Engagement Rate"
              description="Prozentsatz der Sitzungen, die länger als 10s dauerten oder eine Conversion enthielten."
              subtitle={dateSubtitle}
              valueLabel={currentRangeLabel}
              value={kpis.engagementRate.value}
              change={kpis.engagementRate.change}
              data={allChartData?.engagementRate}
              color="#ec4899"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatPercent}
              barComparison={{ current: 4410644, previous: 2459714 }}
            />
          )}

        </div>
      </div>

    </div>
  );
}
