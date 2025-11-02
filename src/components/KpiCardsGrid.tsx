// src/components/KpiCardsGrid.tsx (Version 3 - Mit Sparklines)
import React from 'react';
import KpiCard from './kpi-card';
// ✅ NEU: KPI_TAB_META für Farben und ChartPoint für Typ importieren
import { KPI_TAB_META } from '@/lib/dashboard-shared';
import type { KPI, ChartPoint } from '@/types/dashboard'; 
import { InfoCircle } from 'react-bootstrap-icons';

interface KpiCardsGridProps {
  kpis: {
    clicks: KPI;
    impressions: KPI;
    sessions: KPI;
    totalUsers: KPI;
  };
  isLoading?: boolean;
  // ✅ NEU: allChartData Prop hinzufügen
  allChartData?: {
    clicks?: ChartPoint[];
    impressions?: ChartPoint[];
    sessions?: ChartPoint[];
    totalUsers?: ChartPoint[];
  };
}

/**
 * KpiCardsGrid - Grid-Layout für die 4 Standard-KPI-Karten
 */
export default function KpiCardsGrid({ kpis, isLoading = false, allChartData }: KpiCardsGridProps) {
  
  // (kpiInfo bleibt gleich)
  const kpiInfo = {
    clicks: {
      title: "Was sind Klicks?",
      description: "Die Anzahl der Klicks auf Ihre Website-Links in den Google-Suchergebnissen..."
    },
    impressions: {
      title: "Was sind Impressionen?",
      description: "Wie oft ein Link zu Ihrer Website in den Google-Suchergebnissen angezeigt wurde..."
    },
    sessions: {
      title: "Was sind Sitzungen?",
      description: "Eine Sitzung ist eine Gruppe von Interaktionen, die ein Nutzer innerhalb eines bestimmten Zeitraums..."
    },
    totalUsers: {
      title: "Was sind Nutzer?",
      description: "Die Anzahl eindeutiger Besucher Ihrer Website..."
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Klicks */}
      <div className="relative">
        <KpiCard 
          title="Klicks" 
          isLoading={isLoading} 
          value={kpis.clicks.value} 
          change={kpis.clicks.change} 
          // ✅ NEU: Daten & Farbe übergeben
          data={allChartData?.clicks}
          color={KPI_TAB_META.clicks.color}
        />
        {!isLoading && (
          <InfoTooltip 
            title={kpiInfo.clicks.title}
            description={kpiInfo.clicks.description}
          />
        )}
      </div>

      {/* Impressionen */}
      <div className="relative">
        <KpiCard 
          title="Impressionen" 
          isLoading={isLoading} 
          value={kpis.impressions.value} 
          change={kpis.impressions.change} 
          // ✅ NEU: Daten & Farbe übergeben
          data={allChartData?.impressions}
          color={KPI_TAB_META.impressions.color}
        />
        {!isLoading && (
          <InfoTooltip 
            title={kpiInfo.impressions.title}
            description={kpiInfo.impressions.description}
          />
        )}
      </div>

      {/* Sitzungen */}
      <div className="relative">
        <KpiCard 
          title="Sitzungen" 
          isLoading={isLoading} 
          value={kpis.sessions.value} 
          change={kpis.sessions.change} 
          // ✅ NEU: Daten & Farbe übergeben
          data={allChartData?.sessions}
          color={KPI_TAB_META.sessions.color}
        />
        {!isLoading && (
          <InfoTooltip 
            title={kpiInfo.sessions.title}
            description={kpiInfo.sessions.description}
          />
        )}
      </div>

      {/* Nutzer */}
      <div className="relative">
        <KpiCard 
          title="Nutzer" 
          isLoading={isLoading} 
          value={kpis.totalUsers.value} 
          change={kpis.totalUsers.change} 
          // ✅ NEU: Daten & Farbe übergeben
          data={allChartData?.totalUsers}
          color={KPI_TAB_META.totalUsers.color}
        />
        {!isLoading && (
          <InfoTooltip 
            title={kpiInfo.totalUsers.title}
            description={kpiInfo.totalUsers.description}
          />
        )}
      </div>
    </div>
  );
}

/**
 * InfoTooltip - (Diese Funktion bleibt unverändert)
 */
function InfoTooltip({ title, description }: { title: string; description: string }) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className="absolute top-3 right-3 z-10">
      <div 
        className="relative"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {/* Info-Icon */}
        <button
          type="button"
          className="p-1 rounded-full hover:bg-gray-100 transition-colors cursor-help"
          aria-label="Mehr Informationen"
        >
          <InfoCircle 
            size={18} 
            className="text-gray-400 hover:text-indigo-600 transition-colors" 
          />
        </button>

        {/* Tooltip */}
        {isVisible && (
          <div className="absolute right-0 top-8 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="absolute -top-2 right-3 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"></div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{title}</h4>
            <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
