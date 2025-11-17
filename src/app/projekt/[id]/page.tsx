// src/app/projekt/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { type DateRangeOption } from '@/components/DateRangeSelector';
import {
  ProjectDashboardData,
  ChartEntry
} from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
import { ArrowRepeat, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { useSession } from 'next-auth/react';
import ProjectTimelineWidget from '@/components/ProjectTimelineWidget';

interface FetchError extends Error {
  status?: number;
}

// Der Fetcher bleibt unverändert
const fetcher = (url: string) => fetch(url).then(async (res) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: res.statusText }));
    const error: FetchError = new Error(errorData.message || 'Fehler beim Laden der Daten');
    error.status = res.status; 
    throw error;
  }
  return res.json();
});

export default function ProjektDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const { data: session, status: sessionStatus } = useSession();

  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  // Google-Daten (kritisch)
  const { 
    data: googleData, 
    isLoading: isLoadingGoogle, 
    error: errorGoogle 
  } = useSWR<ProjectDashboardData>(
    projectId ? `/api/data?projectId=${projectId}&dateRange=${dateRange}` : null, 
    fetcher
  );

  // User/Domain-Daten (bleibt unverändert)
  const { 
    data: userData,
    isLoading: isLoadingUser 
  } = useSWR<{ 
    domain?: string; 
    email?: string;
    semrush_tracking_id?: string | null;
    semrush_tracking_id_02?: string | null;
    favicon_url?: string | null;
  }>(
    projectId ? `/api/users/${projectId}` : null,
    fetcher
  );

  useEffect(() => {
    if (userData) {
      console.log('[ProjektPage] User-Daten geladen:', userData);
    }
  }, [userData]);

  const isLoading = isLoadingGoogle || sessionStatus === 'loading';

  const handlePdfExport = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // ... (Zugriffs-Check und Loading-State bleiben unverändert) ...
  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user && 
        session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN' &&
        session.user.id !== projectId) {
       console.error("Zugriffsversuch auf fremdes Projekt durch Benutzer:", session.user.id, "auf Projekt:", projectId);
    }
  }, [sessionStatus, session, projectId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <ArrowRepeat className="animate-spin text-indigo-600" size={40} />
        <span className="ml-3 text-gray-600">Daten werden geladen...</span>
      </div>
    );
  }

  // Error-State (bleibt unverändert)
  const error = errorGoogle as FetchError | undefined;
  if (error) {
    console.error("Fehler beim Laden der Projektdaten:", error);
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] p-8">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg text-center border border-red-200">
           <ExclamationTriangleFill className="text-red-500 mx-auto mb-4" size={40} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Fehler beim Laden</h2>
          <p className="text-gray-600">
             {error.status === 404 
                ? 'Das angeforderte Projekt wurde nicht gefunden.' 
                : (error.message || 'Die Dashboard-Daten konnten nicht abgerufen werden.')}
          </p>
           {error.status !== 404 && (
             <button 
               onClick={() => window.location.reload()}
               className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
             >
               Erneut versuchen
             </button>
           )}
        </div>
      </div>
    );
  }
  
  // +++ KORREKTUR: Fallback-Objekt um apiErrors erweitert +++
  const finalGoogleData: ProjectDashboardData = googleData ?? { 
    kpis: {}, 
    aiTraffic: undefined, 
    topQueries: [],
    countryData: [],
    channelData: [],
    deviceData: [], 
    apiErrors: undefined, // Wichtig für den Fall, dass googleData null ist
  }; 

  // ... (Debug-Log bleibt unverändert) ...

  return (
   <div className="p-4 sm:p-6 md:p-8">
      <main className="space-y-8">
        <ProjectTimelineWidget projectId={projectId} />

        <ProjectDashboard
          data={finalGoogleData} // finalGoogleData enthält jetzt apiErrors
          isLoading={isLoading} 
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onPdfExport={handlePdfExport}
          projectId={projectId}
          domain={userData?.domain}
          faviconUrl={userData?.favicon_url}
          semrushTrackingId={userData?.semrush_tracking_id}
          semrushTrackingId02={userData?.semrush_tracking_id_02}
          
          countryData={finalGoogleData.countryData}
          channelData={finalGoogleData.channelData}
          deviceData={finalGoogleData.deviceData}
        />
      </main>
    </div>
  );
}
