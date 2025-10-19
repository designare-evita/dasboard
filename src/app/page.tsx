// src/app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User } from '@/types';
import { ArrowRepeat } from 'react-bootstrap-icons';
import NotificationBell from '@/components/NotificationBell';
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

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // State für Benutzer (Kunden-Dashboard)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  
  // State für Admins (Projekt-Übersicht)
  const [projects, setProjects] = useState<User[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // === BENUTZER (KUNDE) ANSICHT ===
  if (session?.user?.role === 'BENUTZER') {
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

          {/* KPIs */}
          {dashboardData && (
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

              {/* Landingpage Approval Component */}
              <LandingpageApproval />

              {/* Info-Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
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

  // === ADMIN/SUPERADMIN ANSICHT ===
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
