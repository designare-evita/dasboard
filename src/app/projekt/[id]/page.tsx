// src/app/projekt/[id]/page.tsx
'use client';

import { useSession } from "next-auth/react";
import useApiData from "@/hooks/use-api-data";
import KpiCard from "@/components/kpi-card";
import Link from "next/link";
import { useParams } from 'next/navigation'; // Hook, um die ID aus der URL zu lesen

// Typ-Definitionen (identisch zur Hauptseite)
interface KpiValue { value: number; change: number; }
interface CustomerDashboard {
  searchConsole: { clicks: KpiValue; impressions: KpiValue; };
  analytics: { sessions: KpiValue; totalUsers: KpiValue; };
}

export default function ProjektDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams(); // Holt sich die Parameter aus der URL
  const projectId = params.id; // Extrahiert die ID des Projekts

  // Ruft eine neue, spezifische API-Route für dieses eine Projekt auf
  const { data, isLoading, error } = useApiData<CustomerDashboard>(`/api/projects/${projectId}`);

  if (status === 'loading' || isLoading) {
    return <div className="p-8 text-center">Lade Projektdaten...</div>;
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <main className="mt-6">
        <div className="mb-6">
            <Link href="/" className="text-blue-600 hover:underline">
                &larr; Zurück zur Projektübersicht
            </Link>
        </div>

        {error && (
          <div className="p-6 text-center bg-red-100 rounded-lg text-red-700">
            <p className="font-bold">Fehler beim Laden der Projektdaten</p>
            <p>{error}</p>
          </div>
        )}

        {data && !error && (
          <>
            <h2 className="text-3xl font-bold mb-6">Projekt-Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KpiCard 
                title="Klicks" 
                isLoading={isLoading}
                value={data.searchConsole.clicks.value}
                change={data.searchConsole.clicks.change}
              />
              <KpiCard 
                title="Impressionen" 
                isLoading={isLoading}
                value={data.searchConsole.impressions.value}
                change={data.searchConsole.impressions.change}
              />
              <KpiCard 
                title="Sitzungen" 
                isLoading={isLoading}
                value={data.analytics.sessions.value}
                change={data.analytics.sessions.change}
              />
              <KpiCard 
                title="Nutzer" 
                isLoading={isLoading}
                value={data.analytics.totalUsers.value}
                change={data.analytics.totalUsers.change}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
