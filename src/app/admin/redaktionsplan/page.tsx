// src/app/admin/redaktionsplan/page.tsx
'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import { cn } from '@/lib/utils'; 

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
  Trash,
  ArrowUp,
  ArrowDown,
  CalendarEvent, // NEU
  ClockHistory   // NEU
} from 'react-bootstrap-icons';

// Typdefinition für Landingpage (AKTUALISIERT)
type Landingpage = {
  id: number;
  url: string;
  haupt_keyword: string | null;
  weitere_keywords: string | null;
  status: 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';
  user_id: string;
  created_at: string;
  updated_at?: string; // ✅ NEU
  
  // GSC-Felder
  gsc_klicks: number | null;
  gsc_klicks_change: number | null;
  gsc_impressionen: number | null;
  gsc_impressionen_change: number | null;
  gsc_position: number | string | null;
  gsc_position_change: number | string | null;
  gsc_last_updated: string | null;
  gsc_last_range: string | null;
};

type LandingpageStatus = Landingpage['status'];

// ... (GscChangeIndicator bleibt unverändert) ...
const GscChangeIndicator = ({ change, isPosition = false }: { 
  change: number | string | null | undefined, 
  isPosition?: boolean 
}) => {
  const numChange = (change === null || change === undefined || change === '') 
    ? 0 
    : parseFloat(String(change));

  if (numChange === 0) return null;
  
  let isPositive: boolean;
  if (isPosition) {
    isPositive = numChange < 0; 
  } else {
    isPositive = numChange > 0;
  }
  
  let text: string;
  if (isPosition) {
    text = (numChange > 0 ? `+${numChange.toFixed(2)}` : numChange.toFixed(2));
  } else {
    text = (numChange > 0 ? `+${numChange.toLocaleString('de-DE')}` : numChange.toLocaleString('de-DE'));
  }
  
  const colorClasses = isPositive ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100';
  const Icon = isPositive ? ArrowUp : ArrowDown;

  return (
    <span className={cn('ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold', colorClasses)}>
      <Icon size={12} />
      {text}
    </span>
  );
};

