// src/app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowRepeat,
  ExclamationTriangleFill,
  GraphUp,
  ArrowRightSquare,
  ClockHistory // bleibt importiert; kann bei Bedarf entfernt werden
} from 'react-bootstrap-icons';

import KpiCard from '@/components/kpi-card';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import LandingpageApproval from '@/components/LandingpageApproval';
import AiTrafficCard from '@/components/AiTrafficCard';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import TopQueriesList from '@/components/TopQueriesList';

/**
 * SessionUser: Reiner Session-Typ (NextAuth) ohne createdAt etc.
 * Entkoppelt vom DB-User-Typ.
 */
type SessionUser = {
  id: string;
  role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

// --- Typen für Dashboard-Daten ---
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
  sessionsBySource: {
    [key: string]: number; // ✅ korrigierte Index-Signatur
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
  aiTraffic?: AiTrafficData;
};

type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

// --- Leere/Standard-Daten ---
const emptyData: DashboardData = {
  kpis: {
    clicks: { value: 0, change: 0 },
    impressions: { value: 0, change: 0 },
    sessions: { value: 0, change: 0, aiTraffic: { value: 0, percentage: 0 } },
    totalUsers: { value: 0, change: 0 }
  },
  charts: {
    clicks: [],
    impressions: [],
    sessions: [],
    totalUsers: []
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
  const [data, setData] = useState<DashboardData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  const fetchData = useCallback(async (range: DateRangeOption) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/data?dateRange=${range}`);
      if (!response.ok) {
        throw new Error('Netzwerkantwort war nicht erfolgreich');
      }
      const result = await response.json();
      setData(result || emptyData);
    } catch (err) {
      console.error('Fehler beim Abrufen der Daten:', err);
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
      setData(emptyData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData(dateRange);
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, dateRange, router, fetchData]);

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

  // Fehleranzeige
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-red-50 p-8">
        <ExclamationTriangleFill className="text-5xl text-red-500 mb-4" />
        <h2 className="text-2xl font-semibold text-red-800 mb-2">Daten konnten nicht geladen werden</h2>
        <p className="text-red-700 mb-6 text-center">{error}</p>
        <button
          onClick={() => fetchData(dateRange)}
          disabled={isLoading}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50 flex items-center gap-2"
        >
          <ArrowRepeat className={isLoading ? 'animate-spin' : ''} />
          Erneut versuchen
        </button>
      </div>
    );
  }

  // Rollenbasierte Dashboards
  const user = session.user as SessionUser;
  if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
    // Admin/Superadmin Dashboard (Zeigt Admin-Übersicht)
    return <AdminDashboard user={user} />;
  }

  // Kunden-Dashboard (BENUTZER)
  return (
    <CustomerDashboard
      data={data}
      isLoading={isLoading}
      dateRange={dateRange}
      onDateRangeChange={handleDateRangeChange}
    />
  );
}

// --- Admin Dashboard Komponente ---
function AdminDashboard({ user }: { user: SessionUser }) {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <main>
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          Willkommen, {user.name || user.email}!
        </h2>
        <p className="text-lg text-gray-700 mb-8">
          Sie sind als {user.role} angemeldet. Hier sehen Sie bald eine Übersicht aller Projekte.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Beispiel-Karten für Admins */}
          <Link href="/admin">
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer group">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Benutzerverwaltung</h3>
              <p className="text-gray-600 mb-4">Benutzerkonten anzeigen, erstellen und bearbeiten.</p>
              <span className="font-medium text-indigo-600 group-hover:text-indigo-800 flex items-center gap-2">
                Zur Verwaltung <ArrowRightSquare />
              </span>
            </div>
          </Link>

          <Link href="/admin/redaktionsplan">
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer group">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Redaktionsplan</h3>
              <p className="text-gray-600 mb-4">Übersicht aller Landingpages und deren Status.</p>
              <span className="font-medium text-indigo-600 group-hover:text-indigo-800 flex items-center gap-2">
                Zum Redaktionsplan <ArrowRightSquare />
              </span>
            </div>
          </Link>

          {/* Platzhalter */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Systemstatus</h3>
            <p className="text-gray-600">Aktuelle Systemauslastung und API-Status.</p>
            {/* Hier könnte eine Statusanzeige hin */}
          </div>
        </div>
      </main>
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

  // Sicherstellen, dass Daten vorhanden sind, bevor darauf zugegriffen wird
  const kpis = data.kpis || emptyData.kpis;
  const charts = data.charts || emptyData.charts;
  const aiTraffic = data.aiTraffic || emptyData.aiTraffic;
  const topQueries = data.topQueries || emptyData.topQueries;

  const chartSeries: ChartData = charts[activeKpi] || [];

  // Prüfen, ob überhaupt Daten vorhanden sind (nach dem Laden)
  const showNoDataHint =
    !isLoading &&
    kpis.clicks.value === 0 &&
    kpis.impressions.value === 0 &&
    charts.clicks.length === 0;

  const tabMeta: Record<ActiveKpi, { title: string; color: string }> = {
    clicks: { title: 'Klicks', color: '#3b82f6' },
    impressions: { title: 'Impressionen', color: '#8b5cf6' },
    sessions: { title: 'Sitzungen', color: '#10b981' },
    totalUsers: { title: 'Nutzer', color: '#f59e0b' }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen">
      <main>
        {/* Header mit DateRangeSelector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Ihr Dashboard</h2>
          <DateRangeSelector value={dateRange} onChange={onDateRangeChange} />
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
          {/* KI-Traffic Card (1 Spalte) */}
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

          {/* Top Queries */}
          {topQueries && topQueries.length > 0 && (
            <div className={aiTraffic ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <TopQueriesList queries={topQueries} isLoading={isLoading} />
            </div>
          )}
        </div>

        {/* Landingpage Approval */}
        <div className="mt-8">
          <LandingpageApproval />
        </div>

        {/* Hinweis, wenn keine Daten geladen wurden */}
        {showNoDataHint && (
          <p className="mt-6 text-sm text-center text-gray-500">
            Hinweis: Für dieses Projekt wurden noch keine Daten geliefert oder die APIs sind nicht korrekt konfiguriert.
          </p>
        )}
      </main>
    </div>
  );
}
