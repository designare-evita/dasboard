// src/app/page.tsx (FINAL FIX)
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
import { SemrushData } from '@/components/SemrushKpiCards';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [dashboardData, setDashboardData] = useState<ProjectDashboardData | null>(null);
  const [semrushData, setSemrushData] = useState<SemrushData | null>(null);
  const [projects, setProjects] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');

  const fetchData = useCallback(async (range: DateRangeOption = dateRange) => {
    setIsLoading(true);
    setError(null);
    try {
      // Beide API-Routen parallel anfragen
      // WICHTIG: Für Kunden OHNE projectId (nutzt automatisch Session)
      const googleDataPromise = fetch(`/api/data?dateRange=${range}`);
      const semrushDataPromise = fetch(`/api/semrush`);

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
        console.error("Fehler beim Laden der Semrush-Daten:", await semrushResponse.text());
        setSemrushData(null);
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (status === 'authenticated') {
      if (session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') {
        setIsLoading(true);
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
        fetchData(dateRange);
      }
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, session, router, fetchData, dateRange]);

  const handleDateRangeChange = (range: DateRangeOption) => {
    setDateRange(range);
  };

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
        semrushData={semrushData}
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

function CustomerDashboard({
  data,
  semrushData,
  isLoading,
  dateRange,
  onDateRangeChange
}: {
  data: ProjectDashboardData;
  semrushData: SemrushData | null;
  isLoading: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}) {
  const showNoDataHint = !isLoading && !hasDashboardData(data);

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <main>
        <ProjectDashboard
          data={data}
          semrushData={semrushData}
          isLoading={isLoading}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          showNoDataHint={showNoDataHint}
          noDataHintText="Hinweis: Für Ihr Projekt wurden noch keine KPI-Daten geliefert. Es werden vorübergehend Platzhalter-Werte angezeigt."
        />

        <div className="mt-8">
          <LandingpageApproval />
        </div>
      </main>
    </div>
  );
}
