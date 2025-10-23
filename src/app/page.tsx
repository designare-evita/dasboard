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
import AiTrafficCard from '@/components/AiTrafficCard';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

// ... Typen für Dashboard-Daten ...
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
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  const fetchData = async (range: DateRangeOption = dateRange) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/data?dateRange=${range}`);
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

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData(dateRange);
    }
  }, [status, dateRange]);

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
    return (
      <CustomerDashboard 
        data={dashboardData} 
        isLoading={isLoading} 
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
    );
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
function CustomerDashboard({ 
  data, 
  isLoading, 
  dateRange, 
  onDateRangeChange 
}: { 
  data: DashboardData; 
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}) {
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
        {/* Header mit DateRangeSelector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Ihr Dashboard</h2>
          <DateRangeSelector 
            value={dateRange} 
            onChange={onDateRangeChange}
          />
        </div>
        
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
                dateRange={dateRange}
              />
            </div>
          )}
          
        {/* Top 100 Suchanfragen Liste (Logbuch-Stil) */}
          {data.topQueries && data.topQueries.length > 0 && (
            <div className={`${data.aiTraffic ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800">
                  <ClockHistory size={20} />
                  Top 100 Suchanfragen
                </h3>
                {/* Container mit Scrollbar */}
                <div className="border rounded-lg max-h-96 overflow-y-auto">
                  <ul className="divide-y divide-gray-100">
                    {data.topQueries.map((query, index) => (
                      <li key={`${query.query}-${index}`} className="p-4 space-y-2 hover:bg-gray-50">
                        {/* Suchanfrage */}
                        <p className="text-sm font-medium text-gray-900">{query.query}</p>
                        {/* Metadaten */}
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span title="Klicks">
                            Klicks: <span className="font-semibold text-gray-700">{query.clicks.toLocaleString('de-DE')}</span>
                          </span>
                          <span title="Impressionen">
                            Impr.: <span className="font-semibold text-gray-700">{query.impressions.toLocaleString('de-DE')}</span>
                          </span>
                          <span title="Click-Through-Rate">
                            CTR: <span className="font-semibold text-gray-700">{(query.ctr * 100).toFixed(1)}%</span>
                          </span>
                          <span title="Position">
                            Pos.: <span className="font-semibold text-gray-700">{query.position.toFixed(1)}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
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
