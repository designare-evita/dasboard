// src/app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import useApiData from '@/hooks/use-api-data';
import KpiCard from '@/components/kpi-card';
import Link from 'next/link';
import { useState } from 'react';
import KpiTrendChart from '@/components/charts/KpiTrendChart'; // Chart-Komponente importieren

// --- Typen ---
interface KpiDatum { value: number; change: number; }
interface ChartPoint { date: string; value: number; }

interface KpiData {
  clicks: KpiDatum;
  impressions: KpiDatum;
  sessions: KpiDatum;
  totalUsers: KpiDatum;
}
interface ChartData {
  clicks: ChartPoint[];
  impressions: ChartPoint[];
  sessions: ChartPoint[];
  totalUsers: ChartPoint[];
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
  kpis: Partial<KpiData>;
  charts: Partial<ChartData>; // NEU: Charts hinzugefügt
}
type ApiResponse = AdminResponse | CustomerResponse;
type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

// --- Guards (unverändert) ---
function isAdmin(data: ApiResponse | null | undefined): data is AdminResponse {
  return !!data && 'role' in data && (data.role === 'SUPERADMIN' || data.role === 'ADMIN');
}
function isCustomer(data: ApiResponse | null | undefined): data is CustomerResponse {
  return !!data && 'role' in data && data.role === 'BENUTZER';
}

// --- Hilfsfunktionen für Defaults ---
const ZERO_KPI: KpiDatum = { value: 0, change: 0 };
function normalizeKpis(input?: Partial<KpiData>): KpiData {
  return {
    clicks: input?.clicks ?? ZERO_KPI,
    impressions: input?.impressions ?? ZERO_KPI,
    sessions: input?.sessions ?? ZERO_KPI,
    totalUsers: input?.totalUsers ?? ZERO_KPI,
  };
}


export default function DashboardPage() {
  const { status } = useSession();
  const { data, isLoading, error } = useApiData<ApiResponse>('/api/data');
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  // Lade- & Fehlerzustände (unverändert)
  if (status === 'loading' || isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <p className="mt-2">Lade Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        Fehler beim Laden der Dashboard-Daten: {error}
      </div>
    );
  }

  // --- Admin-/Superadmin (unverändert) ---
  if (isAdmin(data)) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <main className="mt-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">
              {data.role === 'SUPERADMIN' ? 'Alle Kundenprojekte' : 'Meine Kundenprojekte'}
            </h2>
            {data.projects.length === 0 ? (
              <p>Keine Projekte gefunden.</p>
            ) : (
              <div className="space-y-3">
                {data.projects.map((project) => (
                  <div key={project.id} className="p-4 border rounded-md hover:shadow-md transition-shadow flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-lg">{project.domain}</p>
                      <p className="text-sm text-gray-500">{project.email}</p>
                    </div>
                    <div>
                      <Link href={`/projekt/${project.id}`} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Dashboard ansehen
                      </Link>
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

  // --- Benutzer (BENUTZER) - JETZT MIT CHARTS ---
  if (isCustomer(data)) {
    const k = normalizeKpis(data.kpis);
    const chartSeries: ChartPoint[] = (data.charts && data.charts[activeKpi]) ? data.charts[activeKpi]! : [];
    
    const showNoDataHint = !data.kpis && !data.charts;

    const tabMeta: Record<ActiveKpi, { title: string; color: string }> = {
      clicks: { title: 'Klicks', color: '#3b82f6' },
      impressions: { title: 'Impressionen', color: '#8b5cf6' },
      sessions: { title: 'Sitzungen', color: '#10b981' },
      totalUsers: { title: 'Nutzer', color: '#f59e0b' },
    };

    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <main className="mt-6">
          <h2 className="text-2xl font-bold mb-6">Ihr Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard title="Klicks" isLoading={false} value={k.clicks.value} change={k.clicks.change} />
            <KpiCard title="Impressionen" isLoading={false} value={k.impressions.value} change={k.impressions.change} />
            <KpiCard title="Sitzungen" isLoading={false} value={k.sessions.value} change={k.sessions.change} />
            <KpiCard title="Nutzer" isLoading={false} value={k.totalUsers.value} change={k.totalUsers.change} />
          </div>
          
          {/* Charts mit Tabs */}
          <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <div className="flex border-b border-gray-200">
              {(Object.keys(tabMeta) as ActiveKpi[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveKpi(key)}
                  className={`py-2 px-4 text-sm font-medium ${
                    activeKpi === key
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tabMeta[key].title}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <KpiTrendChart data={chartSeries} color={tabMeta[activeKpi].color} />
            </div>
          </div>
          
          {showNoDataHint && (
            <p className="mt-6 text-sm text-gray-500">
              Hinweis: Es wurden noch keine KPI-Daten geliefert. Es werden Platzhalter-Werte angezeigt.
            </p>
          )}
        </main>
      </div>
    );
  }

  // --- Fallback (unverändert) ---
  return (
    <div className="p-8 text-center">
      <p>Keine Daten verfügbar oder unbekannte Benutzerrolle.</p>
    </div>
  );
}
