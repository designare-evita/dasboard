// src/app/projekt/[id]/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react'; 
import { User } from '@/types';
import {
  ArrowRepeat,
  ExclamationTriangleFill
} from 'react-bootstrap-icons';
import {
  ProjectDashboardData,
} from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

export default function ProjectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [dashboardData, setDashboardData] = useState<ProjectDashboardData | null>(null);
  const [projectUser, setProjectUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  /**
   * Lädt die Dashboard-Daten (Google KPIs) für einen bestimmten Zeitraum.
   */
  const fetchGoogleData = async (range: DateRangeOption) => {
    if (!projectId) return;

    setIsLoading(true); 
    setError(null);
    
    try {
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
      return userData; 
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
      return null;
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && projectId) {
      setIsLoading(true);
      
      fetchProjectDetails().then(userData => {
        if (userData) {
          return fetchGoogleData(dateRange); 
        } else {
          setIsLoading(false);
        }
      }).catch(err => {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
        setIsLoading(false);
      });
      
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, session, projectId, router]);

  const handleDateRangeChange = (range: DateRangeOption) => {
    setDateRange(range); 
    void fetchGoogleData(range); 
  };

  const handlePdfExport = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // --- Render-Zustände ---

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
    // WICHTIG: Wir rendern NUR ProjectDashboard. 
    // Keine Wrapper-Divs mit Padding oder Margin mehr hier!
    // ProjectDashboard kümmert sich um das Layout.
    return (
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
        // KORRIGIERT: Konvertiere null zu undefined für TypeScript-Kompatibilität
        projectTimelineActive={projectUser.project_timeline_active ?? undefined}
        countryData={dashboardData.countryData}
        channelData={dashboardData.channelData}
        deviceData={dashboardData.deviceData}
      />
    );
  }
  
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <p>Dashboard konnte nicht geladen werden.</p>
    </div>
  );
}
