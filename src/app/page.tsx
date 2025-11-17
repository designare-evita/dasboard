// src/app/page.tsx (FINALE KORREKTUR - Domain & Favicon & ApiErrors)
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
  const [projects, setProjects] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  
  const [customerUser, setCustomerUser] = useState<User | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);

  // ... (fetchData, useEffect, handleDateRangeChange, handlePdfExport bleiben unverändert) ...
  const fetchData = useCallback(async (range: DateRangeOption) => {
    setIsLoading(true);
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
  }, []); 

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
        setIsLoadingCustomer(true);
        
        fetch(`/api/users/${session.user.id}`)
          .then(res => res.json())
          .then(userData => {
            console.log('[HomePage] ✅ User-Daten geladen:', userData.email, 'Domain:', userData.domain);
            setCustomerUser(userData);
            return fetchData(dateRange);
          })
          .catch(err => {
            console.error('[HomePage] ❌ Fehler beim Laden der User-Daten:', err);
            setError(err.message);
          })
          .finally(() => {
            setIsLoadingCustomer(false);
          });
      }
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, session, router, dateRange, fetchData]); 

  const handleDateRangeChange = (range: DateRangeOption) => {
    setDateRange(range);
    if (session?.user.role === 'BENUTZER') {
      void fetchData(range);
    }
  };

  const handlePdfExport = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // ... (Lade- und Fehler-Zustände bleiben unverändert) ...
  if (status === 'loading' || 
      (session?.user.role === 'BENUTZER' && isLoadingCustomer) ||
      (session?.user.role === 'BENUTZER' && isLoading && !dashboardData && !error)) {
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

  // ... (AdminDashboard-Rendering bleibt unverändert) ...
  if (session?.user.role === 'ADMIN' || session?.user.role === 'SUPERADMIN') {
    return (
      <AdminDashboard 
        projects={projects} 
        isLoading={isLoading} 
      />
    );
  }

  if (session?.user.role === 'BENUTZER' && dashboardData && customerUser) {
    console.log('[HomePage] 🎯 Rendering CustomerDashboard mit Domain:', customerUser.domain);
    
    return (
      <CustomerDashboard
        data={dashboardData} // dashboardData enthält jetzt apiErrors
        isLoading={isLoading}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        onPdfExport={handlePdfExport}
        user={customerUser}
      />
    );
  }

  // ... (Fallback-Rendering bleibt unverändert) ...
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <p>Lädt Dashboard...</p>
    </div>
  );
}

// ... (AdminDashboard-Komponente bleibt unverändert) ...
function AdminDashboard({ projects, isLoading }: { projects: User[], isLoading: boolean }) {
  // ... (JSX für AdminDashboard)
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* ... */}
    </div>
  );
}


// +++ KORREKTUR: CustomerDashboard leitet apiErrors weiter +++
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
        
        <ProjectTimelineWidget />

        <ProjectDashboard
          data={data} // data enthält apiErrors
          isLoading={isLoading}
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
        
        {/* LandingpageApproval wird jetzt über /dashboard/freigabe aufgerufen */}

      </main>
    </div>
  );
}
