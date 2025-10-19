// src/app/dashboard/freigabe/page.tsx
'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react'; // useCallback hinzugefügt
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  created_at: string;
};

// Typdefinition für erlaubte Statuswerte
type LandingpageStatus = Landingpage['status'];

export default function FreigabePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [landingpages, setLandingpages] = useState<Landingpage[]>([]);
  const [filteredPages, setFilteredPages] = useState<Landingpage[]>([]);
  const [filterStatus, setFilterStatus] = useState<LandingpageStatus | 'alle'>('alle');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Funktion zum Laden der Landingpages
  // KORREKTUR: Mit useCallback umschlossen
  const loadLandingpages = useCallback(async () => {
    // isLoading nur beim ersten Laden setzen, nicht bei Refresh
    if (landingpages.length === 0) setIsLoading(true);

    if (!session?.user?.id) return;

    try {
      const response = await fetch(`/api/users/${session.user.id}/landingpages`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API-Fehler: ${response.status} - ${errorData.message || 'Unbekannter Fehler'}`);
      }
      const data: Landingpage[] = await response.json();
      setLandingpages(data);
      setMessage(''); // Erfolgreich geladen, Nachricht zurücksetzen
    } catch (error) {
      console.error('[Freigabe] Fehler:', error);
      setMessage(error instanceof Error ? error.message : 'Fehler beim Laden der Landingpages');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, landingpages.length]); // Abhängigkeiten für useCallback

  // Landingpages laden und Auto-Refresh einrichten
  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.id) {
      loadLandingpages(); // Initiales Laden

      // Auto-Refresh alle 30 Sekunden
      const interval = setInterval(loadLandingpages, 30000);
      return () => clearInterval(interval); // Aufräumen bei Unmount
    }
  }, [authStatus, session?.user?.id, loadLandingpages]); // KORREKTUR: loadLandingpages hinzugefügt

  // Filter anwenden, wenn sich Filter oder Landingpages ändern
  useEffect(() => {
    if (filterStatus === 'alle') {
      setFilteredPages(landingpages);
    } else {
      setFilteredPages(landingpages.filter(lp => lp.status === filterStatus));
    }
  }, [filterStatus, landingpages]);

  // Funktion zum Aktualisieren des Status (nur Freigeben/Sperren)
  const updateStatus = async (landingpageId: number, newStatus: 'Freigegeben' | 'Gesperrt') => {
    const originalLandingpages = [...landingpages];
    setLandingpages(prev =>
        prev.map(lp => lp.id === landingpageId ? { ...lp, status: newStatus } : lp)
    );
    setMessage(''); // Alte Nachrichten löschen

    try {
      const response = await fetch(`/api/landingpages/${landingpageId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        setLandingpages(originalLandingpages); // Rollback bei Fehler
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Status-Update fehlgeschlagen');
      }

      setMessage(`Landingpage erfolgreich ${newStatus === 'Freigegeben' ? 'freigegeben' : 'gesperrt'}`);
      setTimeout(() => setMessage(''), 3000); // Erfolgsmeldung nach 3s ausblenden
    } catch (error) {
      setLandingpages(originalLandingpages); // Sicherstellen, dass Rollback passiert
      console.error('Fehler beim Status-Update:', error);
      setMessage(error instanceof Error ? error.message : 'Fehler beim Ändern des Status');
    }
  };

  // ---- Hilfsfunktionen für die UI ----

  // Gibt die Styling-Klassen für Status-Badges zurück
  const getStatusStyle = (status: LandingpageStatus) => {
    switch (status) {
      case 'Offen': return 'text-blue-700 border-blue-300 bg-blue-50';
      case 'In Prüfung': return 'text-yellow-700 border-yellow-300 bg-yellow-50';
      case 'Gesperrt': return 'text-red-700 border-red-300 bg-red-50';
      case 'Freigegeben': return 'text-green-700 border-green-300 bg-green-50';
      default: return 'text-gray-700 border-gray-300 bg-gray-50';
    }
  };

  // Gibt das passende Icon für den Status zurück
  const getStatusIcon = (status: LandingpageStatus): ReactNode => {
    switch (status) {
      case 'Offen': return <FileEarmarkText className="inline-block" size={18} />;
      case 'In Prüfung': return <Search className="inline-block" size={18} />;
      case 'Gesperrt': return <SlashCircleFill className="inline-block" size={18} />;
      case 'Freigegeben': return <CheckCircleFill className="inline-block" size={18} />;
      default: return <InfoCircle className="inline-block" size={18} />;
    }
  };

  // Definiert die Filter-Buttons
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

  // Sicherstellen, dass der Nutzer die richtige Rolle hat
  if (authStatus === 'unauthenticated' || session?.user?.role !== 'BENUTZER') {
    router.push('/'); // Zurück zur Startseite oder Loginseite
    return null; // Rendert nichts, während umgeleitet wird
  }

  const pendingReviewCount = landingpages.filter(lp => lp.status === 'In Prüfung').length;

  // ---- Rendern der Komponente ----
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header-Bereich */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Landingpages Freigabe</h1>
            <p className="text-gray-600 mt-2">
              Geben Sie hier Landingpages frei oder sperren Sie diese.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
          >
            ← Zurück zum Dashboard
          </Link>
        </div>

        {/* Nachrichtenanzeige */}
        {message && (
          <div className={`mb-6 p-4 border rounded-md ${message.startsWith('Fehler') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'} flex items-center gap-2`}>
            {message.startsWith('Fehler') ? <ExclamationTriangleFill size={18}/> : <InfoCircleFill size={18}/>}
            {message}
          </div>
        )}

        {/* Benachrichtigung für wartende Freigaben */}
        {pendingReviewCount > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md shadow-sm">
            <div className="flex items-center">
              <ExclamationTriangleFill className="text-yellow-500 mr-3 flex-shrink-0" size={24} />
              <div>
                <p className="font-semibold text-yellow-900">
                  {pendingReviewCount} Landingpage{pendingReviewCount > 1 ? 's warten' : ' wartet'} auf Ihre Freigabe
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  {/* KORREKTUR: " durch &quot; ersetzt */}
                  Bitte prüfen Sie die Seiten unter <span className="font-medium">&quot;In Prüfung&quot;</span> und geben Sie sie frei oder sperren Sie sie.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter-Buttons */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
           <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1"><Filter size={16}/> Filtern nach Status</h3>
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

        {/* Landingpages-Liste */}
        {isLoading ? (
          <div className="text-center py-12">
             <ArrowRepeat className="animate-spin inline-block text-indigo-600 mr-2" size={24}/>
             <p className="text-gray-600 inline-block">Lade Landingpages...</p>
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow-md text-center">
             <span className="text-gray-400 text-4xl mb-3 block">{getStatusIcon(filterStatus as LandingpageStatus)}</span>
             <p className="text-gray-500">
                {landingpages.length === 0
                  ? 'Sie haben noch keine Landingpages.'
                  : `Keine Landingpages mit Status "${filterStatus}" gefunden.`}
             </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredPages.map((lp) => (
              <div
                key={lp.id}
                className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className={`p-4 border-b ${getStatusStyle(lp.status)} flex items-center justify-between`}>
                  <div className="flex items-center gap-2 font-semibold">
                     {getStatusIcon(lp.status)}
                     {lp.status}
                  </div>
                  <span className="text-xs text-gray-500">
                     ID: {lp.id}
                  </span>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                      {lp.haupt_keyword || <span className="italic text-gray-500">Kein Haupt-Keyword</span>}
                    </h3>
                    <a
                      href={lp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-sm break-all underline"
                      title={lp.url}
                    >
                      {lp.url}
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {lp.suchvolumen != null && (
                      <div>
                        <span className="text-gray-500">Suchvolumen:</span>
                        <p className="font-medium text-gray-900">
                          {lp.suchvolumen.toLocaleString('de-DE')}
                        </p>
                      </div>
                    )}
                    {lp.aktuelle_position != null && (
                      <div>
                        <span className="text-gray-500">Position:</span>
                        <p className="font-medium text-gray-900">
                          {lp.aktuelle_position}
                        </p>
                      </div>
                    )}
                    {lp.weitere_keywords && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Weitere Keywords:</span>
                        <p className="font-medium text-gray-900 text-xs mt-1 bg-gray-50 p-2 rounded border">
                          {lp.weitere_keywords}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="pt-4 border-t border-gray-100 flex gap-2 justify-end">
                    {lp.status === 'In Prüfung' && (
                      <>
                        <button
                          onClick={() => updateStatus(lp.id, 'Gesperrt')}
                          className="px-4 py-2 text-sm font-medium rounded border border-red-600 text-red-700 hover:bg-red-50 transition-colors flex items-center gap-1"
                        >
                          <SlashCircleFill size={16} /> Sperren
                        </button>
                        <button
                          onClick={() => updateStatus(lp.id, 'Freigegeben')}
                          className="px-4 py-2 text-sm font-medium rounded bg-green-600 border border-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
                        >
                          <CheckCircleFill size={16} /> Freigeben
                        </button>
                      </>
                    )}
                    {lp.status === 'Freigegeben' && (
                      <button
                        onClick={() => updateStatus(lp.id, 'Gesperrt')}
                         className="px-4 py-2 text-sm font-medium rounded border border-red-600 text-red-700 hover:bg-red-50 transition-colors flex items-center gap-1"
                      >
                         <SlashCircleFill size={16} /> Sperren
                      </button>
                    )}
                    {lp.status === 'Gesperrt' && (
                       <button
                        onClick={() => updateStatus(lp.id, 'Freigegeben')}
                        className="px-4 py-2 text-sm font-medium rounded border border-green-600 text-green-700 hover:bg-green-50 transition-colors flex items-center gap-1"
                      >
                        <CheckCircleFill size={16} /> Freigeben
                      </button>
                    )}
                    {lp.status === 'Offen' && (
                      <p className="text-sm text-gray-500 italic text-right w-full">
                        Wartet auf Admin-Prüfung
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 text-sm text-blue-800 space-y-3">
           <h3 className="font-semibold text-blue-900 flex items-center gap-2">
            <InfoCircleFill size={18}/> Status-Bedeutungen
          </h3>
          <ul className="list-disc pl-5 space-y-1">
             <li><strong>Offen:</strong> Die Landingpage wurde vom Admin angelegt und wird bald zur Prüfung freigegeben.</li>
            <li><strong>In Prüfung:</strong> Diese Landingpage wartet auf Ihre Aktion (Freigeben oder Sperren).</li>
            <li><strong>Freigegeben:</strong> Sie haben diese Landingpage für die Veröffentlichung freigegeben.</li>
            <li><strong>Gesperrt:</strong> Sie haben diese Landingpage gesperrt. Sie wird nicht veröffentlicht.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
