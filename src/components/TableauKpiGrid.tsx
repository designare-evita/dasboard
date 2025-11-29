// src/components/TableauKpiGrid.tsx
'use client';

import React, { useMemo } from 'react';
import TableauKpiCard from './tableau-kpi-card';
import { KpiDatum, ChartPoint, ApiErrorStatus } from '@/lib/dashboard-shared';
import { getRangeLabel, DateRangeOption } from '@/components/DateRangeSelector';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// ✅ EXPORT der Interfaces
export interface ExtendedKpis {
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

export interface TableauKpiGridProps {
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
  const getComparison = (kpi: KpiDatum) => {
    if (!kpi || typeof kpi.value !== 'number' || typeof kpi.change !== 'number') {
      return undefined;
    }
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
            description="Anzahl der Anzeigen Ihrer Website in den Google-Suchergebnissen. Jedes Mal, wenn ein Link zu Ihrer Seite erscheint, wird dies als Impression gezählt."
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
            description="Anzahl der Klicks aus der Google-Suche auf Ihre Website. Misst die tatsächliche Nutzerinteraktion mit Ihren Suchergebnissen."
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
              description="Erstbesucher Ihrer Website im gewählten Zeitraum. Diese Nutzer haben Ihre Seite zum ersten Mal besucht und sind besonders wertvoll für Wachstum."
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
            description="Gesamtzahl eindeutiger Nutzer, die Ihre Website besucht haben. Ein Nutzer wird nur einmal gezählt, unabhängig davon, wie oft er zurückkehrt."
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
            description="Anzahl der Besuche auf Ihrer Website. Ein Nutzer kann mehrere Sessions haben (z.B. morgens und abends). Eine Session endet nach 30 Min. Inaktivität."
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
              description="Anteil der Sitzungen mit aktiver Interaktion. Eine Session gilt als engaged, wenn sie länger als 10 Sekunden dauert, eine Conversion auslöst oder 2+ Seitenaufrufe hat."
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
              description="Anzahl der erreichten Ziele (z.B. Käufe, Formular-Absendungen, Anrufe). Conversions messen den geschäftlichen Erfolg Ihrer Website."
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
              description="Durchschnittliche Zeit, die ein Nutzer aktiv auf Ihrer Website verbringt. Längere Verweildauer deutet auf hochwertigen, relevanten Content hin."
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
              description="Anteil der Besuche ohne Interaktion. Eine hohe Absprungrate kann auf irrelevanten Content oder technische Probleme hinweisen. Niedriger ist meist besser."
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
