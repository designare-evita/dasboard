// src/app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import useApiData from '@/hooks/use-api-data';
import KpiCard from '@/components/kpi-card';
import Link from 'next/link';
import { useState } from 'react';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import LandingpageApproval from '@/components/LandingpageApproval'; // NEUER IMPORT

// --- Typ-Definitionen ---

// Einzelner KPI-Wert mit prozentualer Veränderung
interface KpiDatum {
  value: number;
  change: number;
}

// Datenpunkt für die Charts (z.B. { date: '2023-10-14', value: 120 })
interface ChartPoint {
  date: string;
  value: number;
}

// Struktur aller KPI-Daten
interface KpiData {
  clicks: KpiDatum;
  impressions: KpiDatum;
  sessions: KpiDatum;
  totalUsers: KpiDatum;
}

// Struktur aller Chart-Daten
interface ChartData {
  clicks: ChartPoint[];
  impressions: ChartPoint[];
  sessions: ChartPoint[];
  totalUsers: ChartPoint[];
}

// Struktur eines Projekts für die Admin-Ansicht
interface Project {
  id: string;
  email: string;
  domain: string;
  gsc_site_url?: string;
  ga4_property_id?: string;
}

// Mögliche API-Antworten
interface AdminResponse {
  role: 'SUPERADMIN' | 'ADMIN';
  projects: Project[];
}
interface CustomerResponse {
  role: 'BENUTZER';
  kpis: Partial<KpiData>;
  charts: Partial<ChartData>;
}

// Gesamt-Typ für die API-Antwort
type ApiResponse = AdminResponse | CustomerResponse;

// Typ für den aktiven KPI-Tab im Chart
type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

// --- Hilfsfunktionen (Type Guards) ---

function isAdmin(data: ApiResponse | null | undefined): data is AdminResponse {
  return !!data && 'role' in data && (data.role === 'SUPERADMIN' || data.role === 'ADMIN');
}

function isCustomer(data: ApiResponse | null | undefined): data is CustomerResponse {
  return !!data && 'role' in data && data.role === 'BENUTZER';
}

// --- Standardwerte für KPIs, falls keine Daten vorhanden sind ---
const ZERO_KPI: KpiDatum = { value: 0, change: 0 };

function normalizeKpis(input?: Partial<KpiData>): KpiData {
  return {
    clicks: input?.clicks ?? ZERO_KPI,
    impressions: input?.impressions ?? ZERO_KPI,
    sessions: input?.sessions ?? ZERO_KPI,
    totalUsers: input?.totalUsers ?? ZERO_KPI,
  };
}

// --- Hauptkomponente: DashboardPage ---

export default function DashboardPage() {
  const { status } = useSession();
  const { data, isLoading, error } = useApiData<ApiResponse>('/api/data');
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  // Ladezustand
  if (status === 'loading' || isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        <p className="mt-2 text-gray-600">Dashboard wird geladen...</p>
      </div>
    );
  }

  // Fehlerzustand
  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg">
        <h3 className="font-bold">Fehler beim Laden der Dashboard-Daten</h3>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  // --- Ansicht für Admin / Superadmin ---
  if (isAdmin(data)) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <main className="mt-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">
              {data.role === 'SUPERADMIN' ? 'Alle Kundenprojekte' : 'Meine Kundenprojekte'}
            </h2>
            {data.projects.length === 0 ? (
              <p className="text-gray-500">Keine Projekte gefunden.</p>
            ) : (
              <div className="space-y-3">
                {data.projects.map((project) => (
                  <div key={project.id} className="p-4 border rounded-md hover:shadow-lg transition-shadow flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-lg text-gray-800">{project.domain}</p>
                      <p className="text-sm text-gray-500">{project.email}</p>
                    </div>
                    <div>
                      <Link href={`/projekt/${project.id}`} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">
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

  // --- Ansicht für Benutzer (Kunde) ---
  if (isCustomer(data)) {
    const kpis = normalizeKpis(data.kpis);
    const chartSeries: ChartPoint[] = (data.charts && data.charts[activeKpi]) ? data.charts[activeKpi]! : [];
    const showNoDataHint = !data.kpis || Object.keys(data.kpis).length === 0;

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
            <KpiCard title="Klicks" isLoading={isLoading} value={kpis.clicks.value} change={kpis.clicks.change} />
            <KpiCard title="Impressionen" isLoading={isLoading} value={kpis.impressions.value} change={kpis.impressions.change} />
            <KpiCard title="Sitzungen" isLoading={isLoading} value={kpis.sessions.value} change={kpis.sessions.change} />
            <KpiCard title="Nutzer" isLoading={isLoading} value={kpis.totalUsers.value} change={kpis.totalUsers.change} />
          </div>
          
          <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <div className="flex border-b border-gray-200">
              {(Object.keys(tabMeta) as ActiveKpi[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveKpi(key)}
                  className={`py-2 px-4 text-sm font-medium transition-colors ${
                    activeKpi === key
                      ? 'border-b-2 border-indigo-500 text-indigo-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
                  }`}
                >
                  {tabMeta[key].title}
                </button>
              ))}
            </div>
            <div className="mt-4 h-72">
              <KpiTrendChart data={chartSeries} color={tabMeta[activeKpi].color} />
            </div>
          </div>
          
          {/* HIER WIRD DIE NEUE KOMPONENTE EINGEFÜGT */}
          <LandingpageApproval />

          {showNoDataHint && (
            <p className="mt-6 text-sm text-center text-gray-500">
              Hinweis: Für dieses Projekt wurden noch keine KPI-Daten geliefert. Es werden vorübergehend Platzhalter-Werte angezeigt.
            </p>
          )}
        </main>
      </div>
    );
  }

  // --- Fallback, falls keine Daten oder Rolle passen ---
  return (
    <div className="p-8 text-center text-gray-600">
      <p>Keine Daten zur Anzeige verfügbar oder unbekannte Benutzerrolle.</p>
    </div>
  );
}
