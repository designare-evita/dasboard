// src/app/page.tsx

import { getServerSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { User } from '@/types';
import { ArrowRepeat, ExclamationTriangleFill, ArrowRightSquare } from 'react-bootstrap-icons';
import { ProjectDashboardData, DateRangeOption } from '@/lib/dashboard-shared';
import ProjectDashboard from '@/components/ProjectDashboard';
import LandingpageApproval from '@/components/LandingpageApproval';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { Suspense } from 'react';
import { Session } from 'next-auth';

// Importiere unsere Caching-Funktion
import { getOrFetchGoogleData } from '@/lib/google-data-loader';

function DashboardLoading() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <ArrowRepeat className="animate-spin text-indigo-600" size={40} />
    </div>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-8">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-lg text-center border border-red-200">
        <ExclamationTriangleFill className="text-red-500 mx-auto mb-4" size={40} />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Fehler beim Laden</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

/**
 * AdminDashboard (Server Component)
 * Lädt die Projektliste für Admins
 */
async function AdminDashboard({ session }: { session: Session }) {
  let projects: User[] = [];
  try {
    if (session.user.role === 'SUPERADMIN') {
      const { rows } = await sql<User>`
        SELECT id::text AS id, email, domain
        FROM users WHERE role = 'BENUTZER' ORDER BY email ASC;
      `;
      projects = rows;
    } else if (session.user.role === 'ADMIN') {
      const { rows } = await sql<User>`
        SELECT u.id::text AS id, u.email, u.domain
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${session.user.id} AND u.role = 'BENUTZER'
        ORDER BY u.email ASC;
      `;
      projects = rows;
    }
  } catch (e) {
    return <DashboardError message={e instanceof Error ? e.message : 'Fehler beim Laden der Projekte'} />;
  }
  
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Alle Projekte</h1>
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
      </div>
    </div>
  );
}

/**
 * CustomerDashboard (Server Component)
 * Lädt die Daten für den eingeloggten Kunden
 */
async function CustomerDashboard({ session, dateRange }: { session: Session; dateRange: DateRangeOption }) {
  const userId = session.user.id;
  
  // 1. Lade Benutzerdaten (Domain, Semrush IDs)
  let userData: User | null = null;
  try {
    const { rows } = await sql<User>`
      SELECT id, email, domain, gsc_site_url, ga4_property_id, semrush_tracking_id_02 
      FROM users 
      WHERE id::text = ${userId}
    `;
    if (rows.length > 0) {
      userData = rows[0];
    }
  } catch (e) {
    return <DashboardError message={e instanceof Error ? e.message : 'Fehler beim Laden der Benutzerdaten'} />;
  }

  if (!userData) {
    return <DashboardError message="Benutzerprofil nicht gefunden." />;
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

  // 3. Rendere die Client-Komponenten mit den geladenen Daten
  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <main>
        <ProjectDashboard
          initialData={googleData}
          isLoading={false}
          dateRange={dateRange}
          projectId={userId}
          domain={userData?.domain}
          semrushTrackingId02={userData?.semrush_tracking_id_02}
        />
        <div className="mt-8">
          <LandingpageApproval />
        </div>
      </main>
    </div>
  );
}


/**
 * Die Hauptseite (page.tsx) ist 'async' und entscheidet,
 * welches Dashboard (Admin oder Kunde) geladen wird.
 */
export default async function HomePage({
  searchParams
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const dateRange = (searchParams?.dateRange || '30d') as DateRangeOption;
  const userRole = session.user.role;

  // Ladezustand wird jetzt von Suspense auf Ebene der Kind-Komponenten gehandhabt
  if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
    return (
      <Suspense fallback={<DashboardLoading />}>
        <AdminDashboard session={session} />
      </Suspense>
    );
  }

  if (userRole === 'BENUTZER') {
    return (
      <Suspense fallback={<DashboardLoading />}>
        <CustomerDashboard session={session} dateRange={dateRange} />
      </Suspense>
    );
  }

  return <DashboardError message="Unbekannte Benutzerrolle." />;
}
