// src/app/admin/edit/[id]/ProjectAssignmentManager.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Typen für Klarheit
interface Project {
  id: string; // Die ID des "Projekt"-Benutzers
  name: string; // Die Domain oder E-Mail des "Projekt"-Benutzers
}

interface User {
  id: string; // Die ID des Admins, der bearbeitet wird
  assigned_projects: { project_id: string }[];
}

interface Props {
  user: User;
  allProjects: Project[];
}

export default function ProjectAssignmentManager({ user, allProjects }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const assignedProjectIds = new Set(user.assigned_projects.map(p => p.project_id));

  const handleAssignmentChange = async (projectId: string, isAssigned: boolean) => {
    setLoading(true);
    try {
      // WICHTIG: Die API-Route ist /api/projects/[PROJECT_ID]/assign
      const response = await fetch(`/api/projects/${projectId}/assign`, {
        method: isAssigned ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }), // Der Admin, der zugewiesen wird
      });

      if (!response.ok) {
        throw new Error('Aktion fehlgeschlagen');
      }
      
      router.refresh();

    } catch (error) {
      console.error('Fehler bei der Zuweisung:', error);
      alert('Ein Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };
  
  if (allProjects.length === 0) {
    return (
        <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4">Projektzuweisungen</h3>
            <p className="text-gray-500">Es sind keine Kunden-Projekte vorhanden, die zugewiesen werden könnten.</p>
        </div>
    );
  }

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4">Projektzuweisungen</h3>
      <p className="text-sm text-gray-600 mb-4">
        Weisen Sie diesem Admin die Projekte (Kunden) zu, auf die er Zugriff haben soll.
      </p>
      <div className="space-y-3">
        {allProjects.map((project) => {
          const isAssigned = assignedProjectIds.has(project.id);
          return (
            <div key={project.id} className="flex items-center justify-between p-3 border rounded-md">
              <span className="font-medium">{project.name}</span>
              <button
                onClick={() => handleAssignmentChange(project.id, isAssigned)}
                disabled={loading}
                className={`px-4 py-1 text-sm rounded-md transition-colors ${
                  isAssigned
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                } disabled:bg-gray-400`}
              >
                {isAssigned ? 'Entfernen' : 'Zuweisen'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
