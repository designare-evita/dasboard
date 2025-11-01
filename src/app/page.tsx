// src/app/page.tsx (FINAL FIX - KORRIGIERT)
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
import {
  ProjectDashboardData,
  hasDashboardData
} from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
import LandingpageApproval from '@/components/LandingpageApproval';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [dashboardData, setDashboardData] = useState<ProjectDashboardData | null>(null);
  const [projects, setProjects] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [userDomain, setUserDomain] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async (range: DateRangeOption = dateRange) => {
    setIsLoading(true);
    setError(null);
    try {
      // Nur Google-Daten laden - Semrush lädt jede Komponente selbst
      const googleResponse = await fetch(`/api/data?dateRange=${range}`);
      
      if (!googleResponse.ok) {
        throw new Error('Fehler beim Laden der Dashboard-Daten');
      }
      
      const googleData = await googleResponse.json();
      setDashboardData(googleData);
      setUserDomain(googleData?.kpis?.domain);

    } catch (err) {
      console.error('Fehler in fetchData:', err);
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.');
      setDashboardData(null); // Bei Fehler Daten zurücksetzen
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]); // Abhängigkeit von dateRange

  const fetchAdminProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/projects'); // API-Endpunkt für Admins
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Projekte');
      }
      const data: User[] = await response.json();
      setProjects(data);
    } catch (err) {
      console.error('Fehler in fetchAdminProjects:', err);
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') {
      return; // Warten, bis die Session geladen ist
    }
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (session) {
      const { role } = session.user;
      if (role === 'ADMIN' || role === 'SUPERADMIN') {
        fetchAdminProjects();
      } else if (role === 'BENUTZER') {
        fetchData(dateRange);
      }
    }
  }, [status, session, router, fetchAdminProjects, fetchData, dateRange]);

  const handleDateRangeChange = (range: DateRangeOption) => {
    setDateRange(range);
    // Nur bei "BENUTZER" neu laden, Admins sehen nur eine Liste
    if (session?.user?.role === 'BENUTZER') {
      fetchData(range);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <ArrowRepeat className="animate-spin text-indigo-600 h-12 w-12 mx-auto" size={40} />
          <h2 className="text-xl font-bold text-gray-800 mt-4">
            Lade...
          </h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-6 bg-white rounded-lg shadow-md border border-red-200">
          <ExclamationTriangleFill className="text-red-500 h-12 w-12 mx-auto" size={40} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Fehler</h2>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  if (session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN') {
    return (
      <AdminProjectList 
        projects={projects} 
        isLoading={isLoading} 
      />
    );
  }

  if (session?.user?.role === 'BENUTZER' && dashboardData) {
    return (
      <CustomerDashboard
        data={dashboardData}
        isLoading={isLoading}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        domain={userDomain}
        userId={session.user.id}
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <p>Keine Daten verfügbar oder ungültiger Benutzerstatus.</p>
    </div>
  );
}

function AdminProjectList({ projects, isLoading }: { projects: User[], isLoading: boolean }) {
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Projektübersicht</h1>
        
        {/* Platzhalter für Filter/Suche */}
        {/* <div className="mb-4">...</div> */}

        {isLoading ? (
          <p>Projekte werden geladen...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link 
                href={`/projekt/${project.id}`} 
                key={project.id}
                className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg hover:border-indigo-500 transition-all duration-200 group"
              >
                <div className="flex flex-col h-full">
                  <div className="flex-grow">
                    <div className="mb-3">
                      <GraphUp size={32} className="text-indigo-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      {project.domain || project.email}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                      {project.domain ? project.email : `ID: ${project.id}`}
                    </p>
                  </div>
                  
                  <span className="mt-auto text-sm font-medium text-indigo-600 group-hover:text-indigo-800 flex items-center gap-2">
                    Dashboard öffnen
                    <ArrowRightSquare size={14} />
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

function CustomerDashboard({
  data,
  isLoading,
  dateRange,
  onDateRangeChange,
  domain,
  userId
}: {
  data: ProjectDashboardData;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  domain?: string;
  userId?: string;
}) {
  const showNoDataHint = !isLoading && !hasDashboardData(data);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (userId) {
      fetch(`/api/users/${userId}`)
        .then(res => res.json())
        .then(userData => setUser(userData))
        .catch(err => console.error('Fehler beim Laden der User-Daten:', err));
    }
  }, [userId]);

  // PDF-Export-Funktion definieren
  const handlePdfExport = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <main>
        <ProjectDashboard
          data={data}
          isLoading={isLoading}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          showNoDataHint={showNoDataHint}
          noDataHintText="Hinweis: Für Ihr Projekt wurden noch keine KPI-Daten geliefert. Es werden vorübergehend Platzhalter-Werte angezeigt."
          projectId={userId}
          domain={user?.domain || domain}
          
          // KORREKTUR: Snake_case verwenden
          semrushTrackingId02={user?.semrush_tracking_id_02} 
          
          onPdfExport={handlePdfExport}
        />
        
        {/* Landingpage Approval (wird beim Drucken ausgeblendet) */}
        <div className="mt-6 print:hidden">
          <LandingpageApproval projectId={userId} />
        </div>
      </main>
    </div>
  );
}
