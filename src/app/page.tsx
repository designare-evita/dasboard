// src/app/page.tsx
'use client';

import { useSession } from "next-auth/react";
import useApiData from "@/hooks/use-api-data";
import KpiCard from "@/components/kpi-card";
import Link from "next/link";

// ==== Typ-Definitionen ====
interface KpiValue {
  value: number;
  change: number;
}

interface KpiDashboard {
  searchConsole: {
    clicks: KpiValue;
    impressions: KpiValue;
  };
  analytics: {
    sessions: KpiValue;
    totalUsers: KpiValue;
  };
}

interface Project {
  id: string;
  email: string;
  domain: string;
  gsc_site_url?: string;
  ga4_property_id?: string;
}

interface AdminResponse {
  role: 'SUPERADMIN' | 'ADMIN';
  projects: Project[];
}

interface CustomerResponse {
  role: 'BENUTZER';
  kpis?: KpiDashboard; // kann fehlen → defensiv behandeln
}

type ApiResponse = AdminResponse | CustomerResponse;

// ==== Helper ====
const EMPTY_KPIS: KpiDashboard = {
  searchConsole: {
    clicks: { value: 0, change: 0 },
    impressions: { value: 0, change: 0 },
  },
  analytics: {
    sessions: { value: 0, change: 0 },
    totalUsers: { value: 0, change: 0 },
  },
};

function isAdminLike(d: ApiResponse | undefined | null): d is AdminResponse {
  return !!d && (d as any).role && ((d as any).role === 'SUPERADMIN' || (d as any).role === 'ADMIN');
}

function isCustomerLike(d: ApiResponse | undefined | null): d is CustomerResponse {
  return !!d && (d as any).role === 'BENUTZER';
}

// ==== Component ====
export default function DashboardPage() {
  const { status } = useSession();
  const { data, isLoading, error } = useApiData<ApiResponse>('/api/data');

  // Loading
  if (status === 'loading' || isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <p className="mt-2">Lade Dashboard...</p>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="p-8">
        <div className="p-6 text-center bg-red-100 rounded-lg text-red-700 border border-red-300">
          <h3 className="font-bold text-lg mb-2">Fehler beim Laden</h3>
          <p>{String(error)}</p>
        </div>
      </div>
    );
  }

  // ==== Admin / Superadmin: Projektliste ====
  if (isAdminLike(data)) {
    const adminData = data;

    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <main className="mt-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">
              {adminData.role === 'SUPERADMIN' ? 'Alle Kundenprojekte' : 'Meine Kundenprojekte'}
            </h2>

            {adminData.projects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-lg">Es wurden noch keine Kundenprojekte angelegt.</p>
                <Link
                  href="/admin"
                  className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  Neues Projekt erstellen
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {adminData.projects.map((project) => (
                  <div
                    key={project.id}
                    className="p-4 border rounded-md hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-semibold text-lg text-gray-900">{project.domain}</p>
                        <p className="text-sm text-gray-500">{project.email}</p>
                        {project.gsc_site_url && (
                          <p className="text-xs text-gray-400 mt-1">GSC: {project.gsc_site_url}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={`/projekt/${project.id}`}
                          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                          Dashboard ansehen
                        </Link>
                        <Link
                          href={`/admin/edit/${project.id}`}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                        >
                          Bearbeiten
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ==== Kunde (BENUTZER): KPI-Dashboard ====
  if (isCustomerLike(data)) {
    // KPIs können fehlen → Fallback nutzen
    const kpis: KpiDashboard = data.kpis ?? EMPTY_KPIS;
    const showMissingNotice = !data.kpis;

    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <main className="mt-6">
          <h2 className="text-2xl font-bold mb-6">Ihr Dashboard</h2>

          {showMissingNotice && (
            <div className="mb-6 p-4 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800">
              <p className="font-medium">Hinweis</p>
              <p className="text-sm">
                Für dieses Konto liegen derzeit keine KPI-Daten vor. Es werden vorübergehend
                Platzhalter angezeigt.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard
              title="Klicks"
              isLoading={isLoading}
              value={kpis.searchConsole.clicks.value}
              change={kpis.searchConsole.clicks.change}
            />
            <KpiCard
              title="Impressionen"
              isLoading={isLoading}
              value={kpis.searchConsole.impressions.value}
              change={kpis.searchConsole.impressions.change}
            />
            <KpiCard
              title="Sitzungen"
              isLoading={isLoading}
              value={kpis.analytics.sessions.value}
              change={kpis.analytics.sessions.change}
            />
            <KpiCard
              title="Nutzer"
              isLoading={isLoading}
              value={kpis.analytics.totalUsers.value}
              change={kpis.analytics.totalUsers.change}
            />
          </div>
        </main>
      </div>
    );
  }

  // ==== Fallback ====
  return (
    <div className="p-8 text-center">
      <p>Keine Daten verfügbar.</p>
    </div>
  );
}
