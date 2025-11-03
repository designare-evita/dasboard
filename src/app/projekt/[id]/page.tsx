// src/app/projekt/[id]/page.tsx (MIT PDF-EXPORT)
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { type DateRangeOption } from '@/components/DateRangeSelector';
import {
  ProjectDashboardData
} from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
import { ArrowRepeat, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { useSession } from 'next-auth/react';

// Fehler-Typ mit status-Property definieren
interface FetchError extends Error {
  status?: number;
}

// Einfache Fetcher-Funktion für useSWR
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

  // State für den Zeitraum
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  // 1. SWR-Hook für Google-Daten (kritisch)
  const { 
    data: googleData, 
    isLoading: isLoadingGoogle, 
    error: errorGoogle 
  } = useSWR<ProjectDashboardData>(
    projectId ? `/api/data?projectId=${projectId}&dateRange=${dateRange}` : null, 
    fetcher
  );

  // 2. SWR-Hook für User/Domain-Daten (inkl. semrush_tracking_id_02)
  const { 
    data: userData 
  } = useSWR<{ 
    domain?: string; 
    email?: string;
    semrush_tracking_id_02?: string | null;
  }>(
    projectId ? `/api/users/${projectId}` : null,
    fetcher
  );

  // Kombinierter Ladezustand - nur Google-Daten sind kritisch
  const isLoading = isLoadingGoogle || sessionStatus === 'loading';

  // --- PDF-Export Handler ---
  const handlePdfExport = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // --- Berechtigungsprüfung (wichtig für Admins) ---
  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user && 
        session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN' &&
        session.user.id !== projectId) {
       console.error("Zugriffsversuch auf fremdes Projekt durch Benutzer:", session.user.id, "auf Projekt:", projectId);
       // redirect('/'); // Optional: Redirect implementieren
    }
  }, [sessionStatus, session, projectId]);


  // --- Ladezustand ---
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <ArrowRepeat className="animate-spin text-indigo-600" size={40} />
        <span className="ml-3 text-gray-600">Daten werden geladen...</span>
      </div>
    );
  }

  // --- Fehlerzustand ---
  // Nur Google-Fehler sind kritisch, Semrush-Fehler werden ignoriert
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
  
  // --- Erfolgszustand ---
  const finalGoogleData: ProjectDashboardData = googleData ?? { 
    kpis: {}, 
    aiTraffic: undefined, 
    topQueries: [] 
  }; 

  return (
   <div className="p-4 sm:p-6 md:p-8">
      <ProjectDashboard
        data={finalGoogleData} 
        isLoading={isLoading} 
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onPdfExport={handlePdfExport}
        projectId={projectId}
        domain={userData?.domain}
        semrushTrackingId02={userData?.semrush_tracking_id_02}
      />
    </div>
  );
}
