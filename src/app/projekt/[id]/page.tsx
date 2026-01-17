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
  data_max_enabled?: boolean; // NEU: Feld aus DB
}

async function loadData(projectId: string, dateRange: string) {
  try {
    // Komplexe Query mit JOINs für Admin-Daten und NEU: data_max_enabled
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
        u.data_max_enabled, 
        
        -- E-Mail des Erstellers holen
        creator.email as creator_email,
        
        -- Zugeordnete Admins holen (als String Liste)
        (
          SELECT string_agg(a.email, ', ')
          FROM project_assignments pa
          JOIN users a ON pa.user_id = a.id
          WHERE pa.project_id = u.id
        ) as assigned_admins

      FROM users u
      LEFT JOIN users creator ON u."createdByAdminId" = creator.id
      WHERE u.id = ${projectId}::uuid
    `;

    if (rows.length === 0) return null;

    const projectUser = rows[0] as ExtendedUser;
    
    // ✅ KORREKTUR: User-Objekt als ersten Parameter übergeben
    const dashboardData = await getOrFetchGoogleData(projectUser, dateRange);

    return { projectUser, dashboardData };
  } catch (e) {
    console.error('Error loading project data:', e);
    return null;
  }
}

export default async function ProjectPage({ 
  params, 
  searchParams 
}: { 
  params: { id: string },
  searchParams: { range?: string }
}) {
  const projectId = params.id;
  // Fallback auf 30 Tage wenn nichts gewählt
  const dateRange = (searchParams.range as DateRangeOption) || '30d';

  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Sicherheitscheck: User darf nur sein eigenes Projekt sehen (oder Admins)
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

  // LOGIK: Ermittle die richtige Betreuer-E-Mail
  const supportEmail = projectUser.assigned_admins || projectUser.creator_email || '';
  
  // ✅ Sichere Konvertierung zu Boolean
  const timelineActive = projectUser.project_timeline_active === true;

  // ✅ NEU: DataMax Berechtigung prüfen (Default = true, falls null)
  const isDataMaxEnabled = projectUser.data_max_enabled !== false;

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
        projectTimelineActive={timelineActive}
        countryData={dashboardData.countryData}
        channelData={dashboardData.channelData}
        deviceData={dashboardData.deviceData}
        userRole={session.user.role}
        userEmail={supportEmail}
        showLandingPages={projectUser.settings_show_landingpages !== false}
        dataMaxEnabled={isDataMaxEnabled} // <-- Neue Prop
      />
    </Suspense>
  );
}
