
// src/app/admin/edit/[id]/page.tsx

import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { User } from '@/types';
import EditUserForm from './EditUserForm';
import LandingpageManager from './LandingpageManager';
import ProjectAssignmentManager from './ProjectAssignmentManager';
// KORRIGIERTER IMPORT: Importiere die neue UserLogbook Komponente
import UserLogbook from '@/components/UserLogbook'; 

type PageProps = {
  params: Promise<{ id: string }>;
};

// --- (Interfaces und Datenladefunktionen bleiben gleich) ---
interface Project {
  id: string;
  name: string;
}

interface UserWithAssignments extends User {
  assigned_projects: { project_id: string }[];
}

async function getUserData(id: string): Promise<UserWithAssignments | null> {
  try {
    console.log('[getUserData] 🔍 Suche Benutzer mit ID:', id);
    const { rows: users } = await sql`
      SELECT
        id::text as id,
        email,
        role,
        COALESCE(domain, '') as domain,
        COALESCE(gsc_site_url, '') as gsc_site_url,
        COALESCE(ga4_property_id, '') as ga4_property_id,
        COALESCE(semrush_project_id, '') as semrush_project_id,
        COALESCE(semrush_tracking_id, '') as semrush_tracking_id,
        COALESCE(semrush_tracking_id_02, '') as semrush_tracking_id_02
      FROM users
      WHERE id::text = ${id}`;
      
    if (users.length === 0) {
      console.error('[getUserData] ❌ Benutzer nicht gefunden!');
      return null;
    }
    const user = users[0] as User;
    let assigned_projects: { project_id: string }[] = [];
    try {
      const { rows } = await sql<{ project_id: string }>`
        SELECT project_id::text as project_id
        FROM project_assignments
        WHERE user_id::text = ${id};`;
      assigned_projects = rows;
    } catch (paError) {
      console.warn('[getUserData] ⚠️ Projektzuweisungen konnten nicht geladen werden:', paError);
    }
    return { ...user, assigned_projects };
  } catch (error) {
    console.error('[getUserData] ❌ FEHLER:', error);
    throw error;
  }
}

async function getAllProjects(): Promise<Project[]> {
  try {
    const { rows } = await sql<{ id: string; email: string; domain: string | null }>`
      SELECT
        id::text as id,
        email,
        COALESCE(domain, email) as domain
      FROM users
      WHERE role = 'BENUTZER'
      ORDER BY email ASC;`;
    return rows.map(p => ({
      id: p.id,
      name: p.domain || p.email
    }));
  } catch (error) {
    console.error('[getAllProjects] ❌ Fehler:', error);
    return [];
  }
}

// --- Hauptkomponente der Seite ---

export default async function EditUserPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  const resolvedParams = await params;
  const { id } = resolvedParams;

  // --- ID-Validierung (unverändert) ---
  if (!id || typeof id !== 'string' || id.length !== 36) {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="p-8 text-center bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
                <h2 className="text-xl font-bold text-red-600 mb-4">❌ Ungültige ID</h2>
                <p className="text-gray-600">Die ID hat nicht das erwartete UUID-Format.</p>
                <code className="block bg-gray-100 p-2 mt-2 rounded">{id}</code>
                <a href="/admin" className="mt-4 inline-block bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700">
                    Zurück zur Übersicht
                </a>
            </div>
        </div>
    );
  }

  let user: UserWithAssignments | null = null;
  let allProjects: Project[] = [];
  let loadError: string | null = null;

  try {
    [user, allProjects] = await Promise.all([
      getUserData(id),
      getAllProjects()
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unbekannter Fehler';
  }

  // --- Fehlerbehandlung beim Laden (unverändert) ---
  if (!user || loadError) {
     return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="p-8 bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
                <h2 className="text-xl font-bold text-red-600 mb-4">Benutzer nicht gefunden</h2>
                <p>Der Benutzer mit der ID konnte nicht geladen werden.</p>
                 <div className="space-y-4 mt-6">
                    <div className="bg-gray-100 p-4 rounded">
                        <p className="font-semibold mb-2">Gesuchte ID:</p>
                        <code className="text-xs break-all block">{id}</code>
                    </div>
                    {loadError && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded">
                            <p className="font-semibold text-red-800 mb-2">Fehlerdetails:</p>
                            <p className="text-sm text-red-700">{loadError}</p>
                        </div>
                    )}
                     <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                        <p className="font-semibold text-yellow-800 mb-2">🔧 Mögliche Lösungen:</p>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-700">
                           <li>Stelle sicher, dass die ID korrekt ist.</li>
                           <li>Prüfe die Vercel Function Logs für detaillierte Fehlermeldungen.</li>
                           <li>Stelle sicher, dass die Postgres-Datenbank erreichbar ist.</li>
                        </ol>
                    </div>
                    <div className="flex gap-4 justify-center mt-6">
                        <a href="/admin" className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700">Zurück zur Übersicht</a>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  const currentUserIsSuperAdmin = session.user.role === 'SUPERADMIN';
  const userBeingEditedIsAdmin = user.role === 'ADMIN';

  // --- Seiten-Rendering mit Logbuch ---
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Benutzerdetails bearbeiten */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Benutzer <span className="text-indigo-600">{user.email}</span> bearbeiten
            </h2>
            <div className="flex gap-2 items-center">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {user.role}
              </span>
            </div>
          </div>
         <EditUserForm user={user} />
        </div>

        {/* Landingpage Manager UND Logbuch (Nur für Kunden) */}
        {user.role === 'BENUTZER' && (
          <>
            <LandingpageManager userId={id} />
            
            {/* KORRIGIERTE KOMPONENTE: Verwende UserLogbook mit der userId */}
            <UserLogbook userId={id} />
          </>
        )}

        {/* Projektzuweisungen (Nur für Superadmin, wenn ein Admin bearbeitet wird) */}
        {currentUserIsSuperAdmin && userBeingEditedIsAdmin && (
          <ProjectAssignmentManager user={user} allProjects={allProjects} />
        )}
      </div>
    </div>
  );
}
