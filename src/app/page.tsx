// src/app/page.tsx (KOMPLETT NEU UND KORRIGIERT)
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { User, Project } from '@/types'; // Annahme: Project-Typ existiert in @/types
import { 
  ArrowRepeat, 
  ExclamationTriangleFill, 
  GraphUp, 
  ArrowRightSquare,
  BriefcaseFill // Icon für Projekte
} from 'react-bootstrap-icons';
import KpiCard from '@/components/kpi-card';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import LandingpageApproval from '@/components/LandingpageApproval';
import AiTrafficCard from '@/components/AiTrafficCard';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';

// --- Typen für Dashboard-Daten ---
// (Diese Typen könntest du auch in @/types/index.ts auslagern)
type KPI = {
  value: number;
  change: number;
  aiTraffic?: {
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

type AiTrafficData = {
  totalSessions: number;
  totalUsers: number;
  sessionsBySource: { [key: string]: number; };
  topAiSources: Array<{ source: string; sessions: number; users: number; percentage: number; }>;
  trend: Array<{ date: string; sessions: number; }>;
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
  aiTraffic?: AiTrafficData;
};

type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

// --- Leere/Standard-Daten (für Kunde) ---
const emptyCustomerData: DashboardData = {
  kpis: {
    clicks: { value: 0, change: 0 },
    impressions: { value: 0, change: 0 },
    sessions: { value: 0, change: 0, aiTraffic: { value: 0, percentage: 0 } },
    totalUsers: { value: 0, change: 0 },
  },
  charts: {
    clicks: [],
    impressions: [],
    sessions: [],
    totalUsers: [],
  },
  topQueries: [],
  aiTraffic: {
    totalSessions: 0,
    totalUsers: 0,
    sessionsBySource: {},
    topAiSources: [],
    trend: []
  }
};


// --- Hauptkomponente (Page) ---
export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // States für Kundendaten
  const [customerData, setCustomerData] = useState<DashboardData>(emptyCustomerData);
  const [isCustomerLoading, setIsCustomerLoading] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  
  // States für Admin-Projektdaten
  const [projects, setProjects] = useState<Project[]>([]); // Annahme: Typ Project aus @/types
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);

  const userRole = session?.user?.role;

  // Datenabruf für Kunden (BENUTZER)
  const fetchCustomerData = useCallback(async (range: DateRangeOption) => {
    setIsCustomerLoading(true);
    setCustomerError(null);
    try {
      const response = await fetch(`/api/data?dateRange=${range}`);
      if (!response.ok) throw new Error('Netzwerkantwort war nicht erfolgreich');
      const result = await response.json();
      setCustomerData(result || emptyCustomerData);
    } catch (error) {
      console.error('Fehler beim Abrufen der Kundendaten:', error);
      setCustomerError(error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten');
      setCustomerData(emptyCustomerData);
    } finally {
      setIsCustomerLoading(false);
    }
  }, []);

  // Datenabruf für Admins (Projekte)
  const fetchAdminProjects = useCallback(async () => {
    setIsAdminLoading(true);
    setAdminError(null);
    try {
      // Diese API-Route (/api/projects) gibt alle Projekte zurück (muss ggf. erstellt werden)
      const response = await fetch('/api/projects'); 
      if (!response.ok) throw new Error('Netzwerkantwort war nicht erfolgreich');
      const result = await response.json();
      setProjects(result || []);
    } catch (error) {
      console.error('Fehler beim Abrufen der Projekte:', error);
      setAdminError(error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten');
      setProjects([]);
    } finally {
      setIsAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
        fetchAdminProjects();
      } else if (userRole === 'BENUTZER') {
        fetchCustomerData(dateRange);
      }
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, userRole, dateRange, router, fetchCustomerData, fetchAdminProjects]);

  const handleDateRangeChange = (range: DateRangeOption) => {
    setDateRange(range);
  };

  // Ladezustand, während die Session geprüft wird
  if (status === 'loading' || !session) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <ArrowRepeat className="animate-spin text-4xl text-indigo-600" />
      </div>
    );
  }

  // Rollenbasierte Dashboards
  const { user } = session;

  if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
    // ✅ KORRIGIERT: Admins sehen die Projektübersicht
    return (
      <AdminProjectOverview
        user={user}
        projects={projects}
        isLoading={isAdminLoading}
        error={adminError}
        onRefresh={fetchAdminProjects} // Funktion zum Neuladen übergeben
      />
    );
  } else {
    // Kunden-Dashboard (BENUTZER)
    // Fehleranzeige für Kunden
    if (customerError) {
      return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-red-50 p-8">
          <ExclamationTriangleFill className="text-5xl text-red-500 mb-4" />
          <h2 className="text-2xl font-semibold text-red-800 mb-2">Daten konnten nicht geladen werden</h2>
          <p className="text-red-700 mb-6 text-center">{customerError}</p>
          <button
            onClick={() => fetchCustomerData(dateRange)}
            disabled={isCustomerLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center gap-2"
          >
            <ArrowRepeat className={isCustomerLoading ? 'animate-spin' : ''} />
            Erneut versuchen
          </button>
        </div>
      );
    }
    
    return (
      <CustomerDashboard
        data={customerData}
        isLoading={isCustomerLoading}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
      />
    );
  }
}

