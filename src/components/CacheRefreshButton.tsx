// src/components/CacheRefreshButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatabaseX, ArrowRepeat } from 'react-bootstrap-icons';
import { toast } from 'sonner';

interface Props {
  projectId: string;
}

export default function CacheRefreshButton({ projectId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleClearCache = async () => {
    // Sicherheitsabfrage
    if (!confirm('Möchten Sie den Cache für dieses Projekt wirklich löschen? Die nächsten Datenabrufe werden dadurch langsamer, da sie live von Google geladen werden.')) {
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Lösche Cache...');

    try {
      const response = await fetch('/api/clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: projectId }), // API erwartet 'userId'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Löschen des Caches');
      }

      toast.success('Cache erfolgreich gelöscht. Daten werden aktualisiert...', { id: toastId });
      
      // Seite neu laden, um frische Daten zu holen
      router.refresh(); 
      
    } catch (error) {
      console.error(error);
      toast.error('Fehler beim Löschen des Caches', { 
        id: toastId,
        description: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClearCache}
      disabled={isLoading}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50 shadow-sm"
      title="Erzwingt eine Aktualisierung der Daten von Google beim nächsten Laden"
    >
      {isLoading ? (
        <ArrowRepeat className="animate-spin" size={14} />
      ) : (
        <DatabaseX size={14} />
      )}
      <span>Cache leeren</span>
    </button>
  );
}
