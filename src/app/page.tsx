// src/app/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getProjectsForDashboard } from '@/services/projectService';
import ProjectsClientView from '@/components/ProjectsClientView';

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role === 'BENUTZER') {
    if (session.user.id) {
      redirect(`/projekt/${session.user.id}`);
    } else {
      redirect('/login');
    }
  }

  // Typensicherer Aufruf - gibt Promise<ProjectStats[]> zurück
  const projects = await getProjectsForDashboard(session.user);

  return <ProjectsClientView initialProjects={projects} />; // ❌ Kein 'as any' mehr!
}
