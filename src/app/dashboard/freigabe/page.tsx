// src/app/dashboard/freigabe/page.tsx
'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import { cn } from '@/lib/utils';

// Icons
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
  ArrowUp,
  ArrowDown,
  CalendarEvent, 
  ClockHistory,
  ChatSquareText
} from 'react-bootstrap-icons';

// Typdefinition
type Landingpage = {
  id: number;
  url: string;
  haupt_keyword: string | null;
  weitere_keywords: string | null;
  status: 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';
  comment: string | null; 
  user_id: string;
  created_at: string;
  updated_at?: string;
  
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

// Helper für GSC Indicators (Grüne/Rote Zahlen)
// KORREKTUR: ml-2 entfernt, da jetzt untereinander
const GscChangeIndicator = ({ change, isPosition = false }: { change: number | string | null | undefined, isPosition?: boolean }) => {
  const numChange = (change === null || change === undefined || change === '') ? 0 : parseFloat(String(change));
  if (numChange === 0) return null;
  
  // Bei Position ist negativ gut (Platz 10 -> 5 = -5), sonst ist positiv gut
  let isPositive = isPosition ? numChange < 0 : numChange > 0;
  
  let text = isPosition 
    ? (numChange > 0 ? `+${numChange.toFixed(2)}` : numChange.toFixed(2)) 
    : (numChange > 0 ? `+${numChange.toLocaleString('de-DE')}` : numChange.toLocaleString('de-DE'));
  
  const colorClasses = isPositive ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100';
  const Icon = isPositive ? ArrowUp : ArrowDown;

  return (
    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wide', colorClasses)}>
      <Icon size={9} />
      {text}
    </span>
  );
};

const formatDateOnly = (dateString?: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function FreigabePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [landingpages, setLandingpages] = useState<Landingpage[]>([]);
  const [filteredPages, setFilteredPages] = useState<Landingpage[]>([]);
  const [filterStatus, setFilterStatus] = useState<LandingpageStatus | 'alle'>('alle');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Daten laden
  const loadLandingpages = useCallback(async () => {
    if (!session?.user?.id) return;
    if (landingpages.length === 0) setIsLoading(true);

    try {
      const response = await fetch(`/api/users/${session.user.id}/landingpages`);
      if (!response.ok) throw new Error('API-Fehler');
      const data: Landingpage[] = await response.json();
      setLandingpages(data);
      if(message.startsWith('Starte')) setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Fehler');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, landingpages.length, message]);

  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.id) {
      loadLandingpages();
    }
  }, [authStatus, session?.user?.id, loadLandingpages]);

  useEffect(() => {
    setFilteredPages(filterStatus === 'alle' ? landingpages : landingpages.filter(lp => lp.status === filterStatus));
  }, [filterStatus, landingpages]);

  // Status ändern
  const updateStatus = async (landingpageId: number, newStatus: 'Freigegeben' | 'Gesperrt') => {
    const now = new Date().toISOString();
    const originalLandingpages = [...landingpages];
    setLandingpages(prev => prev.map(lp => lp.id === landingpageId ? { ...lp, status: newStatus, updated_at: now } : lp));
    setMessage('');

    try {
      const response = await fetch(`/api/landingpages/${landingpageId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Status-Update fehlgeschlagen');
      setMessage(`Status auf "${newStatus}" geändert`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setLandingpages(originalLandingpages);
      setMessage('Fehler beim Ändern des Status');
    }
  };

  // Kommentar speichern
  const saveComment = async (landingpageId: number, newComment: string) => {
    try {
      setLandingpages(prev => prev.map(lp => lp.id === landingpageId ? { ...lp, comment: newComment } : lp));
      
      const response = await fetch(`/api/landingpages/${landingpageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: newComment })
      });
      if (!response.ok) throw new Error('Fehler');
    } catch (error) {
      console.error(error);
      setMessage('Kommentar konnte nicht gespeichert werden');
    }
  };
  
  const handleGscRefresh = async () => {
    if (!session?.user?.id) return;
    setIsRefreshing(true);
    setMessage(`GSC-Abgleich...`);
    try {
      const response = await fetch('/api/landingpages/refresh-gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: session.user.id, dateRange })
      });
      if (!response.ok) throw new Error('Fehler');
      setMessage('Daten erfolgreich abgeglichen!');
      await loadLandingpages(); 
    } catch (error) {
      setMessage('Fehler beim Abgleich');
    } finally {
      setIsRefreshing(false);
    }
  };

  // UI Helpers
  const getStatusStyle = (status: LandingpageStatus) => {
    switch (status) {
      case 'Offen': return 'text-blue-700 border-blue-300 bg-blue-50';
      case 'In Prüfung': return 'text-yellow-700 border-yellow-300 bg-yellow-50';
      case 'Gesperrt': return 'text-red-700 border-red-300 bg-red-50';
      case 'Freigegeben': return 'text-green-700 border-green-300 bg-green-50';
      default: return 'text-gray-700 border-gray-300 bg-gray-50';
    }
  };
  const getStatusIcon = (status: LandingpageStatus): ReactNode => {
    switch (status) {
      case 'Offen': return <FileEarmarkText className="inline-block" size={16} />;
      case 'In Prüfung': return <Search className="inline-block" size={16} />;
      case 'Gesperrt': return <SlashCircleFill className="inline-block" size={16} />;
      case 'Freigegeben': return <CheckCircleFill className="inline-block" size={16} />;
      default: return <InfoCircle className="inline-block" size={16} />;
    }
  };
  const filterOptions = [
    { label: 'Alle', value: 'alle', icon: <ListTask className="inline-block mr-1" size={16}/> },
    { label: 'Offen', value: 'Offen', icon: <FileEarmarkText className="inline-block mr-1" size={16}/> },
    { label: 'In Prüfung', value: 'In Prüfung', icon: <Search className="inline-block mr-1" size={16}/> },
    { label: 'Freigegeben', value: 'Freigegeben', icon: <CheckCircleFill className="inline-block mr-1" size={16}/> },
    { label: 'Gesperrt', value: 'Gesperrt', icon: <SlashCircleFill className="inline-block mr-1" size={16}/> },
  ];

  if (authStatus === 'loading') return <div className="p-8 text-center">Lade...</div>;
  if (authStatus === 'unauthenticated' || session?.user?.role !== 'BENUTZER') {
    router.push('/'); return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1600px] mx-auto"> 
        
        <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Landingpages Freigabe</h1>
            <p className="text-gray-600 mt-2">Verwalten Sie den Status Ihrer Landingpages.</p>
          </div>
        </div>

        {message && (
          <div className={`mb-6 p-4 border rounded-md flex items-center gap-2 ${message.startsWith('Fehler') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
            {message.startsWith('Fehler') ? <ExclamationTriangleFill size={18}/> : <InfoCircleFill size={18}/>}
            {message}
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">GSC-Daten Abgleich</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <DateRangeSelector value={dateRange} onChange={setDateRange} className="w-full sm:w-auto" />
            <button onClick={handleGscRefresh} disabled={isRefreshing || isLoading} className="px-4 py-2 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-wait flex items-center justify-center gap-2 w-full sm:w-auto">
              {isRefreshing ? <ArrowRepeat className="animate-spin" size={18} /> : <Search size={16} />}
              <span>{isRefreshing ? 'Wird abgeglichen...' : 'GSC-Daten abgleichen'}</span>
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
           <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1"><Filter size={16}/> Filtern nach Status</h3>
           <div className="flex gap-2 flex-wrap">
              {filterOptions.map(option => (
                <button key={option.value} onClick={() => setFilterStatus(option.value as any)} className={`px-3 py-1.5 text-sm rounded-md font-medium border transition-colors flex items-center gap-1 ${filterStatus === option.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                    {option.icon} {option.label} ({option.value === 'alle' ? landingpages.length : landingpages.filter(lp => lp.status === option.value).length})
                </button>
             ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12"><ArrowRepeat className="animate-spin inline-block text-indigo-600 mr-2" size={24}/><p className="text-gray-600 inline-block">Lade Landingpages...</p></div>
        ) : filteredPages.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow-md text-center">
             <p className="text-gray-500">{landingpages.length === 0 ? 'Sie haben noch keine Landingpages.' : `Keine Landingpages mit Status "${filterStatus}" gefunden.`}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="w-full min-w-[1200px]">
               <thead className="bg-gray-50 border-b border-gray-200">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[20%]">URL / Keyword</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><div className="flex items-center gap-1"><CalendarEvent/> Daten</div></th>
                   
                   {/* Getrennte GSC Spalten */}
                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GSC Klicks</th>
                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GSC Impr.</th>
                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GSC Pos.</th>
                   
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">
                     <div className="flex items-center gap-1"><ChatSquareText/> Anmerkung</div>
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {filteredPages.map((lp) => (
                   <tr key={lp.id} className="hover:bg-gray-50 transition-colors">
                     {/* 1. URL & Keyword */}
                     <td className="px-6 py-4 whitespace-nowrap align-top">
                       <div className="text-sm font-medium text-gray-900 truncate" title={lp.haupt_keyword || undefined}>{lp.haupt_keyword || <span className="text-gray-400 italic">Kein Keyword</span>}</div>
                       <a href={lp.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 text-xs truncate block" title={lp.url}>{lp.url}</a>
                     </td>
                     
                     {/* 2. Daten */}
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 align-top">
                       <div className="text-xs">Erstellt: {formatDateOnly(lp.created_at)}</div>
                       <div className="text-xs">Update: {formatDateOnly(lp.updated_at)}</div>
                     </td>

                     {/* 3. GSC Klicks - GESTAPELT */}
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right align-top">
                       <div className="flex flex-col items-end gap-1">
                         <span className="font-medium text-gray-900">{lp.gsc_klicks?.toLocaleString('de-DE') || '-'}</span>
                         <GscChangeIndicator change={lp.gsc_klicks_change} />
                       </div>
                     </td>

                     {/* 4. GSC Impressionen - GESTAPELT */}
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right align-top">
                       <div className="flex flex-col items-end gap-1">
                         <span className="font-medium text-gray-900">{lp.gsc_impressionen?.toLocaleString('de-DE') || '-'}</span>
                         <GscChangeIndicator change={lp.gsc_impressionen_change} />
                       </div>
                     </td>

                     {/* 5. GSC Position - GESTAPELT */}
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right align-top">
                       <div className="flex flex-col items-end gap-1">
                         <span className="font-medium text-gray-900">{lp.gsc_position ? parseFloat(String(lp.gsc_position)).toFixed(2) : '-'}</span>
                         <GscChangeIndicator change={lp.gsc_position_change} isPosition={true} />
                       </div>
                     </td>

                     {/* 6. Status */}
                     <td className="px-6 py-4 whitespace-nowrap align-top">
                       <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${getStatusStyle(lp.status)}`}>{getStatusIcon(lp.status)} {lp.status}</span>
                     </td>

                     {/* 7. Anmerkung */}
                     <td className="px-6 py-4 align-top">
                        <textarea
                          className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                          rows={2}
                          defaultValue={lp.comment || ''}
                          placeholder="Anmerkung hinzufügen..."
                          onBlur={(e) => {
                            if (e.target.value !== (lp.comment || '')) {
                              saveComment(lp.id, e.target.value);
                            }
                          }}
                        />
                     </td>

                     {/* 8. Aktionen */}
                     <td className="px-6 py-4 whitespace-nowrap align-top">
                       <div className="flex gap-2">
                          <button onClick={() => updateStatus(lp.id, 'Freigegeben')} className="px-3 py-1.5 text-xs font-medium rounded bg-green-600 border border-green-600 text-white hover:bg-green-700 flex items-center gap-1"><CheckCircleFill size={14} /> Freigeben</button>
                          <button onClick={() => updateStatus(lp.id, 'Gesperrt')} className="px-3 py-1.5 text-xs font-medium rounded border border-red-600 text-red-700 hover:bg-red-50 flex items-center gap-1"><SlashCircleFill size={14} /> Sperren</button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
