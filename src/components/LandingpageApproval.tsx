// src/components/LandingpageApproval.tsx
'use client';

import { useSession } from 'next-auth/react';
import useSWR, { mutate } from 'swr';

// Definieren, wie eine Landingpage aussieht
interface Landingpage {
  id: number;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  haupt_keyword?: string;
  aktuelle_position?: number;
}

// Eine einfache Funktion, um Daten von unserer API zu holen
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LandingpageApproval() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // SWR ist ein Hook, der automatisch die Daten für uns holt und aktuell hält
  const { data: landingpages, error, isLoading } = useSWR<Landingpage[]>(
    userId ? `/api/users/${userId}/landingpages` : null,
    fetcher
  );

  // Funktion, die aufgerufen wird, wenn der "Freigeben"-Button geklickt wird
  const handleApprove = async (id: number) => {
    try {
      await fetch(`/api/landingpages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      // SWR sagen, dass es die Daten neu laden soll, damit die UI sich aktualisiert
      mutate(`/api/users/${userId}/landingpages`);
    } catch (err) {
      console.error("Fehler bei der Freigabe:", err);
    }
  };

  if (isLoading) return <div>Lade Redaktionsplan...</div>;
  if (error) return <div className="text-red-500">Fehler beim Laden des Redaktionsplans.</div>;
  if (!landingpages || landingpages.length === 0) {
    return null; // Nichts anzeigen, wenn keine Landingpages da sind
  }

  const pendingPages = landingpages.filter(lp => lp.status === 'pending');
  const approvedPages = landingpages.filter(lp => lp.status === 'approved');

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4">Redaktionsplan</h3>
      
      {/* Bereich für ausstehende Freigaben */}
      {pendingPages.length > 0 && (
        <>
          <h4 className="text-md font-semibold text-gray-700 mb-3">Zur Freigabe</h4>
          <div className="space-y-3">
            {pendingPages.map((lp) => (
              <div key={lp.id} className="p-4 border rounded-md flex justify-between items-center bg-yellow-50">
                <div>
                  {lp.haupt_keyword && <p className="font-bold">{lp.haupt_keyword}</p>}
                  <p className="font-mono text-sm text-gray-600">{lp.url}</p>
                  {lp.aktuelle_position && <p className="text-xs text-gray-500 mt-1">Aktuelle Position: {lp.aktuelle_position}</p>}
                </div>
                <button
                  onClick={() => handleApprove(lp.id)}
                  className="bg-green-600 text-white py-1 px-3 rounded-md hover:bg-green-700 text-sm"
                >
                  Freigeben
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bereich für bereits freigegebene Seiten */}
      {approvedPages.length > 0 && (
         <div className="mt-6">
          <h4 className="text-md font-semibold text-gray-700 mb-3">Freigegeben</h4>
          <div className="space-y-3">
            {approvedPages.map((lp) => (
              <div key={lp.id} className="p-4 border rounded-md flex justify-between items-center opacity-70">
                <div>
                  {lp.haupt_keyword && <p className="font-bold">{lp.haupt_keyword}</p>}
                  <p className="font-mono text-sm text-gray-600">{lp.url}</p>
                </div>
                <span className="text-sm font-semibold text-green-700">✓ Freigegeben</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
