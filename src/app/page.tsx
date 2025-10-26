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
// Importiere die geteilten Typen und Helfer
import {
  ProjectDashboardData,
  hasDashboardData
} from '@/lib/dashboard-shared';
// Importiere die Dashboard-Komponente
import ProjectDashboard from '@/components/ProjectDashboard';
import LandingpageApproval from '@/components/LandingpageApproval';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

// --- NEUER IMPORT: Typ für Semrush-Daten ---
// (Stellen Sie sicher, dass dieser Pfad zu Ihrer SemrushKpiCards-Komponente passt)
import { SemrushData } from '@/components/SemrushKpiCards'; 

// --- Hauptkomponente ---
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State für Google-Daten
  const [dashboardData, setDashboardData] = useState<ProjectDashboardData | null>(null);
  
  // --- NEUER STATE: State für Semrush-Daten ---
  const [semrushData, setSemrushData] = useState<SemrushData | null>(null);

  const [projects, setProjects] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  // --- KORRIGIERTE DATEN-LADEFUNKTION ---
  const fetchData = useCallback(async (range: DateRangeOption = dateRange) => {
    setIsLoading(true);
    setError(null);
    try {
      // Beide API-Routen parallel anfragen
      const googleDataPromise = fetch(`/api/data?dateRange=${range}`);
      const semrushDataPromise = fetch(`/api/semrush`); // Benötigt keine projectId, nutzt Session

      const [googleResponse, semrushResponse] = await Promise.all([
        googleDataPromise,
        semrushDataPromise
      ]);

      // Google-Daten verarbeiten (kritisch)
      if (!googleResponse.ok) {
        const errorResult = await googleResponse.json();
        throw new Error(errorResult.message || 'Fehler beim Laden der Google-Daten');
      }
      const googleResult = await googleResponse.json();
      setDashboardData(googleResult);

      // Semrush-Daten verarbeiten (nicht-kritisch)
      if (semrushResponse.ok) {
        const semrushResult = await semrushResponse.json();
        setSemrushData(semrushResult);
      } else {
        // Fehler bei Semrush loggen, aber die Seite nicht blockieren
        console.error("Fehler beim Laden der Semrush-Daten:", await semrushResponse.text());
        setSemrushData(null); // Sicherstellen, dass keine alten Daten angezeigt werden
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]); // Abhängigkeit von dateRange ist korrekt

  // Daten basierend auf Session und Rolle laden
  useEffect(() => {
    if (status === 'authenticated') {
      if (session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') {
        // Admins/Superadmins: Projektliste laden
        setIsLoading(true);
        fetch('/api/projects') // API-Endpunkt für Admin-Projekte
          .then(res => res.json())
          .then(data => {
            setProjects(data.projects || []);
            setIsLoading(false);
          })
          .catch(err => {
            setError(err.message);
            setIsLoading(false);
          });
      } else if (session.user.role === 'BENUTZER') {
        // Kunden: Dashboard-Daten laden
        fetchData(dateRange);
      }
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, session, router, fetchData, dateRange]); // fetchData/dateRange hier für Kunden-Dashboard

  // Handler für Datumsbereich-Änderung (nur für Kunden relevant)
  const handleDateRangeChange = (range: DateRangeOption) => {
    setDateRange(range);
    // fetchData wird durch den useEffect oben automatisch neu ausgelöst
  };

  // --- Render-Logik ---

  if (status === 'loading' || (isLoading && !dashboardData && !error)) {
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

  if (session?.user.role === 'ADMIN' || session?.user.role === 'SUPERADMIN') {
    return (
      <AdminDashboard 
        projects={projects} 
        isLoading={isLoading} 
      />
    );
  }

  if (session?.user.role === 'BENUTZER' && dashboardData) {
    return (
      <CustomerDashboard
        data={dashboardData}
        semrushData={semrushData} // <-- KORRIGIERT: Semrush-Daten übergeben
        isLoading={isLoading}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
      />
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <p>Unbekannter Status oder keine Daten.</p>
    </div>
  );
}


// --- Admin Dashboard Komponente (unverändert) ---
function AdminDashboard({ projects, isLoading }: { projects: User[], isLoading: boolean }) {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Alle Projekte</h1>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-md border border-gray-200 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-9 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <Link href={`/projekt/${project.id}`} key={project.id} legacyBehavior>
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between h-full min-h-[160px]">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 truncate mb-1">{project.domain || project.email}</h2>
                    <p className="text-sm text-gray-500 mb-4 truncate">{project.domain ? project.email : 'Keine Domain zugewiesen'}</p>
                  </div>
                  <span className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1.5 transition-colors">
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
function CustomerDashboard({
  data,
  semrushData, // <-- KORRIGIERT: Semrush-Daten empfangen
  isLoading,
  dateRange,
  onDateRangeChange
}: {
  data: ProjectDashboardData;
  semrushData: SemrushData | null; // <-- KORRIGIERT: Typ hinzugefügt
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}) {

  // Verwende die Hilfsfunktion, um zu prüfen, ob Daten vorhanden sind
  const showNoDataHint = !isLoading && !hasDashboardData(data);

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <main>
        {/* Nutze die ProjectDashboard Komponente */}
        <ProjectDashboard
          data={data}
          semrushData={semrushData} // <-- KORRIGIERT: Semrush-Daten weitergeben
          isLoading={isLoading}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          showNoDataHint={showNoDataHint}
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
