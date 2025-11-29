// src/app/projekt/[id]/page.tsx

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { sql } from '@vercel/postgres';
import { User } from '@/lib/schemas'; //
import ProjectDashboard from '@/components/ProjectDashboard';
import { DateRangeOption } from '@/components/DateRangeSelector'; //
import { ArrowRepeat } from 'react-bootstrap-icons';

// Ladekomponente für Suspense (verhindert Layout Shift)
function DashboardLoading() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <ArrowRepeat className="animate-spin text-indigo-600" size={40} />
        <p className="text-gray-500 font-medium">Das Dashboard wird vorbereitet...</p>
      </div>
    </div>
  );
}

// Diese Funktion lädt die Daten direkt auf dem Server
async function loadData(projectId: string, dateRange: string) {
  // 1. Projekt-Infos laden (wie in /api/projects/[id])
  const { rows } = await sql`
    SELECT
      id::text as id, email, role, domain,
      gsc_site_url, ga4_property_id,
      semrush_project_id, semrush_tracking_id, semrush_tracking_id_02,
      favicon_url, project_timeline_active, project_start_date, project_duration_months
    FROM users
    WHERE id::text = ${projectId}
  `;

  if (rows.length === 0) return null;
  
  const projectUser = rows[0] as unknown as User;

  // 2. Google Daten laden (Server-Funktion statt API-Call)
  const dashboardData = await getOrFetchGoogleData(projectUser, dateRange);
  
  return { projectUser, dashboardData };
}

// Die Hauptkomponente ist jetzt ASYNC (Server Component)
export default async function ProjectPage({ 
  params, 
  searchParams 
}: { 
  params: { id: string }, 
  searchParams: { dateRange?: string } 
}) {
  const session = await auth(); //

  if (!session?.user) {
    redirect('/login');
  }

  const projectId = params.id;
  // Datum aus URL lesen oder Default '30d' nutzen
  const dateRange = (searchParams.dateRange as DateRangeOption) || '30d';

  // Berechtigungsprüfung (vereinfacht, analog zu Ihrer API)
  if (session.user.role === 'BENUTZER' && session.user.id !== projectId) {
    redirect('/');
  }

  // Datenabruf auf dem Server
  const data = await loadData(projectId, dateRange);

  if (!data || !data.dashboardData) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Projekt nicht gefunden oder keine Daten verfügbar.</p>
      </div>
    );
  }

  const { projectUser, dashboardData } = data;

  return (
    <Suspense fallback={<DashboardLoading />}>
      <ProjectDashboard
        data={dashboardData}
        isLoading={false} // Daten sind bereits da!
        dateRange={dateRange}
        // Wir übergeben eine leere Funktion oder passen die Komponente an, 
        // da die Navigation jetzt über URL-Parameter läuft (siehe Schritt 2)
        onDateRangeChange={() => {}} 
        onPdfExport={() => {}} // Client-Funktion muss in ProjectDashboard bleiben
        projectId={projectUser.id}
        domain={projectUser.domain || ''}
        faviconUrl={projectUser.favicon_url}
        semrushTrackingId={projectUser.semrush_tracking_id}
        semrushTrackingId02={projectUser.semrush_tracking_id_02}
        projectTimelineActive={projectUser.project_timeline_active ?? undefined}
        countryData={dashboardData.countryData}
        channelData={dashboardData.channelData}
        deviceData={dashboardData.deviceData}
      />
    </Suspense>
  );
}
