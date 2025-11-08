// src/components/LandingpageApproval.tsx
'use client';

import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

// Typen aus zentraler Datei importieren
import { Landingpage, LandingpageStatus } from '@/types';

// Icons importieren
import {
  FileEarmarkText,
  Search,
  SlashCircleFill,
  CheckCircleFill,
  InfoCircle,
  ExclamationTriangleFill,
  ArrowRepeat,
  ArrowUp,
  ArrowDown,
} from 'react-bootstrap-icons';

// --- Datenabruf-Funktion (Fetcher) ---
const fetcher = async (url: string): Promise<Landingpage[]> => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Ein unbekannter Fehler ist aufgetreten.' }));
    const error = new Error(errorData.message || `Ein Fehler ist aufgetreten: ${res.statusText}`);
    throw error;
  }

  const data = await res.json();
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error("Die von der API erhaltenen Daten waren kein Array.");
};

// --- Helper-Komponente für GSC-Vergleichswerte ---
const GscChangeIndicator = ({ change, isPosition = false }: { 
  change: number | string | null | undefined, 
  isPosition?: boolean 
}) => {
  
  const numChange = (change === null || change === undefined || change === '') 
    ? 0 
    : parseFloat(String(change));

  if (numChange === 0) {
    return null;
  }
  
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

// --- Hauptkomponente ---
export default function LandingpageApproval() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const apiUrl = userId ? `/api/users/${userId}/landingpages` : null;

  // ✅ NEU: State für DateRange und GSC-Refresh
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gscMessage, setGscMessage] = useState('');

  const { data: landingpages, error, isLoading, mutate } = useSWR<Landingpage[]>(apiUrl, fetcher);

  // ✅ NEU: GSC-Daten-Abgleich Handler
  const handleGscRefresh = async () => {
    if (!userId) {
      setGscMessage("Fehler: Sitzung nicht gefunden.");
      return;
    }
    
    setIsRefreshing(true);
    setGscMessage(`Starte GSC-Abgleich für Zeitraum: ${dateRange}...`);
    
    try {
      const response = await fetch('/api/landingpages/refresh-gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: userId,
          dateRange: dateRange
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'GSC-Abgleich fehlgeschlagen');
      }
      
      setGscMessage(result.message || 'Daten erfolgreich abgeglichen!');
      await mutate(); // ✅ Lade die Landingpages neu
      
      // Erfolgsmeldung nach 3 Sekunden ausblenden
      setTimeout(() => setGscMessage(''), 3000);
      
    } catch (error) {
      console.error('Fehler beim GSC-Abgleich:', error);
      setGscMessage(error instanceof Error ? `❌ Fehler: ${error.message}` : 'Fehler beim Abgleich');
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- Event Handler ---
  const handleStatusChange = async (id: number, newStatus: 'Freigegeben' | 'Gesperrt') => {
    const optimisticData = landingpages?.map((lp): Landingpage =>
      lp.id === id ? { ...lp, status: newStatus } : lp
    );

    if (optimisticData) {
      mutate(optimisticData, false);
    }

    try {
      const response = await fetch(`/api/landingpages/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Fehler bei der Aktualisierung.');
      }

      mutate();

    } catch (err) {
      console.error("Fehler beim Status-Update:", err);
      mutate(landingpages, false);
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

  const getStatusIcon = (status: LandingpageStatus): ReactNode => {
    switch (status) {
      case 'Offen': return <FileEarmarkText className="inline-block" size={16} />;
      case 'In Prüfung': return <Search className="inline-block" size={16} />;
      case 'Gesperrt': return <SlashCircleFill className="inline-block" size={16} />;
      case 'Freigegeben': return <CheckCircleFill className="inline-block" size={16} />;
      default: return <InfoCircle className="inline-block" size={16} />;
    }
  };

  // --- Render-Logik ---
  if (isLoading) {
    return (
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Redaktionsplan</h3>
        <div className="flex items-center justify-center py-10">
          <ArrowRepeat className="animate-spin text-indigo-600 mr-2" size={24} />
          <p className="text-gray-500">Lade Redaktionsplan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 bg-red-50 p-6 rounded-lg shadow-md border border-red-200">
        <h3 className="text-xl font-bold mb-2 text-red-800 flex items-center gap-2">
          <ExclamationTriangleFill size={20}/> Fehler im Redaktionsplan
        </h3>
        <p className="text-red-700 text-sm">{error.message}</p>
      </div>
    );
  }

  if (!Array.isArray(landingpages) || landingpages.length === 0) {
    return null;
  }

  const pendingPages = landingpages.filter(lp => lp.status === 'In Prüfung');
  const approvedPages = landingpages.filter(lp => lp.status === 'Freigegeben');
  const blockedPages = landingpages.filter(lp => lp.status === 'Gesperrt');

  if (pendingPages.length === 0 && approvedPages.length === 0 && blockedPages.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-3">Redaktionsplan</h3>

      {/* ✅ NEU: GSC-Abgleich-Box */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-3">GSC-Daten Abgleich</h4>
        <p className="text-xs text-blue-700 mb-3">
          Aktualisieren Sie die GSC-Daten (Klicks, Impressionen, Position) für Ihre Landingpages.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <DateRangeSelector
            value={dateRange}
            onChange={setDateRange}
            className="w-full sm:w-auto"
          />
          <button
            onClick={handleGscRefresh}
            disabled={isRefreshing || isLoading}
            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-wait flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {isRefreshing ? (
              <ArrowRepeat className="animate-spin" size={16} />
            ) : (
              <Search size={16} />
            )}
            <span>{isRefreshing ? 'Wird abgeglichen...' : 'GSC-Daten abgleichen'}</span>
          </button>
        </div>

        {/* ✅ GSC-Nachricht */}
        {gscMessage && (
          <div className={`mt-3 p-2 rounded text-xs ${
            gscMessage.startsWith('❌') 
              ? 'bg-red-100 text-red-800 border border-red-300' 
              : gscMessage.includes('erfolgreich')
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
          }`}>
            {gscMessage}
          </div>
        )}
      </div>

      {/* Zur Freigabe (In Prüfung) */}
      {pendingPages.length > 0 && (
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center gap-2">
            {getStatusIcon('In Prüfung')} Zur Freigabe ({pendingPages.length})
          </h4>
          <div className="space-y-4">
            {pendingPages.map((lp) => (
              <div key={lp.id} className="p-4 border rounded-md bg-yellow-50 border-yellow-200 hover:shadow-sm transition-shadow">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 mb-1 truncate" title={lp.haupt_keyword || undefined}>
                      {lp.haupt_keyword || <span className="italic text-gray-500">Kein Haupt-Keyword</span>}
                    </p>
                    
                      href={lp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-sm break-all underline block mb-2"
                      title={lp.url}
                    >
                      {lp.url}
                    </a>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                      {lp.gsc_position != null && (
                        <span className="flex items-center">
                          Position: 
                          <span className="font-medium text-gray-800 ml-1">
                            {parseFloat(String(lp.gsc_position)).toFixed(2)}
                          </span>
                          <GscChangeIndicator change={lp.gsc_position_change} isPosition={true} />
                        </span>
                      )}
                      {lp.gsc_klicks != null && (
                        <span className="flex items-center">
                          Klicks: 
                          <span className="font-medium text-gray-800 ml-1">
                            {lp.gsc_klicks.toLocaleString('de-DE')}
                          </span>
                          <GscChangeIndicator change={lp.gsc_klicks_change} />
                        </span>
                      )}
                      {lp.gsc_impressionen != null && (
                         <span className="flex items-center">
                          Impr.: 
                          <span className="font-medium text-gray-800 ml-1">
                            {lp.gsc_impressionen.toLocaleString('de-DE')}
                          </span>
                          <GscChangeIndicator change={lp.gsc_impressionen_change} />
                        </span>
                      )}
                    </div>
                    
                    {lp.gsc_last_updated && (
                     <div className="text-[10px] text-gray-500 mt-2">
                       GSC-Daten ({lp.gsc_last_range}): {new Date(lp.gsc_last_updated).toLocaleDateString('de-DE')}
                     </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                    <button
                      onClick={() => handleStatusChange(lp.id, 'Gesperrt')}
                      className="px-3 py-1.5 text-xs font-medium rounded border border-red-600 text-red-700 hover:bg-red-50 transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      <SlashCircleFill size={14} /> Sperren
                    </button>
                    <button
                      onClick={() => handleStatusChange(lp.id, 'Freigegeben')}
                      className="px-3 py-1.5 text-xs font-medium rounded bg-green-600 border border-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      <CheckCircleFill size={14} /> Freigeben
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Freigegebene Landingpages */}
      {approvedPages.length > 0 && (
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
             {getStatusIcon('Freigegeben')} Freigegeben ({approvedPages.length})
          </h4>
          <div className="space-y-3">
            {approvedPages.map((lp) => (
              <div key={lp.id} className="p-3 border rounded-md flex justify-between items-center bg-green-50 border-green-200">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate" title={lp.haupt_keyword || undefined}>
                    {lp.haupt_keyword || <span className="italic text-gray-500">Kein Haupt-Keyword</span>}
                  </p>
                  
                    href={lp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 text-xs break-all underline block"
                    title={lp.url}
                  >
                    {lp.url}
                  </a>
                </div>
                <button
                  onClick={() => handleStatusChange(lp.id, 'Gesperrt')}
                  className="px-3 py-1 text-xs font-medium rounded border border-red-600 text-red-700 hover:bg-red-50 transition-colors flex items-center gap-1 ml-4 flex-shrink-0"
                >
                   <SlashCircleFill size={14} /> Sperren
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gesperrte Landingpages */}
      {blockedPages.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
            {getStatusIcon('Gesperrt')} Gesperrt ({blockedPages.length})
          </h4>
          <div className="space-y-3">
            {blockedPages.map((lp) => (
              <div key={lp.id} className="p-3 border rounded-md flex justify-between items-center bg-red-50 border-red-200 opacity-80">
                 <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate" title={lp.haupt_keyword || undefined}>
                    {lp.haupt_keyword || <span className="italic text-gray-500">Kein Haupt-Keyword</span>}
                  </p>
                  
                    href={lp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 text-xs break-all underline block"
                    title={lp.url}
                  >
                    {lp.url}
                  </a>
                </div>
                <button
                  onClick={() => handleStatusChange(lp.id, 'Freigegeben')}
                  className="px-3 py-1 text-xs font-medium rounded border border-green-600 text-green-700 hover:bg-green-50 transition-colors flex items-center gap-1 ml-4 flex-shrink-0"
                >
                   <CheckCircleFill size={14} /> Freigeben
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
