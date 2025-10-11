// src/app/page.tsx
'use client';

import { useSession } from "next-auth/react";
import useApiData from "@/hooks/use-api-data"; // Der Hook für den Datenabruf
import Header from "@/components/layout/Header";
import KpiCard from "@/components/kpi-card";

// Definiert die erwartete Struktur der Daten von unserer /api/data Route
interface KpiData {
  value: number;
  change: number;
}

interface DashboardData {
  searchConsole: {
    clicks: KpiData;
    impressions: KpiData;
  };
  analytics: {
    sessions: KpiData;
    totalUsers: KpiData;
  };
}

export default function DashboardPage() {
  const { status } = useSession();
  
  // Unser custom Hook holt die Daten, den Lade- und Fehlerstatus
  const { data, isLoading, error } = useApiData<DashboardData>('/api/data');

  // Warteraum, bis die Authentifizierung abgeschlossen ist
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <p className="text-lg">Lade Sitzung...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <Header />

      <main className="mt-6">
        {/* Fehler-Zustand: Zeigt eine klare Fehlermeldung an */}
        {error && (
          <div className="p-6 text-center bg-red-50 border border-red-200 rounded-lg">
            <h2 className="text-xl font-bold text-red-700">Fehler beim Laden der Dashboard-Daten</h2>
            <p className="mt-2 text-red-600">{error}</p>
          </div>
        )}

        {/* Daten-Anzeige: Das Gitter mit den KPI-Karten */}
        {!error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard 
              title="Klicks" 
              isLoading={isLoading}
              value={data?.searchConsole.clicks.value}
              change={data?.searchConsole.clicks.change}
            />
            <KpiCard 
              title="Impressionen" 
              isLoading={isLoading}
              value={data?.searchConsole.impressions.value}
              change={data?.searchConsole.impressions.change}
            />
            <KpiCard 
              title="Sitzungen" 
              isLoading={isLoading}
              value={data?.analytics.sessions.value}
              change={data?.analytics.sessions.change}
            />
            <KpiCard 
              title="Nutzer" 
              isLoading={isLoading}
              value={data?.analytics.totalUsers.value}
              change={data?.analytics.totalUsers.change}
            />
          </div>
        )}
      </main>
    </div>
  );
}
