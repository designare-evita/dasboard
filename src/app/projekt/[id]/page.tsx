// src/app/projekt/[id]/page.tsx
// KEIN 'use client'; mehr hier oben!

import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { User } from '@/types';
import { ProjectDashboardData, DateRangeOption } from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
import { ArrowRepeat, ExclamationTriangleFill } from 'react-bootstrap-icons';

// Importiere unsere Caching-Funktion und Berechtigungs-Helfer
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { canAccessProject } from '@/lib/permissions';
import { redirect } from 'next/navigation';

// Eine Lade-Komponente für Suspense
function DashboardLoading() {
  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
      <ArrowRepeat className="animate-spin text-indigo-600" size={40} />
      <span className="ml-3 text-gray-600">Daten werden geladen...</span>
    </div>
  );
}

// Eine Fehler-Komponente
function DashboardError({ message }: { message: string }) {
  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-200px)] p-8">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-lg text-center border border-red-200">
        <ExclamationTriangleFill className="text-red-500 mx-auto mb-4" size={40} />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Fehler beim Laden</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

/**
 * Neue Lade-Komponente, die 'async' ist und die Daten abruft.
 * Sie wird von der Hauptseite in <Suspense> eingehüllt.
 */
async function DashboardLoader({ projectId, dateRange }: { projectId: string; dateRange: DateRangeOption }) {
  // 1. Lade Benutzerdaten (Domain, Semrush IDs)
  let userData: User | null = null;
  try {
    const { rows } = await sql<User>`
      SELECT id, email, domain, gsc_site_url, ga4_property_id, semrush_tracking_id_02 
      FROM users 
      WHERE id::text = ${projectId}
    `;
    if (rows.length > 0) {
      userData = rows[0];
    }
  } catch (e) {
    return <DashboardError message={e instanceof Error ? e.message : 'Fehler beim Laden der Benutzerdaten'} />;
  }

  if (!userData) {
    return <DashboardError message="Das angeforderte Projekt wurde nicht gefunden." />;
  }

  // 2. Lade Google-Daten (über unseren neuen Cache)
  let googleData: (ProjectDashboardData & { fromCache?: boolean }) | null = null;
  try {
    googleData = await getOrFetchGoogleData(userData, dateRange);
  } catch (e) {
    return <DashboardError message={e instanceof Error ? e.message : 'Fehler beim Laden der Google-Daten'} />;
  }
  
  if (!googleData) {
     return <DashboardError message="Für dieses Projekt sind weder GSC noch GA4 konfiguriert." />;
  }

  // 3. Übergib die geladenen Daten an die Client-Komponente
  return (
    <ProjectDashboard
      // Initialdaten (serverseitig geladen)
      initialData={googleData}
      isLoading={false} // WICHTIG: Die initialen Daten sind bereits geladen
      dateRange={dateRange}
      // onDateRangeChange wird jetzt vom Client-Component selbst gehandhabt
      projectId={projectId}
      domain={userData?.domain}
      semrushTrackingId02={userData?.semrush_tracking_id_02}
    />
  );
}


/**
 * Die Hauptseite ist jetzt 'async' (eine Server Component)
 */
export default async function ProjektDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const projectId = params.id;
  const session = await getServerSession(authOptions);

  // 1. Serverseitige Berechtigungsprüfung
  if (!(await canAccessProject(session, projectId))) {
    console.warn(`[RSC /projekt/${projectId}] Zugriff verweigert für User ${session?.user?.id}`);
    redirect('/'); // Bei fehlender Berechtigung zurück zur Startseite
  }
  
  // 2. Datumsbereich aus URL lesen (oder Standard)
  const dateRange = (searchParams?.dateRange || '30d') as DateRangeOption;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Suspense fängt den Ladezustand von DashboardLoader ab.
        Der Benutzer sieht 'DashboardLoading', während der Server die Daten abruft.
      */}
      <Suspense fallback={<DashboardLoading />}>
        <DashboardLoader projectId={projectId} dateRange={dateRange} />
      </Suspense>
    </div>
  );
}
