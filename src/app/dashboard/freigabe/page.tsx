// src/app/dashboard/freigabe/page.tsx
'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  updated_at?: string; // ✅ NEU: Aktualisierungsdatum
  
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

// Helper für GSC-Vergleichswerte
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
  
  const colorClasses = isPositive 
    ? 'text-green-700 bg-green-100' 
    : 'text-red-700 bg-red-100';
  const Icon = isPositive ? ArrowUp : ArrowDown;

  return (
    <span className={cn('ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold', colorClasses)}>
      <Icon size={12} />
      {text}
    </span>
  );
};

// ✅ NEU: Datums-Formatierer (Nur Datum)
const formatDateOnly = (dateString?: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
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

  // Landingpages laden
  const loadLandingpages = useCallback(async () => {
    if (!session?.user?.id) return;
    if (landingpages.length === 0) setIsLoading(true);

    try {
      const response = await fetch(`/api/users/${session.user.id}/landingpages`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API-Fehler: ${response.status} - ${errorData.message || 'Unbekannter Fehler'}`);
      }
      const data: Landingpage[] = await response.json();
      setLandingpages(data);
      if(message.startsWith('Starte')) setMessage('');
    } catch (error) {
      console.error('[Freigabe] Fehler:', error);
      setMessage(error instanceof Error ? error.message : 'Fehler beim Laden der Landingpages');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, landingpages.length, message]);

  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.id) {
      loadLandingpages();
      const interval = setInterval(loadLandingpages, 30000);
      return () => clearInterval(interval);
    }
  }, [authStatus, session?.user?.id, loadLandingpages]);

  useEffect(() => {
    if (filterStatus === 'alle') {
      setFilteredPages(landingpages);
    } else {
      setFilteredPages(landingpages.filter(lp => lp.status === filterStatus));
    }
  }, [filterStatus, landingpages]);

  // Status aktualisieren
  const updateStatus = async (landingpageId: number, newStatus: 'Freigegeben' | 'Gesperrt') => {
    // ✅ Optimistisches Update inkl. Zeitstempel
    const now = new Date().toISOString();
    const originalLandingpages = [...landingpages];
    
    setLandingpages(prev =>
        prev.map(lp => lp.id === landingpageId ? { ...lp, status: newStatus, updated_at: now } : lp)
    );
    setMessage('');

    try {
      const response = await fetch(`/api/landingpages/${landingpageId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        setLandingpages(originalLandingpages); // Rollback
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Status-Update fehlgeschlagen');
      }

      setMessage(`Landingpage erfolgreich ${newStatus === 'Freigegeben' ? 'freigegeben' : 'gesperrt'}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setLandingpages(originalLandingpages);
      console.error('Fehler beim Status-Update:', error);
      setMessage(error instanceof Error ? error.message : 'Fehler beim Ändern des Status');
    }
  };
  
  const handleGscRefresh = async () => {
    if (!session?.user?.id) {
      setMessage("Fehler: Sitzung nicht gefunden.");
      return;
    }
    setIsRefreshing(true);
    setMessage(`Starte GSC-Abgleich für Zeitraum: ${dateRange}...`);
    try {
      const response = await fetch('/api/landingpages/refresh-gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: session.user.id,
          dateRange: dateRange
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'GSC-Abgleich fehlgeschlagen');
      setMessage(result.message || 'Daten erfolgreich abgeglichen!');
      await loadLandingpages(); 
    } catch (error) {
      console.error('Fehler beim GSC-Abgleich:', error);
      setMessage(error instanceof Error ? `❌ Fehler: ${error.message}` : 'Fehler beim Abgleich');
    } finally {
      setIsRefreshing(false);
    }
  };

  // UI-Helper
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
      case 'Offen': return <FileEarmarkText className="inline-block" size={18} />;
      case 'In Prüfung': return <Search className="inline-block" size={18} />;
      case 'Gesperrt': return <SlashCircleFill className="inline-block" size={18} />;
      case 'Freigegeben': return <CheckCircleFill className="inline-block" size={18} />;
      default: return <InfoCircle className="inline-block" size={18} />;
    }
  };

  const filterOptions: { label: string; value: LandingpageStatus | 'alle'; icon: ReactNode }[] = [
    { label: 'Alle', value: 'alle', icon: <ListTask className="inline-block mr-1" size={16}/> },
    { label: 'Offen', value: 'Offen', icon: <FileEarmarkText className="inline-block mr-1" size={16}/> },
    { label: 'In Prüfung', value: 'In Prüfung', icon: <Search className="inline-block mr-1" size={16}/> },
    { label: 'Freigegeben', value: 'Freigegeben', icon: <CheckCircleFill className="inline-block mr-1" size={16}/> },
    { label: 'Gesperrt', value: 'Gesperrt', icon: <SlashCircleFill className="inline-block mr-1" size={16}/> },
  ];

  if (authStatus === 'loading') return <div className="p-8 text-center">Lade Sitzung...</div>;
  if (authStatus === 'unauthenticated' || session?.user?.role !== 'BENUTZER') {
    router.push('/'); return null;
  }

  const pendingReviewCount = landingpages.filter(lp => lp.status === 'In Prüfung').length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Landingpages Freigabe</h1>
            <p className="text-gray-600 mt-2">Geben Sie hier Landingpages frei oder sperren Sie diese.</p>
          </div>
        </div>

        {/* Nachrichten */}
        {message && (
          <div className={`mb-6 p-4 border rounded-md ${message.startsWith('Fehler') || message.startsWith('❌') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'} flex items-center gap-2`}>
            {message.startsWith('Fehler') || message.startsWith('❌') ? <ExclamationTriangleFill size={18}/> : <InfoCircleFill size={18}/>}
            {message}
          </div>
        )}

        {/* GSC-Abgleich */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">GSC-Daten Abgleich</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <DateRangeSelector value={dateRange} onChange={setDateRange} className="w-full sm:w-auto" />
            <button
              onClick={handleGscRefresh}
              disabled={isRefreshing || isLoading}
              className="px-4 py-2 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-wait flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {isRefreshing ? <ArrowRepeat className="animate-spin" size={18} /> : <Search size={16} />}
              <span>{isRefreshing ? 'Wird abgeglichen...' : 'GSC-Daten abgleichen'}</span>
            </button>
          </div>
        </div>

        {/* Benachrichtigung */}
        {pendingReviewCount > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md shadow-sm">
            <div className="flex items-center">
              <ExclamationTriangleFill className="text-yellow-500 mr-3 flex-shrink-0" size={24} />
              <div>
                <p className="font-semibold text-yellow-900">{pendingReviewCount} Landingpage{pendingReviewCount > 1 ? 's warten' : ' wartet'} auf Ihre Freigabe</p>
                <p className="text-sm text-yellow-700 mt-1">Bitte prüfen Sie die Seiten unter <span className="font-medium">&quot;In Prüfung&quot;</span>.</p>
              </div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
           <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1"><Filter size={16}/> Filtern nach Status</h3>
           <div className="flex gap-2 flex-wrap">
              {filterOptions.map(option => (
                <button key={option.value} onClick={() => setFilterStatus(option.value)} className={`px-3 py-1.5 text-sm rounded-md font-medium border transition-colors flex items-center gap-1 ${filterStatus === option.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                    {option.icon} {option.label} ({option.value === 'alle' ? landingpages.length : landingpages.filter(lp => lp.status === option.value).length})
                </button>
             ))}
          </div>
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="text-center py-12"><ArrowRepeat className="animate-spin inline-block text-indigo-600 mr-2" size={24}/><p className="text-gray-600 inline-block">Lade Landingpages...</p></div>
        ) : filteredPages.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow-md text-center">
             <span className="text-gray-400 text-4xl mb-3 block">{getStatusIcon(filterStatus as LandingpageStatus)}</span>
             <p className="text-gray-500">{landingpages.length === 0 ? 'Sie haben noch keine Landingpages.' : `Keine Landingpages mit Status "${filterStatus}" gefunden.`}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredPages.map((lp) => (
              <div key={lp.id} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden flex flex-col">
                
                <div className={`p-4 border-b ${getStatusStyle(lp.status)} flex items-center justify-between`}>
                  <div className="flex items-center gap-2 font-semibold">{getStatusIcon(lp.status)} {lp.status}</div>
                  {lp.gsc_last_updated && (
                     <span className="text-xs text-gray-600 opacity-80">GSC: {new Date(lp.gsc_last_updated).toLocaleDateString('de-DE')}</span>
                  )}
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">{lp.haupt_keyword || <span className="italic text-gray-500">Kein Haupt-Keyword</span>}</h3>
                  <a href={lp.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 text-sm break-all underline mb-4 inline-block" title={lp.url}>{lp.url}</a>
                  
                  {/* GSC Daten */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-t border-b py-4 mb-4">
                    <div><span className="text-gray-500">Position:</span> <span className="font-medium text-gray-900">{lp.gsc_position ? parseFloat(String(lp.gsc_position)).toFixed(2) : '-'}</span></div>
                    <div><span className="text-gray-500">Klicks:</span> <span className="font-medium text-gray-900">{lp.gsc_klicks?.toLocaleString('de-DE') || '-'}</span></div>
                    <div><span className="text-gray-500">Impr.:</span> <span className="font-medium text-gray-900">{lp.gsc_impressionen?.toLocaleString('de-DE') || '-'}</span></div>
                  </div>
                  
                  {/* ✅ NEU: Datumsinformationen */}
                  <div className="flex justify-between text-xs text-gray-400 mb-4">
                    <span className="flex items-center gap-1" title="Erstellt am">
                      <CalendarEvent size={12}/> {formatDateOnly(lp.created_at)}
                    </span>
                    <span className="flex items-center gap-1" title="Zuletzt aktualisiert">
                      <ClockHistory size={12}/> {formatDateOnly(lp.updated_at)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto flex gap-2 justify-end">
                    {lp.status === 'In Prüfung' && (
                      <>
                        <button onClick={() => updateStatus(lp.id, 'Gesperrt')} className="px-3 py-1.5 text-xs font-medium rounded border border-red-600 text-red-700 hover:bg-red-50 flex items-center gap-1"><SlashCircleFill size={14} /> Sperren</button>
                        <button onClick={() => updateStatus(lp.id, 'Freigegeben')} className="px-3 py-1.5 text-xs font-medium rounded bg-green-600 border border-green-600 text-white hover:bg-green-700 flex items-center gap-1"><CheckCircleFill size={14} /> Freigeben</button>
                      </>
                    )}
                    {lp.status === 'Freigegeben' && (
                      <button onClick={() => updateStatus(lp.id, 'Gesperrt')} className="px-4 py-2 text-sm font-medium rounded border border-red-600 text-red-700 hover:bg-red-50 flex items-center gap-1"><SlashCircleFill size={16} /> Sperren</button>
                    )}
                    {lp.status === 'Gesperrt' && (
                       <button onClick={() => updateStatus(lp.id, 'Freigegeben')} className="px-4 py-2 text-sm font-medium rounded border border-green-600 text-green-700 hover:bg-green-50 flex items-center gap-1"><CheckCircleFill size={16} /> Freigeben</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
