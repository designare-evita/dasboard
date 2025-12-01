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

async function loadData(projectId: string, dateRange: string) {
  const { rows } = await sql`
    SELECT
      id::text as id, email, role, domain,
      gsc_site_url, ga4_property_id,
      semrush_project_id, semrush_tracking_id, semrush_tracking_id_02,
      favicon_url, project_timeline_active, project_start_date, project_duration_months,
      settings_show_landingpages
    FROM users
    WHERE id::text = ${projectId}
  `;

  if (rows.length === 0) return null;

  const projectUser = rows[0] as unknown as User;
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

  if (!data || !data.dashboardData) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Projekt nicht gefunden oder keine Daten verfügbar.</p>
      </div>
    );
  }

  const { projectUser, dashboardData } = data;

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
        projectTimelineActive={projectUser.project_timeline_active ?? undefined}
        countryData={dashboardData.countryData}
        channelData={dashboardData.channelData}
        deviceData={dashboardData.deviceData}
        
        // ✅ NEU: E-Mail & Rolle übergeben
        userRole={session.user.role}
        userEmail={projectUser.email} 
        showLandingPagesToCustomer={projectUser.settings_show_landingpages ?? false}
      />
    </Suspense>
  );
}
