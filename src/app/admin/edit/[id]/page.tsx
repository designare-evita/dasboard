// src/app/admin/edit/[id]/page.tsx

import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { User } from '@/types';
import EditUserForm from './EditUserForm';
import LandingpageManager from './LandingpageManager';
import ProjectAssignmentManager from './ProjectAssignmentManager';

// Typ-Definition für Next.js 15+
type PageProps = {
  params: Promise<{ id: string }>;
};

interface Project {
  id: string;
  name: string;
}

interface UserWithAssignments extends User {
  assigned_projects: { project_id: string }[];
}

async function getUserData(id: string): Promise<UserWithAssignments | null> {
  try {
    console.log('[getUserData] Starte Abfrage für ID:', id);
    console.log('[getUserData] ID-Typ:', typeof id);
    console.log('[getUserData] ID-Länge:', id.length);
    
    // ✅ Prüfe zuerst, ob überhaupt Benutzer existieren
    const { rows: allUsers } = await sql`SELECT id, email FROM users LIMIT 10;`;
    console.log('[getUserData] Verfügbare Benutzer in DB:', allUsers);
    
    // ✅ Jetzt die spezifische Abfrage
    const { rows: users } = await sql`
      SELECT 
        id::text,
        email, 
        role, 
        domain, 
        gsc_site_url, 
        ga4_property_id,
        "createdByAdminId"::text,
        created_at
      FROM users 
      WHERE id::text = ${id}`;
    
    console.log('[getUserData] Query-Ergebnis:', users);
    
    if (users.length === 0) {
      console.error('[getUserData] KEIN Benutzer gefunden für ID:', id);
      return null;
    }
    
    const user = users[0] as User;
    console.log('[getUserData] ✅ Benutzer gefunden:', user.email, 'Rolle:', user.role);
    
    // Hole die Projektzuweisungen
    const { rows: assigned_projects } = await sql<{ project_id: string }>`
      SELECT project_id::text as project_id 
      FROM project_assignments 
      WHERE user_id::text = ${id};`;
    
    console.log('[getUserData] Projektzuweisungen:', assigned_projects.length);
    
    return { ...user, assigned_projects };
  } catch (error) {
    console.error('[getUserData] ❌ FEHLER beim Laden:', error);
    if (error instanceof Error) {
      console.error('[getUserData] Fehlermeldung:', error.message);
      console.error('[getUserData] Stack:', error.stack);
    }
    return null;
  }
}

async function getAllProjects(): Promise<Project[]> {
  try {
    const { rows } = await sql<{ id: string; email: string; domain: string | null }>`
      SELECT id::text as id, email, domain 
      FROM users 
      WHERE role = 'BENUTZER' 
      ORDER BY email ASC;`;
    
    console.log('[getAllProjects] Projekte gefunden:', rows.length);
    return rows.map(p => ({ ...p, name: p.domain || p.email }));
  } catch (error) {
    console.error('[getAllProjects] Fehler:', error);
    return [];
  }
}

export default async function EditUserPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  
  console.log('========================================');
  console.log('[EditUserPage] 🔐 Session User:', session?.user?.email);
  console.log('[EditUserPage] 🔐 Session Role:', session?.user?.role);
  
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    console.warn('[EditUserPage] ❌ Nicht autorisiert - Redirect');
    redirect('/');
  }

  const resolvedParams = await params;
  const { id } = resolvedParams;
  
  console.log('[EditUserPage] 📋 Params Object:', resolvedParams);
  console.log('[EditUserPage] 🆔 Benutzer-ID aus URL:', id);
  console.log('[EditUserPage] 🆔 ID-Typ:', typeof id);
  console.log('[EditUserPage] 🆔 ID-Länge:', id?.length);
  console.log('========================================');

  // ✅ Validierung der ID
  if (!id || typeof id !== 'string' || id.length < 10) {
    console.error('[EditUserPage] ❌ Ungültige ID:', id);
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="p-8 text-center bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
          <h2 className="text-xl font-bold text-red-600 mb-4">Ungültige Benutzer-ID</h2>
          <p className="text-gray-600">Die übergebene ID ist ungültig: <code className="bg-red-100 px-2 py-1 rounded">{id || 'undefined'}</code></p>
          <a 
            href="/admin" 
            className="mt-6 inline-block bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
          >
            Zurück zur Admin-Übersicht
          </a>
        </div>
      </div>
    );
  }

  const [user, allProjects] = await Promise.all([
    getUserData(id),
    getAllProjects()
  ]);

  if (!user) {
    console.error('[EditUserPage] ❌ Benutzer konnte nicht geladen werden');
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="p-8 text-center bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
          <h2 className="text-xl font-bold text-red-600 mb-4">Benutzer nicht gefunden</h2>
          <p className="text-gray-600 mb-2">Der Benutzer mit der ID konnte nicht geladen werden.</p>
          <code className="bg-gray-100 px-3 py-2 rounded block mb-4 text-sm break-all">{id}</code>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4 text-left">
            <p className="font-semibold text-yellow-800 mb-2">🔍 Debugging-Informationen:</p>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Überprüfe die Browser-Konsole für detaillierte Logs</li>
              <li>• Überprüfe die Vercel-Logs für Server-Fehler</li>
              <li>• ID-Format: UUID mit 36 Zeichen erwartet</li>
              <li>• Aktuelle ID-Länge: {id.length} Zeichen</li>
            </ul>
          </div>

          <div className="space-x-4">
            <a 
              href="/admin" 
              className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
            >
              Zurück zur Admin-Übersicht
            </a>
            <a 
              href="/api/debug-users" 
              target="_blank"
              className="inline-block bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
            >
              Benutzer-IDs prüfen
            </a>
          </div>
        </div>
      </div>
    );
  }
  
  console.log('[EditUserPage] ✅ Benutzer erfolgreich geladen:', user.email);
  console.log('========================================');
  
  const currentUserIsSuperAdmin = session.user.role === 'SUPERADMIN';
  const userBeingEditedIsAdmin = user.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Benutzer <span className="text-indigo-600">{user.email}</span> bearbeiten
            </h2>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {user.role}
            </span>
          </div>
          <EditUserForm id={id} user={user} />
        </div>
        
        {user.role === 'BENUTZER' && (
          <LandingpageManager userId={id} />
        )}

        {currentUserIsSuperAdmin && userBeingEditedIsAdmin && (
          <ProjectAssignmentManager user={user} allProjects={allProjects} />
        )}
      </div>
    </div>
  );
}
