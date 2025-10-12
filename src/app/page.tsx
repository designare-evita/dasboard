// src/app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import useApiData from '@/hooks/use-api-data';
import KpiCard from '@/components/kpi-card';
import Link from 'next/link';

// --- Typen ---
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
  kpis?: Partial<KpiDashboard>; // API darf unvollständig sein
}
type ApiResponse = AdminResponse | CustomerResponse;

// --- Default-KPIs + Normalisierung ---
const DEFAULT_KPIS: KpiDashboard = {
  searchConsole: {
    clicks: { value: 0, change: 0 },
    impressions: { value: 0, change: 0 },
  },
  analytics: {
    sessions: { value: 0, change: 0 },
    totalUsers: { value: 0, change: 0 },
  },
};

// Mischt eingehende (teilweise/fehlende) KPIs sicher mit Defaults
function normalizeKpis(input?: Partial<KpiDashboard>): KpiDashboard {
  return {
    searchConsole: {
      clicks: {
        value: input?.searchConsole?.clicks?.value ?? DEFAULT_KPIS.searchConsole.clicks.value,
        change: input?.searchConsole?.clicks?.change ?? DEFAULT_KPIS.searchConsole.clicks.change,
      },
      impressions: {
        value:
          input?.searchConsole?.impressions?.value ??
          DEFAULT_KPIS.searchConsole.impressions.value,
        change:
          input?.searchConsole?.impressions?.change ??
          DEFAULT_KPIS.searchConsole.impressions.change,
      },
    },
    analytics: {
      sessions: {
        value: input?.analytics?.sessions?.value ?? DEFAULT_KPIS.analytics.sessions.value,
        change: input?.analytics?.sessions?.change ?? DEFAULT_KPIS.analytics.sessions.change,
      },
      totalUsers: {
        value:
          input?.analytics?.totalUsers?.value ?? DEFAULT_KPIS.analytics.totalUsers.value,
        change:
          input?.analytics?.totalUsers?.change ?? DEFAULT_KPIS.analytics.totalUsers.change,
      },
    },
  };
}

// --- Type Guards (akzeptieren null/undefined vom Hook) ---
function isAdmin(data: ApiResponse | null | undefined): data is AdminResponse {
  return !!data && 'role' in data && (data.role === 'SUPERADMIN' || data.role === 'ADMIN');
}
function isCustomer(data: ApiResponse | null | undefined): data is CustomerResponse {
  return !!data && 'role' in data && data.role === 'BENUTZER';
}

export default function DashboardPage() {
  const { status } = useSession();
  const { data, isLoading, error } = useApiData<ApiResponse>('/api/data');

  if (status === 'loading' || isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <p className="mt-2">Lade Dashboard...</p>
      </div>
    );
  }

  if (error) {
    const msg = typeof error === 'string' ? error : 'Unbekannter Fehler beim Laden.';
    return (
      <div className="p-8">
        <div className="p-6 text-center bg-red-100 rounded-lg text-red-700 border border-red-300">
          <h3 className="font-bold text-lg mb-2">Fehler beim Laden</h3>
          <p>{msg}</p>
        </div>
      </div>
    );
  }

  // --- Admin-/Superadmin-Ansicht ---
  if (isAdmin(data)) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <main className="mt-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">
              {data.role === 'SUPERADMIN' ? 'Alle Kundenprojekte' : 'Meine Kundenprojekte'}
            </h2>

            {data.projects.length === 0 ? (
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
                {data.projects.map((project: Project) => (
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

  // --- Kunden-Ansicht (immer mit sicheren Defaults) ---
  if (isCustomer(data)) {
    const k: KpiDashboard = normalizeKpis(data.kpis);

    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <main className="mt-6">
          <h2 className="text-2xl font-bold mb-6">Ihr Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard
              title="Klicks"
              isLoading={false}
              value={k.searchConsole.clicks.value}
              change={k.searchConsole.clicks.change}
            />
            <KpiCard
              title="Impressionen"
              isLoading={false}
              value={k.searchConsole.impressions.value}
              change={k.searchConsole.impressions.change}
            />
            <KpiCard
              title="Sitzungen"
              isLoading={false}
              value={k.analytics.sessions.value}
              change={k.analytics.sessions.change}
            />
            <KpiCard
              title="Nutzer"
              isLoading={false}
              value={k.analytics.totalUsers.value}
              change={k.analytics.totalUsers.change}
            />
          </div>

          {/* Hinweis, falls die gelieferten KPIs leer waren */}
          {data.kpis == null && (
            <p className="mt-6 text-sm text-gray-500">
              Hinweis: Es wurden noch keine KPI-Daten von der API geliefert. Es werden vorübergehend
              Platzhalter-Werte (0) angezeigt.
            </p>
          )}
        </main>
      </div>
    );
  }

  // --- Fallback ---
  return (
    <div className="p-8 text-center">
      <p>Keine Daten verfügbar.</p>
    </div>
  );
}
