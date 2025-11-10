// src/components/CustomerLandingpagesView.tsx
'use client';

import { useState, useEffect } from 'react';

// --- Typdefinitionen ---
interface Landingpage {
  id: number;
  url: string;
  haupt_keyword: string | null;
  weitere_keywords: string[] | null;
  suchvolumen: number | null;
  aktuelle_position: number | null;
  status: 'pending' | 'approved' | 'rejected';
}

interface CustomerLandingpagesViewProps {
  userId: string;
}

// --- Hauptkomponente ---
export default function CustomerLandingpagesView({ userId }: CustomerLandingpagesViewProps) {
  const [landingpages, setLandingpages] = useState<Landingpage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ✨ KORREKTUR: Die fetch-Funktion wird direkt im Hook definiert.
    // Dadurch wird die 'exhaustive-deps'-Warnung behoben.
    const fetchLandingpagesForUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/users/${userId}/landingpages`);
        if (!response.ok) {
          throw new Error('Netzwerkantwort war nicht in Ordnung');
        }
        const data = await response.json();
        if (Array.isArray(data)) {
          setLandingpages(data);
        } else {
          throw new Error("Daten sind kein Array");
        }
      } catch (e) {
        if (e instanceof Error) {
          setError(`Fehler beim Laden der Landingpages: ${e.message}`);
        } else {
          setError("Ein unbekannter Fehler ist aufgetreten.");
        }
        setLandingpages([]); // Im Fehlerfall auf leeres Array zurücksetzen
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchLandingpagesForUser();
    }
  }, [userId]); // userId wird als Abhängigkeit beibehalten

  if (loading) {
    return <div className="text-center p-4">Lade Landingpages...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-600">{error}</div>;
  }

  const approvedPages = landingpages.filter(lp => lp.status === 'approved');

  if (approvedPages.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md mt-8">
        <h3 className="text-xl font-bold mb-4">Deine freigegebenen Landingpages</h3>
        <p className="text-gray-500">Aktuell sind keine Landingpages für dich freigegeben.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-8">
      <h3 className="text-xl font-bold mb-4">Deine freigegebenen Landingpages</h3>
      <div className="space-y-4">
        {approvedPages.map((lp) => (
          <div key={lp.id} className="p-4 border rounded-md">
            {lp.haupt_keyword && <p className="font-bold text-gray-800">{lp.haupt_keyword}</p>}
            <p className="font-mono text-sm text-gray-600">{lp.url}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
