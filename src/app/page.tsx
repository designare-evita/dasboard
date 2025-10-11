// src/app/page.tsx
'use client';

import { useSession } from "next-auth/react";
import useApiData from "@/hooks/use-api-data";
import Header from "@/components/layout/Header";
import KpiCard from "@/components/kpi-card";
import Link from "next/link";

// Typdefinition für ein Projekt in der Übersicht
interface Project {
  id: string;
  email: string;
  domain: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { data, isLoading, error } = useApiData<any>('/api/data'); // 'any' da die Antwort variieren kann

  if (status === 'loading' || isLoading) {
    return <div className="p-8 text-center">Lade...</div>;
  }

  const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
  const isProjectList = Array.isArray(data);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <Header />

      <main className="mt-6">
        {error && <div className="p-6 text-center bg-red-100 rounded-lg">{error}</div>}

        {/* Ansicht für Super Admin: Projektliste */}
        {isSuperAdmin && isProjectList && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">Alle Kundenprojekte</h2>
            <ul className="space-y-3">
              {data.map((project: Project) => (
                <li key={project.id} className="p-4 border rounded-md flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{project.domain}</p>
                    <p className="text-sm text-gray-500">{project.email}</p>
                  </div>
                  {/* Später kann dieser Link zur Detailansicht des Projekts führen */}
                  <Link href={`/projekt/${project.id}`} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                    Details ansehen
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ansicht für Kunden: KPI-Karten */}
        {!isProjectList && data && (
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
