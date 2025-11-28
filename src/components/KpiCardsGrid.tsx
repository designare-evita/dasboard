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

function InfoTooltip({ title, description }: { title: string; description: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-10 print:hidden">
      <div
        className="relative"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        <button type="button" className="p-1 rounded-full hover:bg-black/5 transition-colors cursor-help">
          <InfoCircle size={14} className="text-gray-400 hover:text-indigo-600 transition-colors" />
        </button>
        {isVisible && (
          <div className="absolute right-0 top-6 w-56 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-100 p-3 z-20 text-xs text-gray-600 leading-relaxed animate-in fade-in zoom-in-95 duration-200">
            <strong className="block text-gray-900 mb-1">{title}</strong>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

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
  
  if (!kpis) return null;
  
  const kpiInfo = {
    clicks: { title: 'Klicks (GSC)', description: 'Wie oft Nutzer in der Google-Suche auf Ihre Website geklickt haben.' },
    impressions: { title: 'Impressionen (GSC)', description: 'Wie oft ein Link zu Ihrer Website in der Google-Suche gesehen wurde.' },
    sessions: { title: 'Sitzungen (GA4)', description: 'Anzahl der Besuche mit aktiver Interaktion.' },
    totalUsers: { title: 'Nutzer (GA4)', description: 'Anzahl der eindeutigen Personen, die die Website besucht haben.' },
  };

  const renderCard = (key: keyof NormalizedKpis, title: string, error?: string, info?: {title: string, description: string}) => (
    <div className="card-glass hover:shadow-lg transition-all duration-300 relative group h-full">
      <KpiCard
        title={title}
        isLoading={isLoading}
        value={kpis[key].value}
        change={kpis[key].change}
        data={allChartData?.[key]}
        color={KPI_TAB_META[key].color}
        error={error || null}
        // WICHTIG: Transparent setzen, damit der card-glass Effekt wirkt
        className="bg-transparent shadow-none border-none h-full"
      />
      
      {!isLoading && !error && info && (
        <InfoTooltip title={info.title} description={info.description} />
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {renderCard('clicks', 'Klicks', apiErrors?.gsc, kpiInfo.clicks)}
      {renderCard('impressions', 'Impressionen', apiErrors?.gsc, kpiInfo.impressions)}
      {renderCard('sessions', 'Sitzungen', apiErrors?.ga4, kpiInfo.sessions)}
      {renderCard('totalUsers', 'Nutzer', apiErrors?.ga4, kpiInfo.totalUsers)}
    </div>
  );
}
