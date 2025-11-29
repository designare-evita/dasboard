// src/components/TableauKpiGrid.tsx
'use client';

import React from 'react';
import TableauKpiCard from './tableau-kpi-card';
import { KpiDatum, ChartPoint, ApiErrorStatus } from '@/lib/dashboard-shared';

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
  apiErrors
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

  return (
    <div className="space-y-6">
      
      {/* ZEILE 1: Traffic Metriken */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Traffic & Reichweite
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          
          <TableauKpiCard
            title="Sessions"
            subtitle="vs YTD PY"
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
            subtitle="vs YTD PY"
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
              subtitle="vs YTD PY"
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
            subtitle="vs YTD PY"
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
            subtitle="vs YTD PY"
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

          {kpis.conversions && (
            <TableauKpiCard
              title="Conversions"
              subtitle="vs YTD PY"
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

        </div>
      </div>

      {/* ZEILE 2: Qualitäts-Metriken */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
          Qualität & Engagement
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          
          {kpis.bounceRate && (
            <TableauKpiCard
              title="Absprungrate"
              subtitle="vs YTD PY"
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
              subtitle="vs YTD PY"
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
              subtitle="vs YTD PY"
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
