// src/app/projekt/[id]/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react'; // useCallback entfernt
import { User } from '@/types';
import {
  ArrowRepeat,
  ExclamationTriangleFill
} from 'react-bootstrap-icons';
import {
  ProjectDashboardData,
} from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
import ProjectHeader from '@/components/ProjectHeader';
import ProjectTimelineWidget from '@/components/ProjectTimelineWidget';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

export default function ProjectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [dashboardData, setDashboardData] = useState<ProjectDashboardData | null>(null);
  const [projectUser, setProjectUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Genereller Ladezustand
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  /**
   * Lädt die Dashboard-Daten (Google KPIs) für einen bestimmten Zeitraum.
   */
  const fetchGoogleData = async (range: DateRangeOption) => {
    if (!projectId) return;

    setIsLoading(true); // Signalisiert, dass Diagramme/KPIs laden
    setError(null);
    
    try {
      // Lade die Google-Daten (KPIs, Charts)
      const googleResponse = await fetch(`/api/projects/${projectId}?dateRange=${range}`);
      if (!googleResponse.ok) {
        const errorResult = await googleResponse.json();
        throw new Error(errorResult.message || 'Fehler beim Laden der Google-Daten');
      }
      const googleResult = await googleResponse.json();
      setDashboardData(googleResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Lädt die Projekt-Details (Domain, Keys, etc.) - Nur einmal.
   */
  const fetchProjectDetails = async () => {
    if (!projectId) return null;
    
    try {
      const userResponse = await fetch(`/api/users/${projectId}`);
      if (!userResponse.ok) {
        const errorResult = await userResponse.json();
        throw new Error(errorResult.message || 'Fehler beim Laden der Projekt-Details');
      }
      const userData = await userResponse.json();
      setProjectUser(userData);
      return userData; // Gib userData zurück, damit wir den nächsten Schritt verketten können
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
      return null;
    }
  };

  // Effekt für das INITIALE Laden der Seite
  useEffect(() => {
    if (status === 'authenticated' && projectId) {
      setIsLoading(true);
      
      // 1. Lade Projekt-Details
      fetchProjectDetails().then(userData => {
        // 2. Wenn Details erfolgreich geladen, lade initiale Google-Daten
        if (userData) {
          return fetchGoogleData(dateRange); // Verwendet initialen dateRange
        } else {
          // Wenn fetchProjectDetails fehlschlägt (z.B. 403 Forbidden), setze Loading auf false
          setIsLoading(false);
        }
      }).catch(err => {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
        setIsLoading(false);
      });
      
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
    // Dieser Effekt läuft nur einmal, wenn sich die Session ändert
  }, [status, session, projectId, router]); // dateRange entfernt

  // Handler für Datumsänderung
  const handleDateRangeChange = (range: DateRangeOption) => {
    setDateRange(range); // 1. State für den Selector aktualisieren
    void fetchGoogleData(range); // 2. Daten für den neuen Bereich laden
  };

  // Handler für PDF-Export
  const handlePdfExport = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // --- Render-Zustände ---

  // Zeigt Lade-Spinner, während die Session ODER die initialen Daten geladen werden
  if (status === 'loading' || (isLoading && !dashboardData && !error) || !projectUser && !error) {
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
  if (dashboardData && projectUser) {
    return (
      <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
        <main className="space-y-8">
          
          {/* +++ KORREKTUR: "domain" wird übergeben +++ */}
          {projectUser.project_timeline_active && (
            <ProjectTimelineWidget 
              projectId={projectId} 
              domain={projectUser.domain} // Domain hier hinzugefügt
            />
          )}

          <ProjectDashboard
            data={dashboardData}
            isLoading={isLoading}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            onPdfExport={handlePdfExport}
            projectId={projectUser.id}
            domain={projectUser.domain}
            faviconUrl={projectUser.favicon_url}
            semrushTrackingId={projectUser.semrush_tracking_id}
            semrushTrackingId02={projectUser.semrush_tracking_id_02}
            countryData={dashboardData.countryData}
            channelData={dashboardData.channelData}
            deviceData={dashboardData.deviceData}
          />
        </main>
      </div>
    );
  }
  
  // (Restlicher Fallback bleibt gleich)
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <p>Dashboard konnte nicht geladen werden.</p>
    </div>
  );
}
