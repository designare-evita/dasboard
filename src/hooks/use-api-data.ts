// src/hooks/use-api-data.ts
'use client';

import { useState, useEffect } from 'react';

// HIER IST DIE KORREKTUR: Wir exportieren die Funktion als Standard-Export
export default function useApiData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wir definieren die Funktion innerhalb von useEffect, um sie nur bei Bedarf zu erstellen
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(url);
        const result = await response.json();
        
        // Verbesserte Fehlerbehandlung: Prüft, ob die Antwort erfolgreich war
        if (!response.ok) {
          throw new Error(result.message || `API-Fehler: Status ${response.status}`);
        }

        setData(result);
      } catch (err) {
        // Stellt sicher, dass 'err' als Error-Objekt behandelt wird
        const errorMessage = err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.';
        setError(errorMessage);
        console.error("Fehler im useApiData Hook:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [url]); // Dieser Hook wird erneut ausgeführt, wenn sich die URL ändert

  return { data, isLoading, error };
}
