// src/app/admin/redaktionsplan/page.tsx
'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';

// Icons importieren
import {
  FileEarmarkText,
  Search,
  SlashCircleFill,
  CheckCircleFill,
  InfoCircle,
  ExclamationTriangleFill,
  ArrowRepeat,
  InfoCircleFill,
  ListTask,
  Filter,
  Trash, // ✅ Trash-Icon für Löschen-Button
} from 'react-bootstrap-icons';

// Typdefinition für Landingpage
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

// Typdefinition für erlaubte Statuswerte
type LandingpageStatus = Landingpage['status'];

export default function RedaktionsplanPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<User[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [landingpages, setLandingpages] = useState<Landingpage[]>([]);
  const [filteredPages, setFilteredPages] = useState<Landingpage[]>([]);
  const [filterStatus, setFilterStatus] = useState<LandingpageStatus | 'alle'>('alle');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [message, setMessage] = useState('');

  // Projekte laden (für Admin/Superadmin)
  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadProjects();
    }
  }, [authStatus]);

  // Landingpages laden, wenn Projekt ausgewählt wird
  useEffect(() => {
    if (selectedProject) {
      loadLandingpages(selectedProject);
    } else {
      setLandingpages([]);
      setFilteredPages([]);
    }
    setFilterStatus('alle');
  }, [selectedProject]);

  // Filter anwenden, wenn sich Filter oder Landingpages ändern
  useEffect(() => {
    if (filterStatus === 'alle') {
      setFilteredPages(landingpages);
    } else {
      setFilteredPages(landingpages.filter(lp => lp.status === filterStatus));
    }
  }, [filterStatus, landingpages]);

  // Funktion zum Laden der Projekte (Kunden)
  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const response = await fetch('/api/users?onlyCustomers=true');
      if (!response.ok) throw new Error('Fehler beim Laden der Projekte');
      const data: User[] = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Fehler beim Laden der Projekte:', error);
      setMessage('Fehler beim Laden der Projekte');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Funktion zum Laden der Landingpages für ein ausgewähltes Projekt
  const loadLandingpages = async (userId: string) => {
    setIsLoading(true);
    setMessage('');
    
    console.log('[Redaktionsplan] Lade Landingpages für User:', userId);
    
    try {
      const response = await fetch(`/api/users/${userId}/landingpages`);
      
      console.log('[Redaktionsplan] Response Status:', response.status);
      
      if (!response.ok) {
         const errorData = await response.json().catch(() => ({}));
         console.error('[Redaktionsplan] Fehler-Response:', errorData);
         throw new Error(errorData.message || 'Fehler beim Laden der Landingpages');
      }
      
      const data: Landingpage[] = await response.json();
      console.log('[Redaktionsplan] Landingpages geladen:', data.length, 'Einträge');
      
      setLandingpages(data);
    } catch (error) {
      console.error('[Redaktionsplan] Fehler:', error);
      setMessage(error instanceof Error ? error.message : 'Unbekannter Fehler beim Laden');
      setLandingpages([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Funktion zum Aktualisieren des Status einer Landingpage
  const updateStatus = async (landingpageId: number, newStatus: LandingpageStatus) => {
    const originalLandingpages = [...landingpages];
    setLandingpages(prev =>
        prev.map(lp => lp.id === landingpageId ? { ...lp, status: newStatus } : lp)
    );

    try {
      const response = await fetch(`/api/landingpages/${landingpageId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        setLandingpages(originalLandingpages);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Status-Update fehlgeschlagen');
      }

      setMessage(`Status erfolgreich auf "${newStatus}" geändert`);
      setTimeout(() => setMessage(''), 3000);

    } catch (error) {
      setLandingpages(originalLandingpages);
      console.error('Fehler beim Status-Update:', error);
      setMessage(error instanceof Error ? error.message : 'Fehler beim Ändern des Status');
    }
  };

  // ✅ Funktion zum Löschen einer Landingpage
  const deleteLandingpage = async (landingpageId: number, landingpageUrl: string) => {
    // Bestätigung vom Benutzer einholen
    if (!window.confirm(`Möchten Sie diese Landingpage wirklich löschen?\n\n${landingpageUrl}\n\nDiese Aktion kann nicht rückgängig gemacht werden!`)) {
      return;
    }

    setMessage('Lösche Landingpage...');

    try {
      const response = await fetch(`/api/landingpages/${landingpageId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Löschen fehlgeschlagen');
      }

      // Entferne die Landingpage aus dem State
      setLandingpages(prev => prev.filter(lp => lp.id !== landingpageId));
      
      setMessage('✅ Landingpage erfolgreich gelöscht');
      setTimeout(() => setMessage(''), 3000);

    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      setMessage(error instanceof Error ? error.message : 'Fehler beim Löschen der Landingpage');
    }
  };

  // ---- Hilfsfunktionen für die UI ----

  const getStatusStyle = (status: LandingpageStatus) => {
    switch (status) {
      case 'Offen': return 'text-blue-700 border-blue-300 bg-blue-50';
      case 'In Prüfung': return 'text-yellow-700 border-yellow-300 bg-yellow-50';
      case 'Gesperrt': return 'text-red-700 border-red-300 bg-red-50';
      case 'Freigegeben': return 'text-green-700 border-green-300 bg-green-50';
      default: return 'text-gray-700 border-gray-300 bg-gray-50';
    }
  };

  const getStatusIcon = (status: LandingpageStatus) => {
    switch (status) {
      case 'Offen': return <FileEarmarkText className="inline-block mr-1" size={16} />;
      case 'In Prüfung': return <Search className="inline-block mr-1" size={16} />;
      case 'Gesperrt': return <SlashCircleFill className="inline-block mr-1" size={16} />;
      case 'Freigegeben': return <CheckCircleFill className="inline-block mr-1" size={16} />;
      default: return <InfoCircle className="inline-block mr-1" size={16} />;
    }
  };

  const filterOptions: { label: string; value: LandingpageStatus | 'alle'; icon: ReactNode }[] = [
    { label: 'Alle', value: 'alle', icon: <ListTask className="inline-block mr-1" size={16}/> },
    { label: 'Offen', value: 'Offen', icon: <FileEarmarkText className="inline-block mr-1" size={16}/> },
    { label: 'In Prüfung', value: 'In Prüfung', icon: <Search className="inline-block mr-1" size={16}/> },
    { label: 'Freigegeben', value: 'Freigegeben', icon: <CheckCircleFill className="inline-block mr-1" size={16}/> },
    { label: 'Gesperrt', value: 'Gesperrt', icon: <SlashCircleFill className="inline-block mr-1" size={16}/> },
  ];

  // ---- Auth-Check ----
  if (authStatus === 'loading') {
    return <div className="p-8 text-center">Lade Sitzung...</div>;
  }

  if (authStatus === 'unauthenticated' ||
      (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN')) {
    router.push('/');
    return null;
  }

  // ---- Rendern der Komponente ----
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header-Bereich */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Redaktionsplan</h1>
            <p className="text-gray-600 mt-2">Verwalten Sie den Status von Landingpages für Ihre Projekte.</p>
          </div>
        </div>

        {/* Nachrichtenanzeige */}
        {message && (
          <div className={`mb-6 p-4 border rounded-md ${message.startsWith('Fehler') || message.startsWith('❌') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'} flex items-center gap-2`}>
            {message.startsWith('Fehler') || message.startsWith('❌') ? <ExclamationTriangleFill size={18}/> : <InfoCircleFill size={18}/>}
            {message}
          </div>
        )}

        {/* Projekt-Auswahl Dropdown */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <label htmlFor="projectSelect" className="block text-sm font-semibold text-gray-700 mb-2">
            Projekt auswählen
          </label>
          <select
            id="projectSelect"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={isLoadingProjects}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">{isLoadingProjects ? 'Lade Projekte...' : '-- Bitte wählen --'}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.domain || project.email}
              </option>
            ))}
          </select>
        </div>

        {/* Bereich wird nur angezeigt, wenn ein Projekt ausgewählt wurde */}
        {selectedProject && (
          <>
            {/* Filter-Buttons */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-6">
               <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1">
                 <Filter size={16}/> Filtern nach Status
               </h3>
               <div className="flex gap-2 flex-wrap">
                  {filterOptions.map(option => {
                    const count = option.value === 'alle'
                        ? landingpages.length
                        : landingpages.filter(lp => lp.status === option.value).length;
                    const isActive = filterStatus === option.value;
                    return (
                        <button
                            key={option.value}
                            onClick={() => setFilterStatus(option.value)}
                            className={`px-3 py-1.5 text-sm rounded-md font-medium border transition-colors flex items-center gap-1 ${
                                isActive
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {option.icon} {option.label} ({count})
                        </button>
                    );
                 })}
              </div>
            </div>

            {/* Landingpages-Tabelle */}
            {isLoading ? (
              <div className="text-center py-12">
                 <ArrowRepeat className="animate-spin inline-block text-indigo-600 mr-2" size={24}/>
                 <p className="text-gray-600 inline-block">Lade Landingpages...</p>
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="bg-white p-12 rounded-lg shadow-md text-center">
                 <span className="text-gray-400 text-4xl mb-3 block">📄</span>
                 <p className="text-gray-500">
                    {landingpages.length === 0
                      ? 'Für dieses Projekt sind noch keine Landingpages vorhanden.'
                      : `Keine Landingpages mit Status "${filterStatus}" gefunden.`}
                 </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                 <table className="w-full min-w-[800px]">
                   <thead className="bg-gray-50 border-b border-gray-200">
                     <tr>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         URL / Keyword
                       </th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Suchvol.
                       </th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Pos.
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
                       <tr key={lp.id} className="hover:bg-gray-50 transition-colors">
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div className="text-sm font-medium text-gray-900 truncate" title={lp.haupt_keyword || undefined}>
                             {lp.haupt_keyword || <span className="text-gray-400 italic">Kein Keyword</span>}
                           </div>
                           <a
                             href={lp.url}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-indigo-600 hover:text-indigo-800 text-xs truncate block"
                             title={lp.url}
                           >
                             {lp.url}
                           </a>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                           {lp.suchvolumen?.toLocaleString('de-DE') || '-'}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                           {lp.aktuelle_position || '-'}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${getStatusStyle(lp.status)}`}>
                             {getStatusIcon(lp.status)} {lp.status}
                           </span>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex gap-1">
                             {/* Status-Buttons */}
                             {(['Offen', 'In Prüfung', 'Freigegeben', 'Gesperrt'] as LandingpageStatus[]).map(statusValue => (
                               <button
                                 key={statusValue}
                                 onClick={() => updateStatus(lp.id, statusValue)}
                                 disabled={lp.status === statusValue}
                                 className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                                    lp.status === statusValue
                                      ? 'bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed'
                                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
                                 }`}
                                 title={statusValue}
                               >
                                 {getStatusIcon(statusValue)}
                               </button>
                             ))}
                             {/* Löschen-Button */}
                             <button
                               onClick={() => deleteLandingpage(lp.id, lp.url)}
                               className="px-2 py-1 text-xs font-medium rounded border border-red-600 bg-red-50 text-red-700 hover:bg-red-100 transition-colors flex items-center gap-1"
                               title="Landingpage löschen"
                             >
                               <Trash size={14} />
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
