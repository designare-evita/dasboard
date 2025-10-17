// src/app/admin/edit/[id]/LandingpageManager.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Typ-Definition für eine Landingpage
// (Du solltest diese evtl. global in src/types/index.ts definieren)
interface Landingpage {
  id: string;
  domain: string;
  title: string;
  url: string;
  status: 'Offen' | 'Wartet auf Freigeabe' | 'Freigegeben' | 'Online';
}

type Props = { userId: string };

export default function LandingpageManager({ userId }: Props) {
  // State für Upload (aus deiner Originaldatei)
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // NEU: State für die Liste der Landingpages
  const [landingpages, setLandingpages] = useState<Landingpage[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // --- NEUE FUNKTIONEN ---

  /**
   * 1. LÄDT DIE LISTE DER LANDINGPAGES
   * Ruft die API-Route auf, die alle LPs für einen User zurückgibt.
   */landingpages/route.ts]
   */
  const fetchLandingpages = async () => {
    setIsLoadingList(true);
    try {
      const response = await fetch(`/api/users/${userId}/landingpages`);
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Landingpages.');
      }
      const data: Landingpage[] = await response.json();
      setLandingpages(data);
    } catch (error) {
      setMessage(`Listen-Fehler: ${(error as Error).message}`);
    } finally {
      setIsLoadingList(false);
    }
  };

  /**
   * 2. LÄDT DIE LISTE BEIM ERSTEN AUFRUF
   */
  useEffect(() => {
    if (userId) {
      void fetchLandingpages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /**
   * 3. LÖSCHT EINE LANDINGPAGE
   * Ruft die API-Route auf, die eine einzelne LP löscht.
   */route.ts]
   */
  const handleDelete = async (landingpageId: string) => {
    if (!window.confirm('Sicher, dass Sie diese Landingpage löschen möchten?')) {
      return;
    }
    setMessage('Lösche...');
    try {
      const response = await fetch(`/api/landingpages/${landingpageId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setMessage('Landingpage gelöscht.');
      void fetchLandingpages(); // Liste neu laden
    } catch (error) {
      setMessage(`Lösch-Fehler: ${(error as Error).message}`);
    }
  };

  // --- FUNKTIONEN FÜR UPLOAD (aus deiner Datei) ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Bitte wählen Sie zuerst eine Datei aus.');
      return;
    }
    setIsUploading(true);
    setMessage('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/users/${userId}/landingpages`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setMessage(result.message);
      setFile(null); // Datei-Input zurücksetzen
      // Visuelles Reset des File-Input-Feldes
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      // KORREKTUR: Liste nach Upload neu laden
      void fetchLandingpages();

    } catch (error) {
      setMessage(`Upload-Fehler: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Download-Funktion (aus deiner Datei)
  const downloadTemplate = async () => {
    const xlsx = await import('xlsx');
    // Vorlage mit Status-Spalte
    const ws = xlsx.utils.json_to_sheet([
      { domain: "beispieldomain.at", title: "SEO Text 1", url: "/seo-text-1", status: "Offen" },
      { domain: "beispieldomain.at", title: "SEO Text 2", url: "/seo-text-2", status: "Offen" },
    ]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Landingpages");
    xlsx.writeFile(wb, "redaktionsplan_vorlage.xlsx");
  };

  // --- JSX ---
  return (
    <>
      {/* Box 1: Upload (Bestehender Code von) */}
      <div className="bg-white p-8 rounded-lg shadow-md mt-8">
        <h3 className="text-xl font-bold mb-4">Redaktionsplan verwalten (Upload)</h3>

        {/* Message-Anzeige für alle Aktionen */}
        {message && (
          <p className="my-4 text-center p-3 bg-yellow-100 border border-yellow-300 rounded-md">{message}</p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">XLSX-Datei hochladen</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleUpload}
              disabled={isUploading || !file}
              className="bg-indigo-600 text-white py-2 px-6 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
            >
              {isUploading ? 'Wird hochgeladen...' : 'Hochladen'}
            </button>
            <button
              onClick={downloadTemplate}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              Vorlage herunterladen
            </button>
          </div>
        </div>
      </div>

      {/* Box 2: Auflistung (NEU) */}
      <div className="bg-white p-8 rounded-lg shadow-md mt-8">
        <h3 className="text-xl font-bold mb-4">Vorhandene Landingpages</h3>
        {isLoadingList ? (
          <p>Lade Liste...</p>
        ) : landingpages.length === 0 ? (
          <p className="text-gray-500">Für diesen Benutzer wurden noch keine Landingpages hochgeladen.</p>
        ) : (
          <ul className="space-y-3">
            {landingpages.map((lp) => (
              <li key={lp.id} className="p-3 border rounded-md flex justify-between items-center">
                <div className="flex-1">
                  <p className="font-semibold">{lp.title}</p>
                  <p className="text-sm text-gray-500">{lp.url}</p>
                  <p className="text-sm font-medium text-blue-600">{lp.status}</p>
                </div>
                <div className="flex gap-2">
                  
                  {/* DER NEUE "BEARBEITEN"-LINK */}
                  <Link
                    href={`/admin/edit-landingpage/${lp.id}`}
                    className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 text-sm"
                  >
                    Bearbeiten
                  </Link>

                  {/* DER NEUE "LÖSCHEN"-BUTTON */}
                  <button
                    onClick={() => void handleDelete(lp.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                  >
                    Löschen
                  </button>

                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
