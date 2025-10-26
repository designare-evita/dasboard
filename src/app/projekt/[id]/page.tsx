// src/app/projekt/[id]/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr'; // Wir verwenden useSWR direkt für mehr Kontrolle
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import {
  ProjectDashboardData,
  hasDashboardData // Nützliche Hilfsfunktion
} from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
// Semrush-Typ importieren
import { SemrushData } from '@/components/SemrushKpiCards'; 
import { ArrowRepeat, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { useSession } from 'next-auth/react'; // Session für Berechtigungsprüfung

// Einfache Fetcher-Funktion für useSWR
const fetcher = (url: string) => fetch(url).then(async (res) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: res.statusText }));
    const error = new Error(errorData.message || 'Fehler beim Laden der Daten');
    // @ts-ignore // Statuscode an den Fehler anhängen
    error.status = res.status; 
    throw error;
  }
  return res.json();
});

export default function ProjektDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session, status: sessionStatus } = useSession(); // Session holen

  // State für den Zeitraum
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  // 1. SWR-Hook für Google-Daten
  const { 
    data: googleData, 
    isLoading: isLoadingGoogle, 
    error: errorGoogle 
  } = useSWR<ProjectDashboardData>(
    // Nur laden, wenn projectId vorhanden ist
    projectId ? `/api/data?projectId=${projectId}&dateRange=${dateRange}` : null, 
    fetcher
  );

  // 2. SWR-Hook für Semrush-Daten
  const { 
    data: semrushData, 
    isLoading: isLoadingSemrush, 
    error: errorSemrush 
  } = useSWR<SemrushData>(
    // Nur laden, wenn projectId vorhanden ist
    projectId ? `/api/semrush?projectId=${projectId}` : null,
    fetcher
  );

  // Kombinierter Ladezustand
  const isLoading = isLoadingGoogle || isLoadingSemrush || sessionStatus === 'loading';

  // --- Berechtigungsprüfung (wichtig für Admins) ---
  // (Diese Logik muss ggf. angepasst werden, je nachdem, wer Zugriff hat)
  useEffect(() => {
    // Wenn Session geladen, aber User kein Admin/Superadmin ist UND die ID nicht die eigene ist
    if (sessionStatus === 'authenticated' && session?.user && 
        session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN' &&
        session.user.id !== projectId) {
      // Redirect oder Fehlermeldung anzeigen
       console.error("Zugriffsversuch auf fremdes Projekt durch Benutzer:", session.user.id, "auf Projekt:", projectId);
       // redirect('/'); // Zum Beispiel
    }
     // TODO: Implementiere Prüfung, ob Admin Zugriff auf dieses projectId hat, 
     // falls Admins nicht alle Projekte sehen sollen.
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
  // Zeige den ersten aufgetretenen Fehler an
  const error = errorGoogle || errorSemrush;
  if (error) {
    console.error("Fehler beim Laden der Projektdaten:", error);
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] p-8">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg text-center border border-red-200">
           <ExclamationTriangleFill className="text-red-500 mx-auto mb-4" size={40} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Fehler beim Laden</h2>
          <p className="text-gray-600">
             {/* @ts-ignore */}
             {error.status === 404 
                ? 'Das angeforderte Projekt wurde nicht gefunden.' 
                : (error.message || 'Die Dashboard-Daten konnten nicht abgerufen werden.')}
          </p>
           {/* @ts-ignore */}
           {error.status !== 404 && (
             <button 
               onClick={() => window.location.reload()} // Einfacher Reload-Button
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
  // Fallback für den Fall, dass googleData undefiniert ist (sollte nicht passieren, wenn kein Fehler auftritt)
  const finalGoogleData = googleData ?? { kpis: {}, aiTraffic: null, topQueries: [] }; 
  const showNoDataHint = !isLoadingGoogle && !hasDashboardData(finalGoogleData);

  return (
    // Padding für die Seite
    <div className="p-4 sm:p-6 md:p-8">
      <ProjectDashboard
        data={finalGoogleData} 
        semrushData={semrushData ?? null} // Semrush-Daten übergeben (oder null)
        isLoading={isLoading} 
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showNoDataHint={showNoDataHint}
        noDataHintText="Hinweis: Für dieses Projekt wurden noch keine KPI-/Zeitreihen-Daten von Google geliefert. Es werden vorübergehend Platzhalter-Werte angezeigt."
      />
    </div>
  );
}
