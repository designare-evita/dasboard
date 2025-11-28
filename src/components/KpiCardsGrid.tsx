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
 * Zeigt einen Tooltip mit Erklärung an
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
        <button
          type="button"
          className="p-1 rounded-full hover:bg-black/5 transition-colors cursor-help"
          aria-label="Info"
        >
          <InfoCircle
            size={14}
            className="text-gray-400 hover:text-indigo-600 transition-colors"
          />
        </button>

        {isVisible && (
          <div className="absolute right-0 top-6 w-60 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-100 p-3 z-20 animate-in fade-in zoom-in-95 duration-200">
            <strong className="block text-sm font-semibold text-gray-900 mb-1">{title}</strong>
            <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Wir erweitern den Typ lokal, falls er im Shared noch nicht aktualisiert wurde
// (Dies verhindert TypeScript Fehler, wenn dashboard-shared noch alt ist)
type ExtendedKpis = {
  clicks: KpiDatum;
  impressions: KpiDatum;
  sessions: KpiDatum;
  totalUsers: KpiDatum;
  conversions?: KpiDatum;      // Optional, falls Daten noch fehlen
  engagementRate?: KpiDatum;   // Optional
};

interface KpiCardsGridProps {
  kpis: ExtendedKpis; // Nutzen unseren erweiterten Typ
  isLoading?: boolean;
  allChartData?: any; // Flexibler Typ für Charts
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
    conversions: {
      title: 'Conversions (Ziele)',
      description: 'Anzahl der erreichten Ziele (z.B. Kontaktanfragen, Käufe), wie in Google Analytics 4 definiert.',
    },
    engagementRate: {
      title: 'Engagement Rate',
      description: 'Prozentsatz der Sitzungen, die länger als 10 Sekunden dauerten, eine Conversion hatten oder 2+ Seitenaufrufe umfassten.',
    },
    clicks: {
      title: 'Google Klicks',
      description: 'Wie oft Nutzer in der Google-Suche auf Ihre Website geklickt haben.',
    },
    impressions: {
      title: 'Google Impressionen',
      description: 'Wie oft ein Link zu Ihrer Website in den Google-Suchergebnissen gesehen wurde.',
    },
    sessions: {
      title: 'Sitzungen',
      description: 'Anzahl der Besuche auf Ihrer Website.',
    },
    totalUsers: {
      title: 'Besucher',
      description: 'Anzahl der eindeutigen Personen (Nutzer), die Ihre Website besucht haben.',
    },
  };

  const gscError = apiErrors?.gsc;
  const ga4Error = apiErrors?.ga4;

  // Helper für das Rendern
  const renderCard = (
    key: keyof ExtendedKpis, 
    title: string, 
    error: string | undefined,
    info: { title: string, description: string },
    overrideColor?: string // Optionale Farbe
  ) => {
    const kpiData = kpis[key];
    // Fallback, falls Daten noch nicht geladen sind
    if (!kpiData) return null;

    // Farbe ermitteln (entweder Override, oder aus Metadaten, oder Default Blau)
    // Wir casten key zu any, um Index-Zugriff auf KPI_TAB_META zu erlauben, falls Typen nicht perfekt matchen
    const metaColor = (KPI_TAB_META as any)[key]?.color;
    const finalColor = overrideColor || metaColor || '#3b82f6';

    return (
      <div className="card-glass hover:shadow-lg transition-all duration-300 relative group h-full">
        <KpiCard
          title={title}
          isLoading={isLoading}
          value={kpiData.value}
          change={kpiData.change}
          data={allChartData?.[key]}
          color={finalColor}
          error={error || null}
          className="bg-transparent shadow-none border-none h-full"
        />
        
        {!isLoading && !error && (
          <InfoTooltip
            title={info.title}
            description={info.description}
          />
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {/* Wichtigste Business Metriken zuerst */}
      {renderCard('conversions', 'Conversions', ga4Error, kpiInfo.conversions, '#f59e0b')}
      {renderCard('engagementRate', 'Engagement Rate', ga4Error, kpiInfo.engagementRate, '#ec4899')}
      
      {/* Traffic Qualität */}
      {renderCard('clicks', 'Google Klicks', gscError, kpiInfo.clicks)}
      
      {/* Volumen Metriken */}
      {renderCard('impressions', 'Impressionen', gscError, kpiInfo.impressions)}
      {renderCard('sessions', 'Sitzungen', ga4Error, kpiInfo.sessions)}
      {renderCard('totalUsers', 'Besucher', ga4Error, kpiInfo.totalUsers)}
    </div>
  );
}
