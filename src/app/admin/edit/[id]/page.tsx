// src/app/admin/edit/[id]/page.tsx
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { User } from '@/types';
import EditUserForm from './EditUserForm';
import LandingpageManager from './LandingpageManager';
import ProjectAssignmentManager from './ProjectAssignmentManager';
import UserLogbook from '@/components/UserLogbook'; 

type PageProps = {
  params: Promise<{ id: string }>;
};

// --- (Interfaces) ---

// Projekt-Interface (Kunde)
interface Project {
  id: string;
  name: string;
  mandant_id: string | null;
}

// Admin-Interface (Der Benutzer, der bearbeitet wird)
interface UserWithAssignments extends User {
  assigned_projects: { project_id: string }[];
}

// Lädt den Admin UND seine Zuweisungen
async function getUserData(id: string): Promise<UserWithAssignments | null> {
  try {
    console.log('[getUserData] 🔍 Suche Benutzer mit ID:', id);
    // 1. Benutzerdaten laden (inkl. mandant_id, permissions)
    const { rows: users } = await sql`
      SELECT
        id::text as id,
        email,
        role,
        mandant_id,
        permissions,
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
    
    // 2. Projekt-Zuweisungen (Ausnahmen) laden
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

// Lädt ALLE Projekte (Kunden)
async function getAllProjects(): Promise<Project[]> {
  try {
    const { rows } = await sql<{ id: string; email: string; domain: string | null; mandant_id: string | null }>`
      SELECT
        id::text as id,
        email,
        COALESCE(domain, email) as domain,
        mandant_id
      FROM users
      WHERE role = 'BENUTZER'
      ORDER BY mandant_id ASC, email ASC;`;
    return rows.map(p => ({
      id: p.id,
      name: p.domain || p.email,
      mandant_id: p.mandant_id
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

  // --- ID-Validierung ---
  if (!id || typeof id !== 'string' || id.length !== 36) {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="p-8 text-center bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
                <h2 className="text-xl font-bold text-red-600 mb-4">❌ Ungültige ID</h2>
                <p className="text-gray-600 mb-4">Die angegebene Benutzer-ID hat ein ungültiges Format.</p>
                <p className="text-sm text-gray-500 font-mono bg-gray-50 p-3 rounded mb-4">
                  ID: {id}
                </p>
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

  // --- Fehlerbehandlung beim Laden ---
  if (!user || loadError) {
     return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="p-8 bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
                <h2 className="text-xl font-bold text-red-600 mb-4">Benutzer nicht gefunden</h2>
                <p className="text-gray-600 mb-4">
                  {loadError || 'Der angeforderte Benutzer konnte nicht geladen werden.'}
                </p>
                <p className="text-sm text-gray-500">ID: {id}</p>
            </div>
        </div>
    );
  }

  // BERECHTIGUNGSPRÜFUNG (Wer darf Zuweisungen sehen?)
  const currentUserIsSuperAdmin = session.user.role === 'SUPERADMIN';
  const currentUserIsKlasse1 = session.user.permissions?.includes('kann_admins_verwalten');
  const canManageAssignments = currentUserIsSuperAdmin || currentUserIsKlasse1;
  
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
              {user.mandant_id && (
                <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-medium">
                  {user.mandant_id}
                </span>
              )}
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {user.role}
              </span>
            </div>
          </div>
         {/* ✅ KORREKTUR: onUserUpdated Prop entfernt */}
         <EditUserForm user={user} />
        </div>

        {/* Landingpage Manager UND Logbuch (Nur für Kunden) */}
        {user.role === 'BENUTZER' && (
          <>
            <LandingpageManager userId={id} />
            <UserLogbook userId={id} />
          </>
        )}

        {/* Projektzuweisungen (Nur für Superadmin ODER Klasse 1 Admins, wenn ein Admin bearbeitet wird) */}
        {canManageAssignments && userBeingEditedIsAdmin && (
          <ProjectAssignmentManager user={user} allProjects={allProjects} />
        )}
      </div>
    </div>
