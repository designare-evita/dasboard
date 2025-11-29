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

  // ✅ HILFSFUNKTION: Berechnet den Vorperioden-Wert dynamisch
  // Formel: Aktuell / (1 + (ÄnderungInProzent / 100))
  const getComparison = (kpi: KpiDatum) => {
    if (!kpi || typeof kpi.value !== 'number' || typeof kpi.change !== 'number') {
      return undefined;
    }
    // Verhindere Division durch Null bei -100%
    if (kpi.change === -100) return { current: kpi.value, previous: 0 };
    
    const previous = kpi.value / (1 + kpi.change / 100);
    return {
      current: kpi.value,
      previous: previous
    };
  };

  return (
    <div className="space-y-8">
      
      {/* ZEILE 1: Traffic & Reichweite */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 px-1">
          Traffic & Reichweite
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          
          <TableauKpiCard
            title="Impressionen"
            description="Wie oft ein Link zu Ihrer Webseite in den Google Suchergebnissen angezeigt wurde."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.impressions.value}
            change={kpis.impressions.change}
            data={allChartData?.impressions}
            color="#8b5cf6"
            error={gscError}
            isLoading={isLoading}
            barComparison={getComparison(kpis.impressions)}
          />

          <TableauKpiCard
            title="Google Klicks"
            description="Wie oft Nutzer in der Google Suche auf einen Link zu Ihrer Webseite geklickt haben."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.clicks.value}
            change={kpis.clicks.change}
            data={allChartData?.clicks}
            color="#3b82f6"
            error={gscError}
            isLoading={isLoading}
            barComparison={getComparison(kpis.clicks)}
          />

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
              color="#6366f1"
              error={ga4Error}
              isLoading={isLoading}
              barComparison={getComparison(kpis.newUsers)}
            />
          )}

          <TableauKpiCard
            title="Besucher"
            description="Anzahl der eindeutigen Nutzer im gewählten Zeitraum."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.totalUsers.value}
            change={kpis.totalUsers.change}
            data={allChartData?.totalUsers}
            color="#0ea5e9"
            error={ga4Error}
            isLoading={isLoading}
            barComparison={getComparison(kpis.totalUsers)}
          />

          <TableauKpiCard
            title="Sessions"
            description="Anzahl der Sitzungen (Besuche). Ein Nutzer kann mehrere Sitzungen haben."
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.sessions.value}
            change={kpis.sessions.change}
            data={allChartData?.sessions}
            color="#06b6d4"
            error={ga4Error}
            isLoading={isLoading}
            barComparison={getComparison(kpis.sessions)}
          />

        </div>
      </div>

      {/* ZEILE 2: Qualität & Engagement */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 px-1">
          Qualität & Engagement
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          
          {kpis.engagementRate && (
            <TableauKpiCard
              title="Engagement Rate"
              description="Anteil der Sitzungen mit Interaktion (länger als 10s oder Conversion)."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.engagementRate.value}
              change={kpis.engagementRate.change}
              data={allChartData?.engagementRate}
              color="#ec4899"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatPercent}
              barComparison={getComparison(kpis.engagementRate)}
            />
          )}

          {kpis.conversions && (
            <TableauKpiCard
              title="Conversions"
              description="Erreichte Ziele (z.B. Käufe, Anfragen)."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.conversions.value}
              change={kpis.conversions.change}
              data={allChartData?.conversions}
              color="#10b981"
              error={ga4Error}
              isLoading={isLoading}
              barComparison={getComparison(kpis.conversions)}
            />
          )}

          {kpis.avgEngagementTime && (
            <TableauKpiCard
              title="Ø Verweildauer"
              description="Durchschnittliche Zeit pro aktivem Nutzer."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.avgEngagementTime.value}
              change={kpis.avgEngagementTime.change}
              data={allChartData?.avgEngagementTime}
              color="#f59e0b"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatTime}
              barComparison={getComparison(kpis.avgEngagementTime)}
            />
          )}

          {kpis.bounceRate && (
            <TableauKpiCard
              title="Absprungrate"
              description="Sitzungen ohne Interaktion. Niedriger ist meist besser."
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.bounceRate.value}
              change={kpis.bounceRate.change}
              data={allChartData?.bounceRate}
              color="#f43f5e"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatPercent}
              barComparison={getComparison(kpis.bounceRate)}
            />
          )}

        </div>
      </div>

    </div>
  );
}
