// src/app/admin/edit/[id]/ProjectAssignmentManager.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Typen aus deiner App importieren (ggf. anpassen)
interface Project {
  id: string;
  name: string;
}

interface User {
  id: string;
  assigned_projects: { project_id: string }[];
}

interface Props {
  user: User;
  allProjects: Project[];
}

export default function ProjectAssignmentManager({ user, allProjects }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Finden, welche Projekte bereits zugewiesen sind
  const assignedProjectIds = new Set(user.assigned_projects.map(p => p.project_id));

  const handleAssignmentChange = async (projectId: string, isAssigned: boolean) => {
    setLoading(true);
    try {
      const method = isAssigned ? 'DELETE' : 'POST';
      const response = await fetch(`/api/projects/${projectId}/assign`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        throw new Error('Aktion fehlgeschlagen');
      }
      
      // Seite neu laden, um die Änderungen zu sehen
      router.refresh();

    } catch (error) {
      console.error('Fehler bei der Zuweisung:', error);
      alert('Ein Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4">Projektzuweisungen</h3>
      <div className="space-y-3">
        {allProjects.map((project) => {
          const isAssigned = assignedProjectIds.has(project.id);
          return (
            <div key={project.id} className="flex items-center justify-between p-3 border rounded-md">
              <span className="font-medium">{project.name}</span>
              <button
                onClick={() => handleAssignmentChange(project.id, isAssigned)}
                disabled={loading}
                className={`px-4 py-1 text-sm rounded-md ${
                  isAssigned
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                } disabled:bg-gray-400`}
              >
                {loading ? 'Lädt...' : isAssigned ? 'Entfernen' : 'Zuweisen'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
