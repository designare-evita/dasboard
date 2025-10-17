// src/app/admin/edit-landingpage/[id]/page.tsx
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// Annahme: Du hast einen Landingpage-Typ in src/types/index.ts
interface Landingpage {
  id: string;
  domain: string;
  title: string;
  url: string;
  status: 'Offen' | 'Wartet auf Freigabe' | 'Freigegeben' | 'Online';
}

export default function EditLandingpagePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [landingpage, setLandingpage] = useState<Landingpage | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Landingpage['status']>('Offen');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  // 1. Daten der Landingpage laden
  useEffect(() => {
    if (id) {
      const fetchLandingpage = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/landingpages/${id}`);
          if (!response.ok) {
            setMessage('Fehler beim Laden der Landingpage.');
            return;
          }
          const data: Landingpage = await response.json();
          setLandingpage(data);
          setTitle(data.title);
          setUrl(data.url);
          setStatus(data.status);
        } catch (error) {
          setMessage('Server-Verbindungsfehler.');
        } finally {
          setIsLoading(false);
        }
      };
      void fetchLandingpage();
    }
  }, [id]);

  // 2. Änderungen speichern
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('Speichere...');

    const response = await fetch(`/api/landingpages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, status }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Erfolgreich gespeichert!');
      // Zurück zur Benutzer-Edit-Seite (oder wohin du willst)
      // Wir brauchen die userId, die wir hier nicht haben. 
      // Am einfachsten ist es, zurück zur Haupt-Admin-Seite zu gehen.
      // Besser: router.back()
      router.back(); 
    } else {
      setMessage(`Fehler: ${result.message || 'Unbekannter Fehler'}`);
    }
  };

  // Auth-Check
  if (authStatus === 'loading') return <div className="p-8 text-center">Lade...</div>;
  if (authStatus === 'unauthenticated' || (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN')) {
    router.push('/');
    return null;
  }
  
  if (isLoading) return <div className="p-8 text-center">Lade Landingpage-Daten...</div>;
  if (!landingpage) return <div className="p-8 text-center text-red-500">{message || 'Landingpage nicht gefunden.'}</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Landingpage bearbeiten</h1>
      <p className="mb-4 text-gray-600">
        Domain: <span className="font-semibold">{landingpage.domain}</span>
      </p>

      {message && (
        <p className="my-4 text-center p-3 bg-yellow-100 border border-yellow-300 rounded-md">{message}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
        <div>
          <label className="block text-sm font-medium text-gray-700">Titel</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">URL (Relativ, z.B. /seo-text)</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Status (Redaktionsplan)</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Landingpage['status'])}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {/* Diese Status basieren auf deinem DB-Schema */}
            <option value="Offen">Offen</option>
            <option value="Wartet auf Freigabe">Wartet auf Freigabe</option>
            <option value="Freigegeben">Freigegeben</option>
            <option value="Online">Online</option>
          </select>
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
          Änderungen speichern
        </button>
      </form>
    </div>
  );
}