// ==========================================================
// ✅ NEUE KOMPONENTE: Admin Projektübersicht
// ==========================================================
function AdminProjectOverview({ 
  user, 
  projects, 
  isLoading, 
  error,
  onRefresh
} : { 
  user: User, 
  projects: Project[], // Annahme: Typ Project[]
  isLoading: boolean, 
  error: string | null,
  onRefresh: () => void 
}) {
  
  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen">
      <main>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Projektübersicht</h2>
           <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center gap-2"
          >
            <ArrowRepeat className={isLoading ? 'animate-spin' : ''} />
            Aktualisieren
          </button>
        </div>

        {/* Fehleranzeige */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Fehler: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Ladeanzeige */}
        {isLoading && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow-md border border-gray-200 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>
             ))}
           </div>
        )}

        {/* Projektliste */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.length > 0 ? (
              projects.map((project) => (
                <Link href={`/projekt/${project.id}`} key={project.id} passHref>
                  <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer group">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2 flex items-center gap-2">
                       <BriefcaseFill className="text-indigo-500" />
                       {project.domain || project.name || 'Unbenanntes Projekt'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">{project.email}</p>
                    <span className="font-medium text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1.5">
                      Zum Dashboard
                      <ArrowRightSquare className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-gray-600 md:col-span-2 lg:col-span-3 text-center">
                Keine Projekte gefunden.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}


// ==========================================================
// KUNDEN-DASHBOARD (Unverändert)
// ==========================================================
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

  const kpis = data.kpis || emptyCustomerData.kpis;
  const charts = data.charts || emptyCustomerData.charts;
  const aiTraffic = data.aiTraffic || emptyCustomerData.aiTraffic;
  const topQueries = data.topQueries || emptyCustomerData.topQueries;
  const chartSeries: ChartData = charts[activeKpi] || [];

  const showNoDataHint = !isLoading && (
    kpis.clicks.value === 0 &&
    kpis.impressions.value === 0 &&
    charts.clicks.length === 0
  );

  const tabMeta: Record<ActiveKpi, { title: string; color: string }> = {
    clicks: { title: 'Klicks', color: '#3b82f6' },
    impressions: { title: 'Impressionen', color: '#8b5cf6' },
    sessions: { title: 'Sitzungen', color: '#10b981' },
    totalUsers: { title: 'Nutzer', color: '#f59e0b' },
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen">
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

        {/* KI-Traffic + Top Queries nebeneinander */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {aiTraffic && (
            <div className="lg:col-span-1">
               <AiTrafficCard
                totalSessions={aiTraffic.totalSessions}
                totalUsers={aiTraffic.totalUsers}
                percentage={kpis.sessions.aiTraffic?.percentage || 0}
                topSources={aiTraffic.topAiSources}
                isLoading={isLoading}
                dateRange={dateRange}
              />
            </div>
          )}

          {(topQueries && topQueries.length > 0) && (
            <div className={`${aiTraffic ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <TopQueriesList
                queries={topQueries}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
        
        {/* Landingpage Approval */}
        <div className="mt-8">
          <LandingpageApproval />
        </div>

        {showNoDataHint && (
          <p className="mt-6 text-sm text-center text-gray-500">
            Hinweis: Für dieses Projekt wurden noch keine Daten geliefert oder die APIs sind nicht korrekt konfiguriert.
          </p>
        )}
      </main>
    </div>
  );
}
