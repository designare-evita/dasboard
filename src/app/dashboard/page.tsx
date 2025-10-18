// src/app/dashboard/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';

// Typdefinitionen für Dashboard-Daten
type KPI = {
  value: number;
  change: number;
};

type ChartData = {
  date: string;
  value: number;
}[];

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
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      loadDashboardData();
    }
  }, [status]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('Fehler beim Laden der Daten');
      const data = await response.json();
      
      if (data.role === 'BENUTZER') {
        setDashboardData(data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setIsLoading(false);
    }
  };

  // Auth-Check
  if (status === 'loading') {
    return <div className="p-8 text-center">Lade...</div>;
  }

  if (status === 'unauthenticated' || session?.user?.role !== 'BENUTZER') {
    router.push('/');
    return null;
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('de-DE').format(num);
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '↑';
    if (change < 0) return '↓';
    return '→';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Willkommen zurück, {session.user.email}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <Link
                href="/dashboard/freigabe"
                className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 font-medium flex items-center gap-2 transition-colors shadow-sm"
              >
                ✅ Landingpages freigeben
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Quick-Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link
            href="/dashboard/freigabe"
            className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Landingpages freigeben</h3>
                <p className="text-green-100">
                  Verwalten Sie Ihre Landingpages und geben Sie diese frei
                </p>
              </div>
              <span className="text-5xl">✅</span>
            </div>
          </Link>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Performance-Übersicht</h3>
                <p className="text-blue-100">
                  Ihre wichtigsten Kennzahlen auf einen Blick
                </p>
              </div>
              <span className="text-5xl">📊</span>
            </div>
          </div>
        </div>

        {/* Fehler-Anzeige */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-600">Lade Dashboard-Daten...</p>
          </div>
        )}

        {/* KPIs */}
        {!isLoading && dashboardData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Clicks */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Klicks</h3>
                  <span className="text-2xl">🖱️</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {formatNumber(dashboardData.kpis.clicks.value)}
                </p>
                <p className={`text-sm font-medium ${getChangeColor(dashboardData.kpis.clicks.change)}`}>
                  {getChangeIcon(dashboardData.kpis.clicks.change)} {Math.abs(dashboardData.kpis.clicks.change)}%
                </p>
              </div>

              {/* Impressions */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Impressionen</h3>
                  <span className="text-2xl">👁️</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {formatNumber(dashboardData.kpis.impressions.value)}
                </p>
                <p className={`text-sm font-medium ${getChangeColor(dashboardData.kpis.impressions.change)}`}>
                  {getChangeIcon(dashboardData.kpis.impressions.change)} {Math.abs(dashboardData.kpis.impressions.change)}%
                </p>
              </div>

              {/* Sessions */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Sitzungen</h3>
                  <span className="text-2xl">📈</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {formatNumber(dashboardData.kpis.sessions.value)}
                </p>
                <p className={`text-sm font-medium ${getChangeColor(dashboardData.kpis.sessions.change)}`}>
                  {getChangeIcon(dashboardData.kpis.sessions.change)} {Math.abs(dashboardData.kpis.sessions.change)}%
                </p>
              </div>

              {/* Users */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Nutzer</h3>
                  <span className="text-2xl">👥</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {formatNumber(dashboardData.kpis.totalUsers.value)}
                </p>
                <p className={`text-sm font-medium ${getChangeColor(dashboardData.kpis.totalUsers.change)}`}>
                  {getChangeIcon(dashboardData.kpis.totalUsers.change)} {Math.abs(dashboardData.kpis.totalUsers.change)}%
                </p>
              </div>
            </div>

            {/* Info-Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <span>💡</span> Tipp
              </h3>
              <p className="text-sm text-blue-800">
                Nutzen Sie die Freigabe-Funktion, um Ihre Landingpages zu verwalten. 
                Sie werden benachrichtigt, sobald eine Landingpage zur Prüfung bereitsteht.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
