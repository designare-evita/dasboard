// src/app/admin/edit/[id]/LandingpageManager.tsx
'use client';

import { useState } from 'react';
// Import für den Template-Download
import * as XLSX from '@e965/xlsx'; 

type Props = { userId: string };

export default function LandingpageManager({ userId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
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
      
      if (!response.ok) {
        throw new Error(result.message || 'Upload fehlgeschlagen');
      }
      
      setMessage(`✅ ${result.message}`);
      setFile(null);
      // Reset des File Inputs über DOM-Manipulation oder Key-Reset wäre hier sauberer, 
      // aber für dieses Beispiel reicht das Leeren des States.
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      setMessage(`❌ Fehler: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Funktion zum Erstellen und Herunterladen der XLSX-Vorlage
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
        ["Landingpage-URL", "Haupt-Keyword", "Weitere Keywords", "Suchvolumen", "Aktuelle Pos."],
        ["https://beispiel.de/seite-1", "Beispiel Keyword", "Noch ein Keyword", 1000, 15]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Landingpages");
    XLSX.writeFile(wb, "redaktionsplan_vorlage.xlsx");
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md mt-8">
      <h3 className="text-xl font-bold mb-4">Redaktionsplan verwalten</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700">
            Excel (XLSX) oder CSV Datei hochladen
          </label>
          <input
            type="file"
            accept=".xlsx, .csv" // HIER: CSV hinzugefügt
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <p className="text-xs text-gray-500 mt-1">
            Erwartete Spalten: Landingpage-URL, Haupt-Keyword, Weitere Keywords, Suchvolumen, Aktuelle Pos.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleUpload}
            disabled={isUploading || !file}
            className="bg-indigo-600 text-white py-2 px-6 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 transition-colors"
          >
            {isUploading ? 'Wird verarbeitet...' : 'Hochladen'}
          </button>
          <button
            onClick={downloadTemplate}
            className="text-sm text-indigo-600 hover:underline"
          >
            Vorlage herunterladen (.xlsx)
          </button>
        </div>
        
        {message && (
          <div className={`text-sm p-3 rounded border ${message.startsWith('❌') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
