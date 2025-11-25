// src/app/admin/edit/[id]/ProjectAssignmentManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { User } from '@/types';
import { Pencil, ArrowRepeat, CheckCircle } from 'react-bootstrap-icons';

// Projekt-Interface
interface Project {
  id: string;
  name: string;
  mandant_id: string | null;
}

// KORREKTUR: Omit<User, 'assigned_projects'> entfernt den Konflikt mit der string-Definition aus @/types
interface UserWithAssignments extends Omit<User, 'assigned_projects'> {
  assigned_projects: { project_id: string }[];
}

// WICHTIG: Interface mit availableProjects!
export interface ProjectAssignmentManagerProps {
  user: UserWithAssignments;
  allProjects: Project[];
  availableProjects: Project[]; 
}

export default function ProjectAssignmentManager({ 
  user, 
  allProjects, 
  availableProjects 
}: ProjectAssignmentManagerProps) {
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Lade die aktuellen Zuweisungen beim Mount
  useEffect(() => {
    if (user?.assigned_projects && Array.isArray(user.assigned_projects)) {
      setSelectedProjects(user.assigned_projects.map(ap => ap.project_id));
    }
  }, [user?.assigned_projects]);

  const handleToggleProject = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('💾 Speichere Projektzuweisungen...');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/users/${user.id}/assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_ids: selectedProjects
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}: Ein Fehler ist aufgetreten.`);
      }

      setMessage('');
      setSuccessMessage('✅ Projektzuweisungen erfolgreich aktualisiert!');
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error) {
      console.error('❌ Assignment Error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      setMessage(`❌ Fehler: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Zeige nur die verfügbaren Projekte an
  const projectsToDisplay = availableProjects;

  return (
    <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Pencil size={20} /> Projektzuweisungen für {user.email}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Projektliste */}
        <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
          {projectsToDisplay.length === 0 ? (
            <p className="text-gray-500 text-sm">Keine Projekte verfügbar</p>
          ) : (
            <div className="space-y-3">
              {projectsToDisplay.map(project => (
                <div key={project.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`project-${project.id}`}
                    checked={selectedProjects.includes(project.id)}
                    onChange={() => handleToggleProject(project.id)}
                    disabled={isSubmitting}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <label 
                    htmlFor={`project-${project.id}`}
                    className="flex-1 cursor-pointer text-sm text-gray-700"
                  >
                    <span className="font-medium">{project.name}</span>
                    {project.mandant_id && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({project.mandant_id})
                      </span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          <span className="font-medium">{selectedProjects.length}</span> von <span className="font-medium">{projectsToDisplay.length}</span> Projekten ausgewählt
        </div>

        {/* Buttons */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 font-normal text-white bg-[#188bdb] border-[3px] border-[#188bdb] rounded-[3px] hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#188bdb] disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <ArrowRepeat className="animate-spin" size={18} />
          ) : (
            <CheckCircle size={18} />
          )}
          <span>{isSubmitting ? 'Wird gespeichert...' : 'Zuweisungen speichern'}</span>
        </button>

        {/* Messages */}
        {successMessage && (
          <p className="text-sm text-green-600 font-medium p-3 bg-green-50 rounded border border-green-200">
            {successMessage}
          </p>
        )}
        {message && !successMessage && (
          <p className="text-sm text-red-600 font-medium p-3 bg-red-50 rounded border border-red-200">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
