// src/components/KpiCardsGrid.tsx (KORRIGIERT & ERWEITERT)

import { useState } from 'react';
import KpiCard from './kpi-card';
// +++ NEU: ApiErrorStatus importiert +++
import { 
  KPI_TAB_META, 
  ProjectDashboardData, 
  ApiErrorStatus 
} from '@/lib/dashboard-shared';
import type { ChartPoint } from '@/types/dashboard';
import { InfoCircle } from 'react-bootstrap-icons';

// ... (InfoTooltip Komponente bleibt unverändert) ...
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
          className="p-1 rounded-full hover:bg-gray-100 transition-colors cursor-help"
          aria-label="Mehr Informationen"
        >
          <InfoCircle
            size={18}
            className="text-gray-400 hover:text-indigo-600 transition-colors"
          />
        </button>
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


// Props-Interface (angepasst an dashboard-shared Typen)
interface KpiCardsGridProps {
  kpis: Required<ProjectDashboardData['kpis']>; // Stellt sicher, dass alle KPIs vorhanden sind
  isLoading?: boolean;
  allChartData?: ProjectDashboardData['charts'];
  apiErrors?: ApiErrorStatus; // +++ NEU: Prop für Fehler +++
}

/**
 * KpiCardsGrid - Grid-Layout für die 4 Standard-KPI-Karten
 */
export default function KpiCardsGrid({
  kpis,
  isLoading = false,
  allChartData,
  apiErrors, // +++ NEU: Prop entgegennehmen +++
}: KpiCardsGridProps) {
  
  if (!kpis) {
    return null;
  }
  
  // ... (kpiInfo-Objekt bleibt unverändert) ...
  const kpiInfo = {
    clicks: { title: 'Was sind Klicks?', description: '...'},
    impressions: { title: 'Was sind Impressionen?', description: '...'},
    sessions: { title: 'Was sind Sitzungen?', description: '...'},
    totalUsers: { title: 'Was sind Nutzer?', description: '...'},
  };

  // +++ NEU: Fehler extrahieren +++
  const gscError = apiErrors?.gsc;
  const ga4Error = apiErrors?.ga4;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Klicks */}
      <div className="relative kpi-card-wrapper">
        <KpiCard
          title="Klicks"
          isLoading={isLoading}
          value={kpis.clicks.value}
          change={kpis.clicks.change}
          data={allChartData?.clicks}
          color={KPI_TAB_META.clicks.color}
          error={gscError} // +++ NEU: Fehler weitergeben +++
        />
        {!isLoading && !gscError && ( // +++ NEU: Tooltip bei Fehler ausblenden +++
          <InfoTooltip
            title={kpiInfo.clicks.title}
            description={kpiInfo.clicks.description}
          />
        )}
      </div>

      {/* Impressionen */}
      <div className="relative kpi-card-wrapper">
        <KpiCard
          title="Impressionen"
          isLoading={isLoading}
          value={kpis.impressions.value}
          change={kpis.impressions.change}
          data={allChartData?.impressions}
          color={KPI_TAB_META.impressions.color}
          error={gscError} // +++ NEU: Fehler weitergeben +++
        />
        {!isLoading && !gscError && ( // +++ NEU: Tooltip bei Fehler ausblenden +++
          <InfoTooltip
            title={kpiInfo.impressions.title}
            description={kpiInfo.impressions.description}
          />
        )}
      </div>

      {/* Sitzungen */}
      <div className="relative kpi-card-wrapper">
        <KpiCard
          title="Sitzungen"
          isLoading={isLoading}
          value={kpis.sessions.value}
          change={kpis.sessions.change}
          data={allChartData?.sessions}
          color={KPI_TAB_META.sessions.color}
          error={ga4Error} // +++ NEU: Fehler weitergeben +++
        />
        {!isLoading && !ga4Error && ( // +++ NEU: Tooltip bei Fehler ausblenden +++
          <InfoTooltip
            title={kpiInfo.sessions.title}
            description={kpiInfo.sessions.description}
          />
        )}
      </div>

      {/* Nutzer */}
      <div className="relative kpi-card-wrapper">
        <KpiCard
          title="Nutzer"
          isLoading={isLoading}
          value={kpis.totalUsers.value}
          change={kpis.totalUsers.change}
          data={allChartData?.totalUsers}
          color={KPI_TAB_META.totalUsers.color}
          error={ga4Error} // +++ NEU: Fehler weitergeben +++
        />
        {!isLoading && !ga4Error && ( // +++ NEU: Tooltip bei Fehler ausblenden +++
          <InfoTooltip
            title={kpiInfo.totalUsers.title}
            description={kpiInfo.totalUsers.description}
          />
        )}
      </div>
    </div>
  );
}
