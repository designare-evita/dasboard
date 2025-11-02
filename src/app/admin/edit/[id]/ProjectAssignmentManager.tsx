// src/app/admin/edit/[id]/ProjectAssignmentManager.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Typen für Klarheit
interface Project {
  id: string; // Die ID des "Projekt"-Benutzers (Kunde)
  name: string; // Die Domain oder E-Mail des "Projekt"-Benutzers
  mandant_id: string | null; // NEU: Mandant des Projekts
}

// ✅ KORREKTUR: mandant_id kann auch undefined sein (kompatibel mit UserWithAssignments)
interface User {
  id: string; // Die ID des Admins, der bearbeitet wird
  mandant_id?: string | null; // KORRIGIERT: optional mit undefined
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

  // Filtert Projekte: Zeigt nur Projekte an, die NICHT bereits
  // zum Standard-Mandanten des Admins gehören (dafür ist die Zuweisung unnötig).
  const crossMandantProjects = allProjects.filter(
    p => p.mandant_id !== user.mandant_id
  );

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
      
      // WICHTIG: router.refresh() lädt die Server-Daten (assigned_projects) neu
      router.refresh(); 

    } catch (error) {
      console.error('Fehler bei der Zuweisung:', error);
      alert('Ein Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };
  
  if (crossMandantProjects.length === 0) {
    return (
        <div className="mt-8 p-6 bg-white rounded-lg shadow-md border border-gray-200">
            <h3 className="text-xl font-bold mb-4">Mandanten-übergreifende Zuweisungen</h3>
            <p className="text-gray-500">
              Es sind keine Kunden-Projekte aus *anderen* Mandanten vorhanden, die zugewiesen werden könnten.
            </p>
        </div>
    );
  }

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h3 className="text-xl font-bold mb-4">Mandanten-übergreifende Zuweisungen</h3>
      <p className="text-sm text-gray-600 mb-4">
        Weisen Sie diesem Admin Projekte (Kunden) zu, die sich **außerhalb** seines Standard-Mandanten (`{user.mandant_id || 'N/A'}`) befinden.
      </p>
      <div className="space-y-3">
        {crossMandantProjects.map((project) => {
          const isAssigned = assignedProjectIds.has(project.id);
          return (
            <div 
              key={project.id} 
              className={`flex items-center justify-between p-3 border rounded-md ${isAssigned ? 'bg-indigo-50 border-indigo-200' : ''}`}
            >
              <div>
                <span className="font-medium">{project.name}</span>
                <span className="ml-2 text-xs text-gray-500">(Mandant: {project.mandant_id || 'N/A'})</span>
              </div>
              <button
                onClick={() => handleAssignmentChange(project.id, isAssigned)}
                disabled={loading}
                className={`px-4 py-1 text-sm rounded-md transition-colors ${
                  isAssigned
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                } disabled:bg-gray-400`}
              >
                {loading ? '...' : (isAssigned ? 'Entfernen' : 'Zuweisen')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
