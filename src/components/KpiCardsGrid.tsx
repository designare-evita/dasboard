// src/components/KpiCardsGrid.tsx

import React from 'react';
import KpiCard from './kpi-card'; // ← Importiert DEINE existierende kpi-card
import type { KPI } from '@/types/dashboard';

export default function KpiCardsGrid({ kpis, isLoading = false }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Ruft 4x deine kpi-card.tsx auf */}
      <KpiCard title="Klicks" value={kpis.clicks.value} change={kpis.clicks.change} isLoading={isLoading} />
      <KpiCard title="Impressionen" value={kpis.impressions.value} change={kpis.impressions.change} isLoading={isLoading} />
      <KpiCard title="Sitzungen" value={kpis.sessions.value} change={kpis.sessions.change} isLoading={isLoading} />
      <KpiCard title="Nutzer" value={kpis.totalUsers.value} change={kpis.totalUsers.change} isLoading={isLoading} />
    </div>
  );
}
