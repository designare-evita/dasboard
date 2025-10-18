// src/app/admin/redaktionsplan/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import type { User } from '@/types';

type Landingpage = {
  id: number;
  url: string;
  haupt_keyword: string | null;
  weitere_keywords: string | null;
  suchvolumen: number | null;
  aktuelle_position: number | null;
  status: 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';
  user_id: string;
  created_at: string;
};

export default function RedaktionsplanPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  
  const [projects, setProjects] = useState<User[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [landingpages, setLandingpages] = useState<Landingpage[]>([]);
  const [filteredPages, setFilteredPages] = useState<Landingpage[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('alle');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Projekte laden (für Admin/Superadmin)
  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadProjects();
    }
  }, [authStatus]);

  // Landingpages laden wenn Projekt ausgewählt
  useEffect(() => {
    if (selectedProject) {
      loadLandingpages(selectedProject);
    } else {
      setLandingpages([]);
      setFilteredPages([]);
    }
  }, [selectedProject]);

  // Filter anwenden
  useEffect(() => {
    if (filterStatus === 'alle') {
      setFilteredPages(landingpages);
    } else {
      setFilteredPages(landingpages.filter(lp => lp.status === filterStatus));
    }
  }, [filterStatus, landingpages]);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Fehler beim Laden der Projekte');
      const data: User[] = await response.json();
      
      // ✅ KORREKTUR: Nur Kunden (BENUTZER) anzeigen, keine Admins!
      // Type-Safe Filter: Prüfe ob role existiert
      const customers = data.filter(u => {
        if (!u.id) return false;
        // Falls role nicht im Type ist, kommt es trotzdem im Response
        const userWithRole = u as User & { role?: string };
        return !userWithRole.role || userWithRole.role === 'BENUTZER';
      });
      
      console.log('[Redaktionsplan] Alle User:', data.length);
      console.log('[Redaktionsplan] Nur Kunden:', customers.length);
      
      setProjects(customers);
    } catch (error) {
      console.error('Fehler beim Laden der Projekte:', error);
      setMessage('Fehler beim Laden der Projekte');
    }
  };

  const loadLandingpages = async (userId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/landingpages`);
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data: Landingpage[] = await response.json();
      setLandingpages(data);
      setMessage('');
    } catch (error) {
      console.error('Fehler:', error);
      setMessage('Fehler beim Laden der Landingpages');
      setLandingpages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (landingpageId: number, newStatus: Landingpage['status']) => {
    try {
      const response = await fetch(`/api/landingpages/${landingpageId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Status-Update fehlgeschlagen');

      // Lokale Aktualisierung
      setLandingpages(prev => 
        prev.map(lp => lp.id === landingpageId ? { ...lp, status: newStatus } : lp)
      );

      setMessage(`Status erfolgreich auf "${newStatus}" geändert`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Status-Update:', error);
      setMessage('Fehler beim Ändern des Status');
    }
  };

  // Auth-Check
  if (authStatus === 'loading') {
    return <div className="p-8 text-center">Lade...</div>;
  }

  if (authStatus === 'unauthenticated' || 
      (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN')) {
    router.push('/');
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Offen': return 'bg-blue-100 text-blue-800';
      case 'In Prüfung': return 'bg-yellow-100 text-yellow-800';
      case 'Gesperrt': return 'bg-red-100 text-red-800';
      case 'Freigegeben': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Redaktionsplan</h1>
            <p className="text-gray-600 mt-2">Verwalten Sie den Status Ihrer Landingpages</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link
              href="/admin"
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
            >
              ← Zurück zur Übersicht
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
            {message}
          </div>
        )}

        {/* Projekt-Auswahl */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Projekt auswählen
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">-- Bitte wählen --</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.domain || project.email}
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <>
            {/* Filter */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterStatus('alle')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  filterStatus === 'alle'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Alle ({landingpages.length})
              </button>
              <button
                onClick={() => setFilterStatus('Offen')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  filterStatus === 'Offen'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                }`}
              >
                Offen ({landingpages.filter(lp => lp.status === 'Offen').length})
              </button>
              <button
                onClick={() => setFilterStatus('In Prüfung')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  filterStatus === 'In Prüfung'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                }`}
              >
                In Prüfung ({landingpages.filter(lp => lp.status === 'In Prüfung').length})
              </button>
              <button
                onClick={() => setFilterStatus('Freigegeben')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  filterStatus === 'Freigegeben'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                }`}
              >
                Freigegeben ({landingpages.filter(lp => lp.status === 'Freigegeben').length})
              </button>
              <button
                onClick={() => setFilterStatus('Gesperrt')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  filterStatus === 'Gesperrt'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                }`}
              >
                Gesperrt ({landingpages.filter(lp => lp.status === 'Gesperrt').length})
              </button>
            </div>

            {/* Landingpages-Tabelle */}
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Lade Landingpages...</p>
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="bg-white p-12 rounded-lg shadow-md text-center">
                <p className="text-gray-500">
                  {landingpages.length === 0 
                    ? 'Noch keine Landingpages für dieses Projekt vorhanden.'
                    : 'Keine Landingpages mit diesem Status.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        URL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Haupt-Keyword
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Suchvolumen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPages.map((lp) => (
                      <tr key={lp.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <a
                            href={lp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-900 text-sm"
                          >
                            {lp.url}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {lp.haupt_keyword || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {lp.suchvolumen?.toLocaleString() || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {lp.aktuelle_position || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(lp.status)}`}>
                            {lp.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateStatus(lp.id, 'Offen')}
                              disabled={lp.status === 'Offen'}
                              className="px-3 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Auf 'Offen' setzen"
                            >
                              Offen
                            </button>
                            <button
                              onClick={() => updateStatus(lp.id, 'In Prüfung')}
                              disabled={lp.status === 'In Prüfung'}
                              className="px-3 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="In Prüfung"
                            >
                              Prüfung
                            </button>
                            <button
                              onClick={() => updateStatus(lp.id, 'Freigegeben')}
                              disabled={lp.status === 'Freigegeben'}
                              className="px-3 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Freigeben"
                            >
                              Frei
                            </button>
                            <button
                              onClick={() => updateStatus(lp.id, 'Gesperrt')}
                              disabled={lp.status === 'Gesperrt'}
                              className="px-3 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Sperren"
                            >
                              Sperren
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
