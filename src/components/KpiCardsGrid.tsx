// src/components/KpiCardsGrid.tsx
'use client';

import React, { useState } from 'react';
import KpiCard from './kpi-card';
import { 
  KpiDatum, 
  ProjectDashboardData, 
  ApiErrorStatus,
  KPI_TAB_META
} from '@/lib/dashboard-shared';
import { InfoCircle } from 'react-bootstrap-icons';

/**
 * InfoTooltip - Zeigt Details zu einer KPI an
 */
function InfoTooltip({ title, description }: { title: string; description: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-10 print:hidden">
      <div
        className="relative"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {/* Info-Icon */}
        <button
          type="button"
          className="p-1 rounded-full hover:bg-gray-100/50 transition-colors cursor-help"
          aria-label="Mehr Informationen"
        >
          <InfoCircle
            size={16}
            className="text-gray-400 hover:text-indigo-600 transition-colors"
          />
        </button>

        {/* Tooltip */}
        {isVisible && (
          <div className="absolute right-0 top-8 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="absolute -top-2 right-3 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"></div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{title}</h4>
            <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Wir definieren den Typ für die KPIs, wie er von normalizeFlatKpis zurückgegeben wird (alles Required)
type NormalizedKpis = {
  clicks: KpiDatum;
  impressions: KpiDatum;
  sessions: KpiDatum;
  totalUsers: KpiDatum;
};

interface KpiCardsGridProps {
  kpis: NormalizedKpis;
  isLoading?: boolean;
  allChartData?: ProjectDashboardData['charts'];
  apiErrors?: ApiErrorStatus;
}

export default function KpiCardsGrid({
  kpis,
  isLoading = false,
  allChartData,
  apiErrors,
}: KpiCardsGridProps) {
  
  if (!kpis) {
    return null;
  }
  
  const kpiInfo = {
    clicks: {
      title: 'Klicks (GSC)',
      description: 'Anzahl der Klicks auf Ihre Website-Links in den Google-Suchergebnissen.',
    },
    impressions: {
      title: 'Impressionen (GSC)',
      description: 'Wie oft ein Link zu Ihrer Website in den Google-Suchergebnissen gesehen wurde.',
    },
    sessions: {
      title: 'Sitzungen (GA4)',
      description: 'Anzahl der Sitzungen mit Interaktionen auf Ihrer Website.',
    },
    totalUsers: {
      title: 'Nutzer (GA4)',
      description: 'Anzahl der eindeutigen Nutzer, die Ihre Website besucht haben.',
    },
  };

  const gscError = apiErrors?.gsc;
  const ga4Error = apiErrors?.ga4;

  // Helper für das Rendern einer Karte
  const renderCard = (
    key: keyof NormalizedKpis, 
    title: string, 
    error: string | undefined,
    info: { title: string, description: string }
  ) => (
    <div className="card-glass card-glass-hover h-full relative group">
      <KpiCard
        title={title}
        isLoading={isLoading}
        value={kpis[key].value}
        change={kpis[key].change}
        data={allChartData?.[key]}
        color={KPI_TAB_META[key].color}
        error={error || null}
        // Da wir "card-glass" im Wrapper nutzen, setzen wir hier transparent
        // (falls KpiCard selbst Styles hat, müssen diese ggf. angepasst werden, 
        // aber bg-transparent/shadow-none überschreibt meistens Tailwind-Klassen)
        // Hier übergeben wir keine className Prop an KpiCard, da wir den Wrapper stylen.
      />
      
      {!isLoading && !error && (
        <InfoTooltip
          title={info.title}
          description={info.description}
        />
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {renderCard('clicks', 'Klicks', gscError, kpiInfo.clicks)}
      {renderCard('impressions', 'Impressionen', gscError, kpiInfo.impressions)}
      {renderCard('sessions', 'Sitzungen', ga4Error, kpiInfo.sessions)}
      {renderCard('totalUsers', 'Nutzer', ga4Error, kpiInfo.totalUsers)}
    </div>
  );
}
