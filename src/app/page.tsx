// src/app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { User } from '@/types';
import {
  ArrowRepeat,
  ExclamationTriangleFill,
  GraphUp,
  ArrowRightSquare
} from 'react-bootstrap-icons';
// Importiere die neuen geteilten Typen und Helfer
import {
  ProjectDashboardData,
  hasDashboardData
} from '@/lib/dashboard-shared';
// Importiere die neue wiederverwendbare Dashboard-Komponente
import ProjectDashboard from '@/components/ProjectDashboard';
import LandingpageApproval from '@/components/LandingpageApproval';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
// Alte, spezifische Typen wie KPI, ChartData, DashboardData, ActiveKpi können entfernt werden

// --- Hauptkomponente ---
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Verwende den neuen Typ für die Dashboard-Daten
  const [dashboardData, setDashboardData] = useState<ProjectDashboardData | null>(null);
  const [projects, setProjects] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  const fetchData = useCallback(async (range: DateRangeOption = dateRange) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/data?dateRange=${range}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Daten konnten nicht geladen werden');
      }

      // Stelle sicher, dass 'data' als ProjectDashboardData behandelt wird, wenn BENUTZER
      const data = await response.json();

      if (data.role === 'ADMIN' || data.role === 'SUPERADMIN') {
        setProjects(data.projects || []);
      } else if (data.role === 'BENUTZER') {
        // Hier können wir den Typ expliziter machen, falls nötig
        setDashboardData(data as ProjectDashboardData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]); // fetchData bleibt als Abhängigkeit erhalten

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData(dateRange);
    }
  }, [status, dateRange, fetchData]);

  // Ladezustand (unverändert)
  if (status === 'loading' || (status === 'authenticated' && isLoading && !dashboardData && !projects.length)) {
    return (
      <div className="p-8 text-center flex items-center justify-center min-h-[50vh]">
        <ArrowRepeat className="animate-spin text-indigo-600 mr-2" size={24} />
        <p className="text-gray-600">Dashboard wird geladen...</p>
      </div>
    );
  }

  // Nicht authentifiziert (unverändert)
  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  // Fehlerzustand (unverändert)
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

  // Admin- & Superadmin-Ansicht (unverändert)
  if (session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN') {
    return <AdminDashboard projects={projects} />;
  }

  // Kunden-Ansicht - verwendet jetzt die CustomerDashboard-Komponente
  if (session?.user?.role === 'BENUTZER' && dashboardData) {
    return (
      <CustomerDashboard
        data={dashboardData}
        isLoading={isLoading} // Wird an ProjectDashboard weitergegeben
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
    );
  }

  // Fallback, falls keine Daten vorhanden sind
  return (
    <div className="p-8 text-center text-gray-500">
      Keine Daten zur Anzeige verfügbar.
    </div>
  );
}

// --- Admin Dashboard Komponente ---
// (Diese Komponente bleibt unverändert)
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
// (Diese Komponente verwendet jetzt ProjectDashboard)
function CustomerDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange
}: {
  data: ProjectDashboardData; // Typ aktualisiert
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}) {

  // Verwende die Hilfsfunktion, um zu prüfen, ob Daten vorhanden sind
  const showNoDataHint = !isLoading && !hasDashboardData(data);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <main>
        {/* Nutze die neue ProjectDashboard Komponente */}
        <ProjectDashboard
          data={data}
          isLoading={isLoading} // Gib isLoading weiter
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          showNoDataHint={showNoDataHint} // Zeige Hinweis nur, wenn keine Daten da sind
          noDataHintText="Hinweis: Für Ihr Projekt wurden noch keine KPI-Daten geliefert. Es werden vorübergehend Platzhalter-Werte angezeigt."
        />

        {/* Die Landingpage Approval Komponente bleibt spezifisch für diese Seite */}
        <div className="mt-8"> {/* Fügt etwas Abstand hinzu */}
          <LandingpageApproval />
        </div>
      </main>
    </div>
  );
}
