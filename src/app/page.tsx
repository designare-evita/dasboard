// src/app/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react'; // useCallback entfernt, da nicht mehr benötigt
import Link from 'next/link';
import { User } from '@/types';
import {
  ArrowRepeat,
  ExclamationTriangleFill,
  GraphUp,
  ArrowRightSquare
} from 'react-bootstrap-icons';
import {
  ProjectDashboardData,
  ChartEntry
} from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
import LandingpageApproval from '@/components/LandingpageApproval';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

import ProjectTimelineWidget from '@/components/ProjectTimelineWidget';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [dashboardData, setDashboardData] = useState<ProjectDashboardData | null>(null);
  const [projects, setProjects] = useState<User[]>([]); // Für Admins
  const [isLoading, setIsLoading] = useState(true); // Genereller Ladezustand
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  
  const [customerUser, setCustomerUser] = useState<User | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true); // Nur für initiales Laden des Users

  // Diese Funktion lädt die Google-Daten für einen bestimmten Zeitraum
  const fetchGoogleData = async (range: DateRangeOption) => {
    setIsLoading(true); // Signalisiert, dass Diagramme/KPIs laden
    setError(null);
    try {
      const googleResponse = await fetch(`/api/data?dateRange=${range}`);
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

  // Effekt für das INITIALE Laden der Seite
  useEffect(() => {
    if (status === 'authenticated') {
      if (session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') {
        setIsLoading(true);
        setIsLoadingCustomer(false); 
        fetch('/api/projects')
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
        setIsLoadingCustomer(true); // Startet Laden des Kunden-Profils
        
        fetch(`/api/users/${session.user.id}`)
          .then(res => res.json())
          .then(userData => {
            setCustomerUser(userData);
            // Sobald wir den User haben, laden wir die INITIALEN Google-Daten
            return fetchGoogleData(dateRange); // Verwendet den initialen dateRange-State
          })
          .catch(err => {
            console.error('[HomePage] ❌ Fehler beim Laden der User-Daten:', err);
            setError(err.message);
          })
          .finally(() => {
            setIsLoadingCustomer(false); // Kunde geladen (oder fehlgeschlagen)
          });
      }
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
    // WICHTIG: Dieser Effekt läuft nur einmal, wenn sich die Session ändert
  }, [status, session, router]); // dateRange und fetchData wurden hier entfernt

  // Handler für Datumsänderung
  const handleDateRangeChange = (range: DateRangeOption) => {
    setDateRange(range); // 1. State für den Selector aktualisieren
    if (session?.user.role === 'BENUTZER') {
      void fetchGoogleData(range); // 2. Daten für den neuen Bereich laden
    }
  };

  const handlePdfExport = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // --- Render-Zustände ---

  // Zeigt Lade-Spinner, während die Session ODER der Kunde ODER die initialen Daten geladen werden
  if (status === 'loading' || isLoadingCustomer || (isLoading && !dashboardData && !error)) {
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

  if (session?.user.role === 'BENUTZER' && dashboardData && customerUser) {
    return (
      <CustomerDashboard
        data={dashboardData}
        isLoading={isLoading}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        onPdfExport={handlePdfExport}
        user={customerUser}
      />
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <p>Lädt Dashboard...</p>
    </div>
  );
}

// (AdminDashboard-Komponente bleibt unverändert)
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

// (CustomerDashboard-Rendering ist jetzt korrekt)
function CustomerDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  onPdfExport,
  user
}: {
  data: ProjectDashboardData;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  onPdfExport: () => void;
  user: User;
}) {

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <main className="space-y-8">
        
        {/* Zeigt Timeline nur an, wenn sie für den User aktiviert ist */}
        {user.project_timeline_active && (
          <ProjectTimelineWidget projectId={user.id} />
        )}

        <ProjectDashboard
          data={data}
          isLoading={isLoading} // Diese Prop steuert jetzt die Ladeanzeigen im Dashboard
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          onPdfExport={onPdfExport}
          projectId={user.id}
          domain={user.domain}
          faviconUrl={user.favicon_url}
          semrushTrackingId={user.semrush_tracking_id}
          semrushTrackingId02={user.semrush_tracking_id_02}
          
          countryData={data.countryData}
          channelData={data.channelData}
          deviceData={data.deviceData}
        />
        
      </main>
    </div>
  );
}