// ✅ NEU: Datums-Formatierer (Nur Datum, keine Uhrzeit)
const formatDateOnly = (dateString?: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export default function RedaktionsplanPage() {
  // ... (Session, States, useEffects, loadProjects, loadLandingpages, updateStatus, deleteLandingpage, handleGscRefresh bleiben unverändert) ...
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
  
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadProjects();
    }
  }, [authStatus]);

  const loadLandingpages = useCallback(async (userId: string) => {
    setIsLoading(true);
    setMessage('');
    try {
      const response = await fetch(`/api/users/${userId}/landingpages`);
      if (!response.ok) {
         const errorData = await response.json().catch(() => ({}));
         throw new Error(errorData.message || 'Fehler beim Laden');
      }
      const data: Landingpage[] = await response.json();
      setLandingpages(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Fehler');
      setLandingpages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadLandingpages(selectedProject);
    } else {
      setLandingpages([]);
      setFilteredPages([]);
    }
    setFilterStatus('alle');
  }, [selectedProject, loadLandingpages]);

  useEffect(() => {
    if (filterStatus === 'alle') {
      setFilteredPages(landingpages);
    } else {
      setFilteredPages(landingpages.filter(lp => lp.status === filterStatus));
    }
  }, [filterStatus, landingpages]);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const response = await fetch('/api/users?onlyCustomers=true');
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data: User[] = await response.json();
      setProjects(data);
    } catch (error) {
      setMessage('Fehler beim Laden der Projekte');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const updateStatus = async (landingpageId: number, newStatus: LandingpageStatus) => {
    // Optimistisches Update mit aktuellem Datum
    const now = new Date().toISOString();
    const originalLandingpages = [...landingpages];
    
    setLandingpages(prev =>
        prev.map(lp => lp.id === landingpageId ? { ...lp, status: newStatus, updated_at: now } : lp)
    );

    try {
      const response = await fetch(`/api/landingpages/${landingpageId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Update fehlgeschlagen');
      setMessage(`Status auf "${newStatus}" geändert`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setLandingpages(originalLandingpages);
      setMessage('Fehler beim Ändern des Status');
    }
  };

  const deleteLandingpage = async (landingpageId: number, landingpageUrl: string) => {
    if (!window.confirm(`Wirklich löschen?\n\n${landingpageUrl}`)) return;
    try {
      const response = await fetch(`/api/landingpages/${landingpageId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Löschen fehlgeschlagen');
      setLandingpages(prev => prev.filter(lp => lp.id !== landingpageId));
      setMessage('✅ Gelöscht');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Fehler beim Löschen');
    }
  };

  const handleGscRefresh = async () => {
    if (!selectedProject) return;
    setIsRefreshing(true);
    setMessage(`GSC-Abgleich...`);
    try {
      const response = await fetch('/api/landingpages/refresh-gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject, dateRange })
      });
      if (!response.ok) throw new Error('Fehler');
      setMessage('Daten abgeglichen!');
      await loadLandingpages(selectedProject); 
    } catch (error) {
      setMessage('Fehler beim Abgleich');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Hilfsfunktionen UI
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

  if (authStatus === 'loading') return <div className="p-8 text-center">Lade...</div>;
  if (authStatus === 'unauthenticated' || (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN')) {
    router.push('/'); return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Redaktionsplan</h1>
            <p className="text-gray-600 mt-2">Verwalten Sie den Status von Landingpages für Ihre Projekte.</p>
          </div>
        </div>

        {message && (
          <div className={`mb-6 p-4 border rounded-md ${message.startsWith('Fehler') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'} flex items-center gap-2`}>
            {message.startsWith('Fehler') ? <ExclamationTriangleFill size={18}/> : <InfoCircleFill size={18}/>}
            {message}
          </div>
        )}

        {/* Projekt-Wahl */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <label htmlFor="projectSelect" className="block text-sm font-semibold text-gray-700 mb-2">Projekt auswählen</label>
          <select
            id="projectSelect"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={isLoadingProjects}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">{isLoadingProjects ? 'Lade Projekte...' : '-- Bitte wählen --'}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.domain || p.email}</option>)}
          </select>
        </div>

        {selectedProject && (
          <>
            {/* GSC Box */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">GSC-Daten Abgleich</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <DateRangeSelector value={dateRange} onChange={setDateRange} className="w-full sm:w-auto" />
                <button onClick={handleGscRefresh} disabled={isRefreshing || isLoading} className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50">
                  {isRefreshing ? <ArrowRepeat className="animate-spin" size={18} /> : <Search size={16} />}
                  <span>{isRefreshing ? 'Wird abgeglichen...' : 'GSC-Daten abgleichen'}</span>
                </button>
              </div>
            </div>

            {/* Filter */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-6">
               <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1"><Filter size={16}/> Filtern nach Status</h3>
               <div className="flex gap-2 flex-wrap">
                  {filterOptions.map(option => (
                    <button key={option.value} onClick={() => setFilterStatus(option.value)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-1 ${filterStatus === option.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                        {option.icon} {option.label} ({option.value === 'alle' ? landingpages.length : landingpages.filter(lp => lp.status === option.value).length})
                    </button>
                 ))}
              </div>
            </div>

            {/* Tabelle */}
            {isLoading ? (
              <div className="text-center py-12"><ArrowRepeat className="animate-spin inline-block text-indigo-600 mr-2" size={24}/><p className="text-gray-600 inline-block">Lade Landingpages...</p></div>
            ) : filteredPages.length === 0 ? (
              <div className="bg-white p-12 rounded-lg shadow-md text-center"><p className="text-gray-500">Keine Landingpages gefunden.</p></div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                 <table className="w-full min-w-[1200px]">
                   <thead className="bg-gray-50 border-b border-gray-200">
                     <tr>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">URL / Keyword</th>
                       {/* ✅ NEUE DATUMS-SPALTEN */}
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         <div className="flex items-center gap-1"><CalendarEvent/> Erstellt</div>
                       </th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         <div className="flex items-center gap-1"><ClockHistory/> Aktualisiert</div>
                       </th>
                       {/* GSC Spalten */}
                       <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GSC Klicks</th>
                       <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GSC Impr.</th>
                       <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GSC Pos.</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {filteredPages.map((lp) => (
                       <tr key={lp.id} className="hover:bg-gray-50 transition-colors">
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div className="text-sm font-medium text-gray-900 truncate" title={lp.haupt_keyword || undefined}>{lp.haupt_keyword || <span className="text-gray-400 italic">Kein Keyword</span>}</div>
                           <a href={lp.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 text-xs truncate block" title={lp.url}>{lp.url}</a>
                         </td>
                         
                         {/* ✅ DATUMSWERTE */}
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                           {formatDateOnly(lp.created_at)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                           {formatDateOnly(lp.updated_at)}
                         </td>

                         {/* GSC Values */}
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                           <div className="flex items-center justify-end"><span>{lp.gsc_klicks?.toLocaleString('de-DE') || '-'}</span><GscChangeIndicator change={lp.gsc_klicks_change} /></div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                           <div className="flex items-center justify-end"><span>{lp.gsc_impressionen?.toLocaleString('de-DE') || '-'}</span><GscChangeIndicator change={lp.gsc_impressionen_change} /></div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                           <div className="flex items-center justify-end"><span>{lp.gsc_position ? parseFloat(String(lp.gsc_position)).toFixed(2) : '-'}</span><GscChangeIndicator change={lp.gsc_position_change} isPosition={true} /></div>
                         </td>

                         <td className="px-6 py-4 whitespace-nowrap">
                           <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${getStatusStyle(lp.status)}`}>{getStatusIcon(lp.status)} {lp.status}</span>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex gap-1">
                             {(['Offen', 'In Prüfung', 'Freigegeben', 'Gesperrt'] as LandingpageStatus[]).map(status => (
                               <button key={status} onClick={() => updateStatus(lp.id, status)} disabled={lp.status === status} className={`px-2 py-1 text-xs font-medium rounded border ${lp.status === status ? 'bg-gray-200 text-gray-500' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{getStatusIcon(status)}</button>
                             ))}
                             <button onClick={() => deleteLandingpage(lp.id, lp.url)} className="px-2 py-1 text-xs font-medium rounded border border-red-600 bg-red-50 text-red-700 hover:bg-red-100"><Trash size={14} /></button>
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
