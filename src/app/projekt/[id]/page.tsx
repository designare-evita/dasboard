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
  // 1. Hole User-Daten + Admin Infos
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
      admins.email as assigned_admins,
      creators.email as creator_email
    FROM users u
    LEFT JOIN project_assignments pa ON u.id = pa.project_id
    LEFT JOIN users admins ON pa.user_id = admins.id
    LEFT JOIN users creators ON u.created_by = creators.id
    WHERE u.id = ${projectId}
    LIMIT 1;
  `;

  if (rows.length === 0) return null;
  const projectUser = rows[0] as ExtendedUser;

  // 2. Hole Google Daten (Server-Side Cache / API)
  const dashboardData = await getOrFetchGoogleData(
    projectId, 
    projectUser.gsc_site_url || '', 
    projectUser.ga4_property_id || '', 
    dateRange
  );

  return { projectUser, dashboardData };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}) {
  const session = await auth();
  
  if (!session || !session.user) {
    redirect('/login');
  }

  // ID aus Params extrahieren
  const projectId = params.id;
  
  // DateRange aus URL oder Default '30d'
  const dateRange = (searchParams.from as DateRangeOption) || '30d';

  // Sicherheitscheck: Benutzer darf nur sein eigenes Projekt sehen
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

  // Konfiguration für Semrush berechnen
  const hasSemrushConfig = !!projectUser.semrush_tracking_id || !!projectUser.semrush_tracking_id_02;
  const hasKampagne1Config = !!projectUser.semrush_tracking_id;
  const hasKampagne2Config = !!projectUser.semrush_tracking_id_02;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ProjectDashboard
        data={dashboardData}
        isLoading={false}
        dateRange={dateRange}
        projectId={projectUser.id}
        domain={projectUser.domain || ''}
        faviconUrl={projectUser.favicon_url}
        
        // Config Flags statt roher IDs
        hasSemrushConfig={hasSemrushConfig}
        hasKampagne1Config={hasKampagne1Config}
        hasKampagne2Config={hasKampagne2Config}
        
        // Optionale Felder
        userRole={session.user.role}
        safeApiErrors={dashboardData.safeApiErrors} // Fehlerzustände weiterreichen
      />
    </Suspense>
  );
}
