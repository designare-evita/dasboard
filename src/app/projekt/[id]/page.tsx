// src/app/projekt/[id]/page.tsx

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { sql } from '@vercel/postgres';
import { User } from '@/lib/schemas';
import ProjectDashboard from '@/components/ProjectDashboard';
import { DateRangeOption } from '@/components/DateRangeSelector';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';

// Erweiterter Typ für unsere Query-Ergebnisse
interface ExtendedUser extends User {
  assigned_admins?: string;
  creator_email?: string;
}

async function loadData(projectId: string, dateRange: string) {
  // Komplexe Query mit JOINs für Admin-Daten
  const { rows } = await sql`
    SELECT
      u.id::text as id, 
      u.email, 
      u.role, 
      u.domain,
      u.gsc_site_url, 
      u.ga4_property_id,
      u.semrush_project_id, 
      u.semrush_tracking_id, 
      u.semrush_tracking_id_02,
      u.favicon_url, 
      u.project_timeline_active, 
      u.project_start_date, 
      u.project_duration_months,
      u.settings_show_landingpages,
      
      -- E-Mail des Erstellers holen
      creator.email as creator_email,
      
      -- Alle zugewiesenen Admins als String zusammenfassen (Komma getrennt)
      (
        SELECT STRING_AGG(DISTINCT admins.email, ', ')
        FROM project_assignments pa_sub
        JOIN users admins ON pa_sub.user_id = admins.id
        WHERE pa_sub.project_id = u.id
      ) as assigned_admins

    FROM users u
    LEFT JOIN users creator ON u."createdByAdminId" = creator.id
    WHERE u.id::text = ${projectId}
  `;

  if (rows.length === 0) return null;

  // Typensicherer Cast
  const projectUser = rows[0] as unknown as ExtendedUser;
  
  // Daten von Google laden
  const dashboardData = await getOrFetchGoogleData(projectUser, dateRange);

  return { projectUser, dashboardData };
}

export default async function ProjectPage({
  params,
  searchParams
}: {
  params: { id: string },
  searchParams: { dateRange?: string }
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const projectId = params.id;
  const dateRange = (searchParams.dateRange as DateRangeOption) || '30d';

  if (session.user.role === 'BENUTZER' && session.user.id !== projectId) {
    redirect('/');
  }

  const data = await loadData(projectId, dateRange);

  // ✅ DEBUG LOG
  console.log('[Debug] project_timeline_active:', data?.projectUser?.project_timeline_active, typeof data?.projectUser?.project_timeline_active);

  if (!data || !data.dashboardData) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Projekt nicht gefunden oder keine Daten verfügbar.</p>
      </div>
    );
  }

  const { projectUser, dashboardData } = data;

  // LOGIK: Ermittle die richtige Betreuer-E-Mail
  const supportEmail = projectUser.assigned_admins || projectUser.creator_email || '';

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ProjectDashboard
        data={dashboardData}
        isLoading={false}
        dateRange={dateRange}
        projectId={projectUser.id}
        domain={projectUser.domain || ''}
        faviconUrl={projectUser.favicon_url}
        semrushTrackingId={projectUser.semrush_tracking_id}
        semrushTrackingId02={projectUser.semrush_tracking_id_02}
        projectTimelineActive={Boolean(projectUser.project_timeline_active)}
        countryData={dashboardData.countryData}
        channelData={dashboardData.channelData}
        deviceData={dashboardData.deviceData}
        userRole={session.user.role}
        userEmail={supportEmail}
        showLandingPagesToCustomer={projectUser.settings_show_landingpages ?? false}
      />
    </Suspense>
  );
}
