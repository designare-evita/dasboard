// src/app/page.tsx
'use client';

import { useSession } from "next-auth/react";
import useApiData from "@/hooks/use-api-data";
import Header from "@/components/layout/Header";
import KpiCard from "@/components/kpi-card";
import Link from "next/link";

// --- TYP-DEFINITIONEN ---
// Definiert die Struktur für eine einzelne KPI-Karte
interface KpiValue {
  value: number;
  change: number;
}

// Definiert die Struktur für das Dashboard eines einzelnen Kunden
interface CustomerDashboard {
  searchConsole: {
    clicks: KpiValue;
    impressions: KpiValue;
  };
  analytics: {
    sessions: KpiValue;
    totalUsers: KpiValue;
  };
}

// Definiert die Struktur für ein Projekt in der Super-Admin-Übersicht
interface Project {
  id: string;
  email: string;
  domain: string;
}

// Union-Typ: Die API kann entweder ein Kunden-Dashboard ODER eine Liste von Projekten zurückgeben
type ApiDataType = CustomerDashboard | Project[];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  // HIER IST DIE KORREKTUR: 'any' wurde durch den spezifischen Typ 'ApiDataType' ersetzt
  const { data, isLoading, error } = useApiData<ApiDataType>('/api/data');

  if (status === 'loading' || isLoading) {
    return <div className="p-8 text-center">Lade...</div>;
  }

  // Hilfsvariablen zur Bestimmung der Ansicht
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
  const isProjectList = Array.isArray(data);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <Header />

      <main className="mt-6">
        {error && (
          <div className="p-6 text-center bg-red-100 rounded-lg text-red-700">
            <p className="font-bold">Fehler beim Laden der Dashboard-Daten</p>
            <p>{error}</p>
          </div>
        )}

        {/* Ansicht für Super Admin: Zeigt eine Liste aller Projekte */}
        {isSuperAdmin && isProjectList && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">Alle Kundenprojekte</h2>
            {data.length === 0 ? (
              <p>Es wurden noch keine Kundenprojekte angelegt.</p>
            ) : (
              <ul className="space-y-3">
                {(data as Project[]).map((project) => (
                  <li key={project.id} className="p-4 border rounded-md flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{project.domain}</p>
                      <p className="text-sm text-gray-500">{project.email}</p>
                    </div>
                    <Link href={`/projekt/${project.id}`} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                      Details ansehen
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Ansicht für Kunden: Zeigt die KPI-Karten */}
        {data && !isProjectList && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard 
              title="Klicks" 
              isLoading={isLoading}
              value={(data as CustomerDashboard).searchConsole.clicks.value}
              change={(data as CustomerDashboard).searchConsole.clicks.change}
            />
            <KpiCard 
              title="Impressionen" 
              isLoading={isLoading}
              value={(data as CustomerDashboard).searchConsole.impressions.value}
              change={(data as CustomerDashboard).searchConsole.impressions.change}
            />
            <KpiCard 
              title="Sitzungen" 
              isLoading={isLoading}
              value={(data as CustomerDashboard).analytics.sessions.value}
              change={(data as CustomerDashboard).analytics.sessions.change}
            />
            <KpiCard 
              title="Nutzer" 
              isLoading={isLoading}
              value={(data as CustomerDashboard).analytics.totalUsers.value}
              change={(data as CustomerDashboard).analytics.totalUsers.change}
            />
          </div>
        )}
      </main>
    </div>
  );
}
