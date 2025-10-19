// src/components/LandingpageApproval.tsx
'use client';

import { useSession } from 'next-auth/react';
import useSWR from 'swr';

// --- Typdefinitionen ---

interface Landingpage {
  id: number;
  url: string;
  status: 'Offen' | 'In Prüfung' | 'Gesperrt' | 'Freigegeben'; // ✅ Deutsche Status-Werte
  haupt_keyword?: string;
  aktuelle_position?: number;
  suchvolumen?: number;
  weitere_keywords?: string;
}

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
    // Optimistic Update
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

  // --- Render-Logik ---

  if (isLoading) {
    return (
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold mb-4">Redaktionsplan</h3>
        <p className="text-gray-500">Lade Daten...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold mb-4">Redaktionsplan</h3>
        <p className="text-red-600">Fehler beim Laden des Redaktionsplans: {error.message}</p>
      </div>
    );
  }

  if (!Array.isArray(landingpages) || landingpages.length === 0) {
    return null;
  }
  
  // ✅ Filter mit den neuen deutschen Status-Werten
  const pendingPages = landingpages.filter(lp => lp.status === 'In Prüfung');
  const approvedPages = landingpages.filter(lp => lp.status === 'Freigegeben');
  const blockedPages = landingpages.filter(lp => lp.status === 'Gesperrt');

  console.log('[LandingpageApproval] Total:', landingpages.length);
  console.log('[LandingpageApproval] In Prüfung:', pendingPages.length);
  console.log('[LandingpageApproval] Freigegeben:', approvedPages.length);
  console.log('[LandingpageApproval] Gesperrt:', blockedPages.length);

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4">Redaktionsplan</h3>
      
      {/* Zur Freigabe (In Prüfung) */}
      {pendingPages.length > 0 && (
        <div className="mb-8">
          <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2 flex items-center gap-2">
            <span className="text-yellow-600">🔍</span>
            Zur Freigabe ({pendingPages.length})
          </h4>
          <div className="space-y-3 pt-3">
            {pendingPages.map((lp) => (
              <div key={lp.id} className="p-4 border rounded-md bg-yellow-50 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {lp.haupt_keyword && (
                      <p className="font-bold text-gray-800 mb-1">{lp.haupt_keyword}</p>
                    )}
                    <p className="font-mono text-sm text-gray-600 break-all">{lp.url}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      {lp.aktuelle_position && (
                        <span>Position: {lp.aktuelle_position}</span>
                      )}
                      {lp.suchvolumen && (
                        <span>Suchvolumen: {lp.suchvolumen.toLocaleString('de-DE')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleStatusChange(lp.id, 'Freigegeben')}
                      className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 text-sm font-medium transition-colors whitespace-nowrap"
                    >
                      ✅ Freigeben
                    </button>
                    <button
                      onClick={() => handleStatusChange(lp.id, 'Gesperrt')}
                      className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 text-sm font-medium transition-colors whitespace-nowrap"
                    >
                      🚫 Sperren
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
          <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2 flex items-center gap-2">
            <span className="text-green-600">✅</span>
            Freigegeben ({approvedPages.length})
          </h4>
          <div className="space-y-3 pt-3">
            {approvedPages.map((lp) => (
              <div key={lp.id} className="p-4 border rounded-md flex justify-between items-center bg-green-50">
                <div>
                  {lp.haupt_keyword && <p className="font-bold text-gray-800">{lp.haupt_keyword}</p>}
                  <p className="font-mono text-sm text-gray-600 break-all">{lp.url}</p>
                </div>
                <button
                  onClick={() => handleStatusChange(lp.id, 'Gesperrt')}
                  className="bg-red-100 text-red-700 py-1 px-3 rounded-md hover:bg-red-200 text-sm font-medium transition-colors"
                >
                  Sperren
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gesperrte Landingpages */}
      {blockedPages.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2 flex items-center gap-2">
            <span className="text-red-600">🚫</span>
            Gesperrt ({blockedPages.length})
          </h4>
          <div className="space-y-3 pt-3">
            {blockedPages.map((lp) => (
              <div key={lp.id} className="p-4 border rounded-md flex justify-between items-center bg-red-50 opacity-70">
                <div>
                  {lp.haupt_keyword && <p className="font-bold text-gray-800">{lp.haupt_keyword}</p>}
                  <p className="font-mono text-sm text-gray-600 break-all">{lp.url}</p>
                </div>
                <button
                  onClick={() => handleStatusChange(lp.id, 'Freigegeben')}
                  className="bg-green-100 text-green-700 py-1 px-3 rounded-md hover:bg-green-200 text-sm font-medium transition-colors"
                >
                  Freigeben
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingPages.length === 0 && approvedPages.length === 0 && blockedPages.length === 0 && (
        <p className="text-gray-500">Aktuell gibt es keine Landingpages zur Verwaltung.</p>
      )}
    </div>
  );
}
