// src/app/admin/edit/[id]/page.tsx

import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { User } from '@/types';
import EditUserForm from './EditUserForm';
import LandingpageManager from './LandingpageManager';
import ProjectAssignmentManager from './ProjectAssignmentManager';

// Korrekter Typ für die Seiten-Parameter
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

// Lädt den zu bearbeitenden Benutzer UND seine Zuweisungen
async function getUserData(id: string): Promise<UserWithAssignments | null> {
  try {
    const { rows: users } = await sql<User>`
      SELECT id, email, role, domain, gsc_site_url, ga4_property_id 
      FROM users 
      WHERE id = ${id}`;
    
    if (users.length === 0) return null;
    
    const user = users[0];

    // Korrekte Typ-Zuweisung für die Datenbankabfrage
    const { rows: assigned_projects } = await sql<{ project_id: string }>`
      SELECT project_id FROM project_assignments WHERE user_id = ${id};
    `;
    
    return { ...user, assigned_projects };
  } catch (error) {
    console.error('Fehler beim Laden der Benutzerdaten:', error);
    return null;
  }
}

// Lädt alle "Projekte" (also alle Benutzer mit der Rolle 'BENUTZER')
async function getAllProjects(): Promise<Project[]> {
  try {
    const { rows } = await sql`
      SELECT id, email, domain 
      FROM users 
      WHERE role = 'BENUTZER' 
      ORDER BY email ASC;`;
    return rows.map(p => ({ ...p, name: p.domain || p.email }));
  } catch (error) {
    console.error('Fehler beim Laden aller Projekte:', error);
    return [];
  }
}

export default async function EditUserPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    redirect('/');
  }

  const [user, allProjects] = await Promise.all([
    getUserData(params.id),
    getAllProjects()
  ]);

  if (!user) {
    return (
        <div className="p-8 text-center bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-10">
            <h2 className="text-xl font-bold text-red-600">Benutzer nicht gefunden</h2>
        </div>
    );
  }
  
  const currentUserIsSuperAdmin = session.user.role === 'SUPERADMIN';
  const userBeingEditedIsAdmin = user.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-6">
            Benutzer <span className="text-indigo-600">{user.email}</span> bearbeiten
          </h2>
          <EditUserForm id={params.id} user={user} />
        </div>
        
        {user.role === 'BENUTZER' && (
          <LandingpageManager userId={params.id} />
        )}

        {currentUserIsSuperAdmin && userBeingEditedIsAdmin && (
          <ProjectAssignmentManager user={user} allProjects={allProjects} />
        )}
      </div>
    </div>
  );
}
