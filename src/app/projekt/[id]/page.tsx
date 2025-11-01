// src/app/projekt/[id]/page.tsx (KORRIGIERT FÜR LINTING, TYPEN & PDF)
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { type DateRangeOption } from '@/components/DateRangeSelector';
import {
  ProjectDashboardData,
  hasDashboardData
} from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
import { ArrowRepeat, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { useSession } from 'next-auth/react';
import { User } from '@/types'; // KORREKTUR: User-Typ importieren

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
  const params = useParams();
  const projectId = params.id as string;
  const { data: session, status: sessionStatus } = useSession();

  // State für den Zeitraum
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  // 1. SWR-Hook für Google-Daten (kritisch)
  const { 
    data: googleData, 
    error: googleError, 
    isLoading: isLoadingGoogle,
    mutate: _mutateGoogleData // KORREKTUR: 'mutate' in '_mutateGoogleData' umbenannt (wg. Linter)
  } = useSWR<ProjectDashboardData, FetchError>(
    projectId ? `/api/data?projectId=${projectId}&dateRange=${dateRange}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  // Kombinierter Ladezustand
  const isLoading = isLoadingGoogle || sessionStatus === 'loading';
  const error = googleError;

  // 2. SWR-Hook für Admin-Projektliste (nur für Admins)
  const { data: adminProjects } = useSWR<User[]>( // KORREKTUR: 'any[]' zu 'User[]'
    session?.user?.role === 'ADMIN' ? '/api/projects' : null,
    fetcher
  );
  
  // Effekt, um sicherzustellen, dass Admins auf Projekte zugreifen können
  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.role === 'ADMIN' && adminProjects) {
      // (Logik)
    }
  }, [sessionStatus, session, adminProjects, projectId]);


  // PDF-Export-Funktion definieren
  const handlePdfExport = () => {
    // Ruft den Druckdialog des Browsers auf
    window.print();
  };


  // --- Ladezustand ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <ArrowRepeat className="animate-spin text-indigo-600 h-12 w-12 mx-auto" size={40} />
          <h2 className="text-xl font-bold text-gray-800 mt-4">
            Dashboard wird geladen...
          </h2>
          <p className="text-gray-600">
            Bitte einen Moment Geduld, die Daten werden aufbereitet.
          </p>
        </div>
      </div>
    );
  }

  // --- Fehlerzustand ---
  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center p-6 bg-white rounded-lg shadow-md border border-red-200">
          <ExclamationTriangleFill className="text-red-500 h-12 w-12 mx-auto" size={40} />
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
  const showNoDataHint = !isLoadingGoogle && !hasDashboardData(finalGoogleData);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <ProjectDashboard
        data={finalGoogleData} 
        isLoading={isLoading} 
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showNoDataHint={showNoDataHint}
        noDataHintText="Hinweis: Für dieses Projekt wurden noch keine KPI-/Zeitreihen-Daten von Google geliefert. Es werden vorübergehend Platzhalter-Werte angezeigt."
        projectId={projectId}
        domain={googleData?.kpis?.domain}
        
        // KORREKTUR: snake_case verwenden
        semrushTrackingId02={googleData?.kpis?.semrush_tracking_id_02} 
        
        onPdfExport={handlePdfExport} 
      />
    </div>
  );
}
