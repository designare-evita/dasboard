// src/components/LandingpageApproval.tsx
'use client';

import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { ReactNode } from 'react';
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
} from 'react-bootstrap-icons';

// --- Typdefinitionen ---

interface Landingpage {
  id: number;
  url: string;
  status: 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben';
  haupt_keyword?: string;
  aktuelle_position?: number;
  suchvolumen?: number;
  weitere_keywords?: string;
}

type LandingpageStatus = Landingpage['status'];

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


// --- Hauptkomponente ---

export default function LandingpageApproval() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const apiUrl = userId ? `/api/users/${userId}/landingpages` : null;

  const { data: landingpages, error, isLoading, mutate } = useSWR<Landingpage[]>(apiUrl, fetcher);

  // --- Event Handler ---
  const handleStatusChange = async (id: number, newStatus: 'Freigegeben' | 'Gesperrt') => {
    // Optimistic Update: Aktualisiert die UI sofort, bevor die API antwortet
    const optimisticData = landingpages?.map((lp): Landingpage =>
      lp.id === id ? { ...lp, status: newStatus } : lp
    );

    if (optimisticData) {
      // 'mutate' aktualisiert den SWR-Cache. 'false' verhindert erneutes Fetchen.
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

      // Bei Erfolg: SWR neu validieren (optional, da optimistic update schon lief)
      mutate();

    } catch (err) {
      console.error("Fehler beim Status-Update:", err);
      // Bei Fehler: Rollback zum vorherigen Zustand
      mutate(landingpages, false);
      // Optional: Fehlermeldung anzeigen
    }
  };

  // ---- Hilfsfunktionen für die UI ----

  // Gibt die Styling-Klassen für Status-Badges zurück (minimalistisch)
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

  // Zeige nichts an, wenn keine Landingpages vorhanden sind
  if (!Array.isArray(landingpages) || landingpages.length === 0) {
    return null;
  }

  // Filtern der Landingpages nach Status
  const pendingPages = landingpages.filter(lp => lp.status === 'In Prüfung');
  const approvedPages = landingpages.filter(lp => lp.status === 'Freigegeben');
  const blockedPages = landingpages.filter(lp => lp.status === 'Gesperrt');

  // Zeige die Komponente nur an, wenn es relevante Seiten gibt (optional)
  if (pendingPages.length === 0 && approvedPages.length === 0 && blockedPages.length === 0) {
    return null; // Oder eine Meldung wie "Keine zu verwaltenden Landingpages"
  }

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-3">Redaktionsplan</h3>

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
                  {/* Linke Seite: Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 mb-1 truncate" title={lp.haupt_keyword}>
                      {lp.haupt_keyword || <span className="italic text-gray-500">Kein Haupt-Keyword</span>}
                    </p>
                    <a
                      href={lp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-sm break-all underline block mb-2"
                      title={lp.url}
                    >
                      {lp.url}
                    </a>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                      {lp.aktuelle_position != null && (
                        <span>Position: <span className="font-medium">{lp.aktuelle_position}</span></span>
                      )}
                      {lp.suchvolumen != null && (
                        <span>Suchvolumen: <span className="font-medium">{lp.suchvolumen.toLocaleString('de-DE')}</span></span>
                      )}
                    </div>
                  </div>
                  {/* Rechte Seite: Aktionen */}
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
                  <p className="font-semibold text-gray-800 text-sm truncate" title={lp.haupt_keyword}>
                    {lp.haupt_keyword || <span className="italic text-gray-500">Kein Haupt-Keyword</span>}
                  </p>
                  <a
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
                  <p className="font-semibold text-gray-800 text-sm truncate" title={lp.haupt_keyword}>
                    {lp.haupt_keyword || <span className="italic text-gray-500">Kein Haupt-Keyword</span>}
                  </p>
                  <a
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
