// src/app/projekt/[id]/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { User } from '@/types';
import {
  ArrowRepeat,
  ExclamationTriangleFill
} from 'react-bootstrap-icons';
import {
  ProjectDashboardData,
} from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
import ProjectTimelineWidget from '@/components/ProjectTimelineWidget'; // Importiert
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

/**
 * Dies ist die Haupt-Seitenkomponente für die Einzelprojekt-Ansicht.
 * Sie wird unter /projekt/[id] gerendert.
 */
export default function ProjectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string; // Holt die ID aus der URL

  const [dashboardData, setDashboardData] = useState<ProjectDashboardData | null>(null);
  const [projectUser, setProjectUser] = useState<User | null>(null); // Details des Projekts (Domain, Keys, etc.)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  /**
   * Lädt die Dashboard-Daten (Google KPIs) UND die Projekt-Details (User-Daten).
   */
  const fetchData = useCallback(async (range: DateRangeOption) => {
    if (!projectId) return;

    // Nur beim ersten Mal oder bei Bereichswechsel laden
    if (!dashboardData) setIsLoading(true);
    setError(null);
    
    try {
      // 1. Lade die Google-Daten (KPIs, Charts) für dieses Projekt und diesen Zeitraum
      // Nutzt die API-Route: /api/projects/[id]
      const googleResponse = await fetch(`/api/projects/${projectId}?dateRange=${range}`);

      if (!googleResponse.ok) {
        const errorResult = await googleResponse.json();
        throw new Error(errorResult.message || 'Fehler beim Laden der Google-Daten');
      }
      
      const googleResult = await googleResponse.json();
      setDashboardData(googleResult);

      // 2. Lade die Projekt-Details (Domain, Semrush-Keys, Favicon, etc.)
      // Wir nutzen die /api/users/[id] Route, da das Projekt = ein User der Rolle "BENUTZER" ist
      if (!projectUser) { // Nur laden, wenn wir sie noch nicht haben
        const userResponse = await fetch(`/api/users/${projectId}`);
        if (!userResponse.ok) {
          const errorResult = await userResponse.json();
          throw new Error(errorResult.message || 'Fehler beim Laden der Projekt-Details');
        }
        const userData = await userResponse.json();
        setProjectUser(userData);
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, dashboardData, projectUser]); // Abhängigkeiten aktualisiert

  // Effekt zum Laden der Daten, wenn die Seite geladen wird oder sich der Zeitraum ändert
  useEffect(() => {
    if (status === 'authenticated' && projectId) {
      void fetchData(dateRange);
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, projectId, dateRange, fetchData, router]); 

  // Handler für den Wechsel des Zeitraums
  const handleDateRangeChange = (range: DateRangeOption) => {
    setDateRange(range);
    // Daten neu laden (fetchData wird durch den useEffect oben aufgerufen)
  };

  // Handler für PDF-Export
  const handlePdfExport = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // --- Render-Zustände ---

  if (isLoading || status === 'loading' || !projectUser || !dashboardData) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <ArrowRepeat className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 p-8">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg text-center border border-red-200">
          <ExclamationTriangleFill className="text-red-500 mx-auto mb-4" size={40} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Fehler beim Laden</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // --- Erfolgreiches Rendering ---
  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <main className="space-y-8">
        
        {/* Projekt-Timeline-Widget (lädt seine eigenen Daten) */}
        <ProjectTimelineWidget projectId={projectId} />

        {/* Das Haupt-Dashboard */}
        <ProjectDashboard
          data={dashboardData}
          isLoading={isLoading}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          onPdfExport={handlePdfExport}
          // Projekt-Details aus projectUser übergeben
          projectId={projectUser.id}
          domain={projectUser.domain}
          faviconUrl={projectUser.favicon_url}
          semrushTrackingId={projectUser.semrush_tracking_id}
          semrushTrackingId02={projectUser.semrush_tracking_id_02}
          // Chart-Daten aus dashboardData übergeben
          countryData={dashboardData.countryData}
          channelData={dashboardData.channelData}
          deviceData={dashboardData.deviceData}
        />
      </main>
    </div>
  );
}
