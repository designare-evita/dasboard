// src/app/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getProjectsForDashboard } from '@/services/projectService';
import ProjectsClientView from '@/components/ProjectsClientView';

// Diese Komponente ist jetzt async -> Server Component
export default async function ProjectsPage() {
  const session = await auth();

  // 1. Auth Prüfung serverseitig
  if (!session?.user) {
    redirect('/login');
  }

  // 2. Rollen Prüfung & Weiterleitung
  if (session.user.role === 'BENUTZER') {
    if (session.user.id) {
      redirect(`/projekt/${session.user.id}`);
    } else {
      // Fallback, sollte nicht passieren
      redirect('/login');
    }
  }

  // 3. Daten laden (direkt aus der DB, ohne Fetch-API-Umweg)
  const projects = await getProjectsForDashboard(session.user);

  // 4. View rendern
  return <ProjectsClientView initialProjects={projects as any} />;
}
