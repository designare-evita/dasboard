// src/components/KpiCardsGrid.tsx
import React from 'react';
import KpiCard from './kpi-card';
import { KpiData, ChartEntry } from '@/lib/dashboard-shared';

interface KpiCardsGridProps {
  kpis: KpiData;
  isLoading: boolean;
  allChartData?: Record<string, ChartEntry[]>; 
  apiErrors?: Record<string, string>;
}

export default function KpiCardsGrid({ kpis, isLoading, allChartData, apiErrors }: KpiCardsGridProps) {
  
  const renderCard = (
    title: string,
    kpiKey: keyof KpiData | string,
    value: number | string,
    change: number,
    isPercentage: boolean = false,
    description?: string,
    inverseTrend: boolean = false
  ) => {
    // Mapping logic (gekürzt für Übersicht, Logik bleibt gleich wie vorher)
    let chartData: ChartEntry[] = [];
    let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';

    if (typeof kpiKey === 'string' && allChartData) {
      if (kpiKey === 'bounceRate' && allChartData.engagementRate) {
         chartData = allChartData.engagementRate.map(entry => ({
            date: entry.date,
            value: 100 - entry.value
         }));
      } else if (allChartData[kpiKey]) {
         chartData = allChartData[kpiKey] || [];
      }
    }
    
    if (change > 0) trendDirection = 'up';
    if (change < 0) trendDirection = 'down';

    return (
      // ÄNDERUNG: 'className' prop übergeben, um card-glass und hover-Effekt anzuwenden
      <div className="card-glass card-glass-hover h-full">
        <KpiCard
          title={title}
          value={value}
          change={change}
          trend={trendDirection}
          data={chartData}
          isLoading={isLoading}
          isPercentage={isPercentage}
          description={description}
          inverseTrend={inverseTrend}
          // WICHTIG: KpiCard sollte transparenten Hintergrund akzeptieren oder wir wrappen sie wie hier.
          // Wenn KpiCard selbst Stile hat, müssen wir 'className' dort evtl. entfernen/anpassen.
          // Da wir hier wrappen, gehen wir davon aus, dass KpiCard transparent oder weiß ist.
          // Idealerweise sollte KpiCard "bg-transparent" sein, wenn wir hier "card-glass" nutzen.
          className="bg-transparent shadow-none border-none" // Überschreibt Standard-Styles in KpiCard
        />
      </div>
    );
  };

  // ... Rest der Render-Logik (Grid Layout) bleibt gleich ...
  // Ich gebe hier nur das Beispiel für den Grid-Container zurück
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
       {/* Beispielaufruf - du nutzt hier deine bestehende Logik */}
       {renderCard("Besucher (Sessions)", "sessions", kpis.sessions.value, kpis.sessions.change)}
       {renderCard("Nutzer (Total)", "users", kpis.users.value, kpis.users.change)}
       {renderCard("Absprungrate", "bounceRate", kpis.bounceRate.value, kpis.bounceRate.change, true, "Kehrwert der Engagement Rate", true)}
       {renderCard("Durchschn. Engagement", "avgEngagementTime", kpis.avgEngagementTime.value, kpis.avgEngagementTime.change, false, "Sekunden")}
    </div>
  );
}
