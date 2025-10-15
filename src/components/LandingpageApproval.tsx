// src/components/LandingpageApproval.tsx
'use client';

import { useSession } from 'next-auth/react';
import useSWR from 'swr';

// --- Typdefinitionen ---

interface Landingpage {
  id: number;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  haupt_keyword?: string;
  aktuelle_position?: number;
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
  const handleApprove = async (id: number) => {
    // ✨ KORREKTUR: Wir verwenden 'approved' direkt. 
    // Das löst sowohl den TypeScript-Typfehler als auch den ESLint-Fehler.
    const optimisticData = landingpages?.map(lp => 
      lp.id === id ? { ...lp, status: 'approved' } : lp
    );

    if (optimisticData) {
      mutate(optimisticData, false);
    }

    try {
      const response = await fetch(`/api/landingpages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (!response.ok) {
        throw new Error('Fehler bei der Aktualisierung.');
      }
      
      // Daten nach erfolgreichem API-Aufruf neu validieren
      mutate();

    } catch (err) {
      console.error("Fehler bei der Freigabe:", err);
      // Im Fehlerfall zum ursprünglichen Zustand zurückkehren
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
    return null; // Nichts anzeigen, wenn keine Landingpages da sind
  }
  
  const pendingPages = landingpages.filter(lp => lp.status === 'pending');
  const approvedPages = landingpages.filter(lp => lp.status === 'approved');

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4">Redaktionsplan</h3>
      
      {pendingPages.length > 0 && (
        <div className="mb-8">
          <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2">Zur Freigabe</h4>
          <div className="space-y-3 pt-3">
            {pendingPages.map((lp) => (
              <div key={lp.id} className="p-4 border rounded-md flex justify-between items-center bg-yellow-50 hover:shadow-sm transition-shadow">
                <div>
                  {lp.haupt_keyword && <p className="font-bold text-gray-800">{lp.haupt_keyword}</p>}
                  <p className="font-mono text-sm text-gray-600">{lp.url}</p>
                  {lp.aktuelle_position && <p className="text-xs text-gray-500 mt-1">Aktuelle Position: {lp.aktuelle_position}</p>}
                </div>
                <button
                  onClick={() => handleApprove(lp.id)}
                  className="bg-green-600 text-white py-1 px-3 rounded-md hover:bg-green-700 text-sm font-medium transition-colors"
                >
                  Freigeben
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvedPages.length > 0 && (
         <div>
          <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2">Freigegeben</h4>
          <div className="space-y-3 pt-3">
            {approvedPages.map((lp) => (
              <div key={lp.id} className="p-4 border rounded-md flex justify-between items-center opacity-70">
                <div>
                  {lp.haupt_keyword && <p className="font-bold text-gray-800">{lp.haupt_keyword}</p>}
                  <p className="font-mono text-sm text-gray-600">{lp.url}</p>
                </div>
                <span className="text-sm font-semibold text-green-700">✓ Freigegeben</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingPages.length === 0 && approvedPages.length === 0 && (
        <p className="text-gray-500">Aktuell gibt es keine ausstehenden oder freigegebenen Landingpages.</p>
      )}
    </div>
  );
}
