// src/app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User } from '@/types';
import { 
  ArrowRepeat, 
  ExclamationTriangleFill, 
  GraphUp, 
  ArrowRightSquare 
} from 'react-bootstrap-icons';
import KpiCard from '@/components/kpi-card';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import LandingpageApproval from '@/components/LandingpageApproval';
import AiTrafficCard from '@/components/AiTrafficCard'; // ✅ Neue Komponente

// --- Typen für Dashboard-Daten ---
type KPI = {
  value: number;
  change: number;
  aiTraffic?: { // ✅ Optional für Sessions
    value: number;
    percentage: number;
  };
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

type AiTrafficData = { // ✅ Neuer Typ
  totalSessions: number;
  totalUsers: number;
  sessionsBySource: {
    [source: string]: number;
  };
  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  trend: Array<{
    date: string;
    sessions: number;
  }>;
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
  aiTraffic?: AiTrafficData; // ✅ Neue Property
};

type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

// --- Hauptkomponente ---
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [projects, setProjects] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch('/api/data');
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || 'Daten konnten nicht geladen werden');
          }
          
          const data = await response.json();
          
          if (data.role === 'ADMIN' || data.role === 'SUPERADMIN') {
            setProjects(data.projects || []);
          } else if (data.role === 'BENUTZER') {
            setDashboardData(data);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchData();
    }
  }, [status, session]);

  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <div className="p-8 text-center flex items-center justify-center min-h-[50vh]">
        <ArrowRepeat className="animate-spin text-indigo-600 mr-2" size={24} />
        <p className="text-gray-600">Dashboard wird geladen...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-800 bg-red-50 rounded-lg border border-red-200 max-w-2xl mx-auto mt-10">
        <h3 className="font-bold flex items-center justify-center gap-2">
          <ExclamationTriangleFill size={18} />
          Fehler beim Laden der Daten
        </h3>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  // Admin- & Superadmin-Ansicht
  if (session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN') {
    return <AdminDashboard projects={projects} />;
  }

  // Kunden-Ansicht
  if (session?.user?.role === 'BENUTZER' && dashboardData) {
    return <CustomerDashboard data={dashboardData} isLoading={isLoading} />;
  }

  return (
    <div className="p-8 text-center text-gray-500">
      Keine Daten zur Anzeige verfügbar.
    </div>
  );
}

// --- Admin Dashboard Komponente ---
function AdminDashboard({ projects }: { projects: User[] }) {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">
        Kundenübersicht
      </h2>
      <div className="max-w-7xl mx-auto">
        {projects.length === 0 ? (
          <p className="text-gray-500">Keine Projekte gefunden.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projekt/${project.id}`}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200 hover:bg-gray-50 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 truncate">
                    {project.domain || project.email}
                  </h3>
                  <GraphUp size={24} className="text-indigo-600 flex-shrink-0" />
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="truncate">
                    <span className="font-medium text-gray-800">E-Mail:</span> {project.email}
                  </p>
                  {project.gsc_site_url && (
                    <p className="truncate">
                      <span className="font-medium text-gray-800">Website:</span> {project.gsc_site_url}
                    </p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-indigo-600 group-hover:text-indigo-800 text-sm font-medium flex items-center gap-1.5 transition-colors">
                    Dashboard anzeigen <ArrowRightSquare size={14} />
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

// --- Kunden Dashboard Komponente ---
function CustomerDashboard({ data, isLoading }: { data: DashboardData; isLoading: boolean }) {
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  const kpis = data.kpis || { 
    clicks: { value: 0, change: 0 }, 
    impressions: { value: 0, change: 0 }, 
    sessions: { value: 0, change: 0 }, 
    totalUsers: { value: 0, change: 0 } 
  };
  
  const chartSeries: ChartData = (data.charts && data.charts[activeKpi]) ? data.charts[activeKpi]! : [];
  const showNoDataHint = !data.kpis;

  const tabMeta: Record<ActiveKpi, { title: string; color: string }> = {
    clicks: { title: 'Klicks', color: '#3b82f6' },
    impressions: { title: 'Impressionen', color: '#8b5cf6' },
    sessions: { title: 'Sitzungen', color: '#10b981' },
    totalUsers: { title: 'Nutzer', color: '#f59e0b' },
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <main>
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Ihr Dashboard</h2>
        
        {/* KPI-Karten Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard title="Klicks" isLoading={isLoading} value={kpis.clicks.value} change={kpis.clicks.change} />
          <KpiCard title="Impressionen" isLoading={isLoading} value={kpis.impressions.value} change={kpis.impressions.change} />
          <KpiCard title="Sitzungen" isLoading={isLoading} value={kpis.sessions.value} change={kpis.sessions.change} />
          <KpiCard title="Nutzer" isLoading={isLoading} value={kpis.totalUsers.value} change={kpis.totalUsers.change} />
        </div>
        
        {/* Charts - volle Breite */}
        <div className="mt-8">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
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
        </div>
        
        {/* ✅ KI-Traffic + Top Queries nebeneinander */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ✅ KI-Traffic Card ZUERST (1 Spalte) */}
          {data.aiTraffic && (
            <div className="lg:col-span-1">
              <AiTrafficCard
                totalSessions={data.aiTraffic.totalSessions}
                totalUsers={data.aiTraffic.totalUsers}
                percentage={kpis.sessions.aiTraffic?.percentage || 0}
                topSources={data.aiTraffic.topAiSources}
                isLoading={isLoading}
              />
            </div>
          )}
          
          {/* Top Queries Tabelle DANACH (2 Spalten) */}
          {data.topQueries && data.topQueries.length > 0 && (
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h3 className="text-xl font-semibold mb-4">Top 5 Suchanfragen</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-600 border-b border-gray-200">
                        <th className="pb-3 pr-4 font-medium">Suchanfrage</th>
                        <th className="pb-3 pr-4 font-medium text-right">Klicks</th>
                        <th className="pb-3 pr-4 font-medium text-right">Impressionen</th>
                        <th className="pb-3 pr-4 font-medium text-right">CTR</th>
                        <th className="pb-3 font-medium text-right">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topQueries.map((query, index) => (
                        <tr key={`${query.query}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
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
            </div>
          )}
        </div>
        
        {/* Landingpage Approval */}
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
