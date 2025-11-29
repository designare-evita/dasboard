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

  // Helper für Format-Funktionen
  const formatPercent = (v: number) => `${v.toFixed(1)}%`;
  const formatTime = (v: number) => {
    const minutes = Math.floor(v / 60);
    const seconds = Math.floor(v % 60);
    return `${minutes}m ${seconds}s`;
  };

  // 1. Ermittle das dynamische Datum aus den Chart-Daten (Start - Ende)
  const dateSubtitle = useMemo(() => {
    // Versuche Daten aus Sessions oder Clicks zu nehmen
    const dataPoints = allChartData?.sessions || allChartData?.clicks;
    
    if (dataPoints && dataPoints.length > 0) {
      // Sortiere sicherheitshalber
      const sorted = [...dataPoints].sort((a, b) => a.date - b.date);
      const startDate = sorted[0].date;
      const endDate = sorted[sorted.length - 1].date;
      
      try {
        return `${format(startDate, 'dd.MM.', { locale: de })} - ${format(endDate, 'dd.MM.yyyy', { locale: de })}`;
      } catch (e) {
        console.error('Date formatting error', e);
      }
    }
    // Fallback
    return 'Zeitraum';
  }, [allChartData]);

  // 2. Ermittle das Label für "Latest Month" basierend auf dem DatePicker
  const rangeLabel = getRangeLabel(dateRange as DateRangeOption);

  return (
    <div className="space-y-6">
      
      {/* ZEILE 1: Traffic Metriken */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Traffic & Reichweite
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          
          <TableauKpiCard
            title="Sessions"
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.sessions.value}
            change={kpis.sessions.change}
            data={allChartData?.sessions}
            color="#3b82f6"
            error={ga4Error}
            isLoading={isLoading}
            barComparison={{
              current: 8838555,
              previous: 6173228
            }}
            goalMet={true}
          />

          <TableauKpiCard
            title="Besucher"
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.totalUsers.value}
            change={kpis.totalUsers.change}
            data={allChartData?.totalUsers}
            color="#3b82f6"
            error={ga4Error}
            isLoading={isLoading}
            barComparison={{
              current: 5265447,
              previous: 3301386
            }}
            goalMet={true}
          />

          {kpis.newUsers && (
            <TableauKpiCard
              title="Neue Besucher"
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.newUsers.value}
              change={kpis.newUsers.change}
              data={allChartData?.newUsers}
              color="#6366f1"
              error={ga4Error}
              isLoading={isLoading}
              barComparison={{
                current: 1779128,
                previous: 1438809
              }}
              goalMet={true}
            />
          )}

          <TableauKpiCard
            title="Google Klicks"
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.clicks.value}
            change={kpis.clicks.change}
            data={allChartData?.clicks}
            color="#3b82f6"
            error={gscError}
            isLoading={isLoading}
            barComparison={{
              current: 56804,
              previous: 58172
            }}
            goalMet={true}
          />

          <TableauKpiCard
            title="Impressionen"
            subtitle={dateSubtitle}
            valueLabel={rangeLabel}
            changeLabel="Veränderung"
            value={kpis.impressions.value}
            change={kpis.impressions.change}
            data={allChartData?.impressions}
            color="#8b5cf6"
            error={gscError}
            isLoading={isLoading}
            barComparison={{
              current: 15231,
              previous: 15007
            }}
            goalMet={true}
          />

        </div>
      </div>

      {/* ZEILE 2: Qualität & Engagement */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Qualität & Engagement
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          
          {/* ✅ Conversions hierher verschoben */}
          {kpis.conversions && (
            <TableauKpiCard
              title="Conversions"
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.conversions.value}
              change={kpis.conversions.change}
              data={allChartData?.conversions}
              color="#10b981"
              error={ga4Error}
              isLoading={isLoading}
              barComparison={{
                current: 854802,
                previous: 841672
              }}
              goalMet={true}
            />
          )}
          
          {kpis.bounceRate && (
            <TableauKpiCard
              title="Absprungrate"
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.bounceRate.value}
              change={kpis.bounceRate.change}
              data={allChartData?.bounceRate}
              color="#f59e0b"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatPercent}
              barComparison={{
                current: 306907,
                previous: 250013
              }}
              goalMet={false}
            />
          )}

          {kpis.avgEngagementTime && (
            <TableauKpiCard
              title="Ø Verweildauer"
              subtitle={dateSubtitle}
              valueLabel={rangeLabel}
              changeLabel="Veränderung"
              value={kpis.avgEngagementTime.value}
              change={kpis.avgEngagementTime.change}
              data={allChartData?.avgEngagementTime}
              color="#8b5cf6"
              error={ga4Error}
              isLoading={isLoading}
              formatValue={formatTime}
              barComparison={{
                current: 328182,
                previous: 418105
              }}
              goalMet={true}
            />
          )}

          {kpis.engagementRate && (
            <TableauKpiCard
              title="Engagement Rate"
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
              barComparison={{
                current: 4410644,
                previous: 2459714
              }}
              goalMet={true}
            />
          )}

        </div>
      </div>

    </div>
  );
}
