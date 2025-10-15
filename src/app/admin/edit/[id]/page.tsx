// src/app/admin/edit/[id]/page.tsx

import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { User } from '@/types'; // Annahme, dass der User-Typ hier definiert ist
import EditUserForm from './EditUserForm';
import LandingpageManager from './LandingpageManager';
import ProjectAssignmentManager from './ProjectAssignmentManager'; // NEUER Import

// Typen, die wir für diese Seite benötigen
type PageProps = {
  params: { id: string };
};

interface Project {
  id: string;
  name: string;
}

interface UserWithAssignments extends User {
  assigned_projects: { project_id: string }[];
}

// Funktion zum Laden des Benutzers und seiner Projektzuweisungen
async function getUserData(id: string): Promise<UserWithAssignments | null> {
  try {
    const { rows: users } = await sql<User>`
      SELECT id, email, role, domain, gsc_site_url, ga4_property_id 
      FROM users 
      WHERE id = ${id}
    `;
    
    if (users.length === 0) {
      return null;
    }
    
    const user = users[0];

    // Lade die Projektzuweisungen für diesen Benutzer
    const { rows: assigned_projects } = await sql`
      SELECT project_id FROM project_assignments WHERE user_id = ${id};
    `;
    
    // Kombiniere die Daten und gib sie zurück
    return { ...user, assigned_projects };
    
  } catch (error) {
    console.error('Fehler beim Laden der Benutzerdaten:', error);
    return null;
  }
}

// Funktion zum Laden aller Projekte
async function getAllProjects(): Promise<Project[]> {
  try {
    const { rows } = await sql<Project>`SELECT id, name FROM projects ORDER BY name ASC;`;
    return rows;
  } catch (error) {
    console.error('Fehler beim Laden aller Projekte:', error);
    return []; // Im Fehlerfall ein leeres Array zurückgeben
  }
}

export default async function EditUserPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  
  // Berechtigungsprüfung: Nur Admins und Superadmins dürfen diese Seite sehen
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  // Lade alle notwendigen Daten parallel
  const [user, allProjects] = await Promise.all([
    getUserData(params.id),
    getAllProjects()
  ]);

  if (!user) {
    return (
        <div className="p-8 text-center bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
            <h2 className="text-xl font-bold text-red-600">Benutzer nicht gefunden</h2>
            <a href="/admin" className="mt-4 inline-block bg-blue-600 text-white py-2 px-4 rounded-md">
                Zurück zur Übersicht
            </a>
        </div>
    );
  }
  
  const currentUserIsSuperAdmin = session.user.role === 'SUPERADMIN';
  const userBeingEditedIsAdmin = user.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <main className="mt-6 space-y-8">
          
          {/* Formular zum Bearbeiten der Benutzerdaten */}
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6">
              Benutzer <span className="text-indigo-600">{user.email}</span> bearbeiten
            </h2>
            {/* Wichtig: Wir übergeben das komplette user-Objekt, aber EditUserForm sollte nur die benötigten Felder verwenden */}
            <EditUserForm id={params.id} user={user} />
          </div>
          
          {/* Landingpage Manager (für BENUTZER-Rolle) */}
          {user.role === 'BENUTZER' && (
            <LandingpageManager userId={params.id} />
          )}

          {/* NEU: Projektzuweisungs-Manager */}
          {/* Wird nur angezeigt, wenn ein SUPERADMIN einen ADMIN bearbeitet */}
          {currentUserIsSuperAdmin && userBeingEditedIsAdmin && (
            <ProjectAssignmentManager user={user} allProjects={allProjects} />
          )}

        </main>
      </div>
    </div>
  );
}
