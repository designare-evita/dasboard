// src/app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User } from '@/types';
import { ArrowRepeat } from 'react-bootstrap-icons';
import KpiCard from '@/components/kpi-card';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import LandingpageApproval from '@/components/LandingpageApproval';

// Typen für Dashboard-Daten
type KPI = {
  value: number;
  change: number;
};

type ChartData = {
  date: string;
  value: number;
}[];

type TopQueryData = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type DashboardData = {
  kpis: {
    clicks: KPI;
    impressions: KPI;
    sessions: KPI;
    totalUsers: KPI;
  };
  charts: {
    clicks: ChartData;
    impressions: ChartData;
    sessions: ChartData;
    totalUsers: ChartData;
  };
  topQueries?: TopQueryData[];
};

type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // State für Benutzer (Kunden-Dashboard)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  
  // State für Admins (Projekt-Übersicht)
  const [projects, setProjects] = useState<User[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  }, [status]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('Fehler beim Laden der Daten');
      const data = await response.json();
      
      // Benutzer (Kunde) - Dashboard-Daten
      if (data.role === 'BENUTZER') {
        setDashboardData(data);
      }
      
      // Admin/Superadmin - Projekt-Liste
      if (data.projects) {
        setProjects(data.projects);
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setIsLoading(false);
    }
  };

  // Auth-Check
  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ArrowRepeat className="animate-spin text-indigo-600 mr-2" size={24} />
        Lade...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  const tabMeta: Record<ActiveKpi, { title: string; color: string }> = {
    clicks: { title: 'Klicks', color: '#3b82f6' },
    impressions: { title: 'Impressionen', color: '#8b5cf6' },
    sessions: { title: 'Sitzungen', color: '#10b981' },
    totalUsers: { title: 'Nutzer', color: '#f59e0b' },
  };

  // === BENUTZER (KUNDE) ANSICHT - PROFESSIONELLES DASHBOARD ===
  if (session?.user?.role === 'BENUTZER') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
          <h2 className="text-3xl font-bold mb-6">Projekt-Dashboard</h2>

          {/* Fehler-Anzeige */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">❌ {error}</p>
            </div>
          )}

          {dashboardData && (
            <>
              {/* KPI-Karten */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard 
                  title="Klicks" 
                  isLoading={false} 
                  value={dashboardData.kpis.clicks.value} 
                  change={dashboardData.kpis.clicks.change} 
                />
                <KpiCard 
                  title="Impressionen" 
                  isLoading={false} 
                  value={dashboardData.kpis.impressions.value} 
                  change={dashboardData.kpis.impressions.change} 
                />
                <KpiCard 
                  title="Sitzungen" 
                  isLoading={false} 
                  value={dashboardData.kpis.sessions.value} 
                  change={dashboardData.kpis.sessions.change} 
                />
                <KpiCard 
                  title="Nutzer" 
                  isLoading={false} 
                  value={dashboardData.kpis.totalUsers.value} 
                  change={dashboardData.kpis.totalUsers.change} 
                />
              </div>

              {/* Charts mit Tabs */}
              <div className="bg-white p-6 rounded-lg shadow-md mb-8">
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
                  <KpiTrendChart 
                    data={dashboardData.charts[activeKpi] || []} 
                    color={tabMeta[activeKpi].color} 
                  />
                </div>
              </div>

              {/* Top 5 Suchanfragen */}
              {dashboardData.topQueries && dashboardData.topQueries.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                  <h3 className="text-xl font-semibold mb-4">Top 5 Suchanfragen</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-gray-600 border-b">
                          <th className="pb-3 pr-4 font-medium">Suchanfrage</th>
                          <th className="pb-3 pr-4 font-medium text-right">Klicks</th>
                          <th className="pb-3 pr-4 font-medium text-right">Impressionen</th>
                          <th className="pb-3 pr-4 font-medium text-right">CTR</th>
                          <th className="pb-3 font-medium text-right">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.topQueries.map((query, index) => (
                          <tr key={`${query.query}-${index}`} className="border-b hover:bg-gray-50">
                            <td className="py-3 pr-4 text-gray-900">{query.query}</td>
                            <td className="py-3 pr-4 text-right text-gray-700">
                              {query.clicks.toLocaleString('de-DE')}
                            </td>
                            <td className="py-3 pr-4 text-right text-gray-700">
                              {query.impressions.toLocaleString('de-DE')}
                            </td>
                            <td className="py-3 pr-4 text-right text-gray-700">
                              {(query.ctr * 100).toFixed(2)}%
                            </td>
                            <td className="py-3 text-right text-gray-700">
                              {query.position.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Landingpage Approval Widget */}
              <LandingpageApproval />
            </>
          )}
        </div>
      </div>
    );
  }

  // === ADMIN/SUPERADMIN ANSICHT - PROJEKT-ÜBERSICHT ===
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Projekt-Übersicht</h1>
          <p className="text-gray-600 mt-2">
            {session?.user?.role === 'SUPERADMIN' 
              ? 'Alle Kundenprojekte im Überblick'
              : 'Ihre zugewiesenen Kundenprojekte'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">
              {session?.user?.role === 'SUPERADMIN'
                ? 'Noch keine Kundenprojekte vorhanden.'
                : 'Ihnen wurden noch keine Projekte zugewiesen.'}
            </p>
            {session?.user?.role === 'SUPERADMIN' && (
              <Link
                href="/admin"
                className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 font-medium"
              >
                Zum Admin-Bereich
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projekt/${project.id}`}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow border border-gray-200 hover:border-indigo-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 truncate">
                    {project.domain || project.email}
                  </h3>
                  <span className="text-2xl">📊</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="truncate">
                    <span className="font-medium">E-Mail:</span> {project.email}
                  </p>
                  {project.gsc_site_url && (
                    <p className="truncate">
                      <span className="font-medium">Website:</span> {project.gsc_site_url}
                    </p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <span className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                    Dashboard anzeigen →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
