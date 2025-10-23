// src/components/KpiCardsGrid.tsx
import React from 'react';
import KpiCard from './kpi-card'; // Verwendet die bestehende kpi-card Komponente
import type { KPI } from '@/types/dashboard';

interface KpiCardsGridProps {
  kpis: {
    clicks: KPI;
    impressions: KPI;
    sessions: KPI;
    totalUsers: KPI;
  };
  isLoading?: boolean;
}

/**
 * KpiCardsGrid - Grid-Layout für die 4 Standard-KPI-Karten
 * 
 * Diese Komponente kapselt das Grid-Layout für Klicks, Impressionen, 
 * Sitzungen und Nutzer-KPIs und verwendet die bestehende KpiCard Komponente.
 * 
 * @param kpis - Objekt mit allen KPI-Werten
 * @param isLoading - Optional: Zeigt Lade-Skeleton an
 */

export default function KpiCardsGrid({ kpis, isLoading = false }: KpiCardsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KpiCard 
        title="Klicks" 
        isLoading={isLoading} 
        value={kpis.clicks.value} 
        change={kpis.clicks.change} 
      />
      <KpiCard 
        title="Impressionen" 
        isLoading={isLoading} 
        value={kpis.impressions.value} 
        change={kpis.impressions.change} 
      />
      <KpiCard 
        title="Sitzungen" 
        isLoading={isLoading} 
        value={kpis.sessions.value} 
        change={kpis.sessions.change} 
      />
      <KpiCard 
        title="Nutzer" 
        isLoading={isLoading} 
        value={kpis.totalUsers.value} 
        change={kpis.totalUsers.change} 
      />
    </div>
  );
}
