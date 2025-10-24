// src/hooks/use-api-data.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import type { DashboardData, AdminData } from '@/types/dashboard';

/**
 * Definiert einen benutzerdefinierten Fehlertyp für API-Anfragen,
 * der den HTTP-Statuscode enthält.
 */
class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Definiert den kombinierten Rückgabetyp der API,
 * der je nach Benutzerrolle variieren kann.
 */
type ApiDataResponse = (DashboardData & { role: 'BENUTZER' }) | (AdminData & { role: 'ADMIN' | 'SUPERADMIN' });

/**
 * Custom Hook zum Abrufen von Dashboard-Daten per react-query.
 * * Dieser Hook ist für das Caching der Client-Daten zuständig und
 * synchronisiert sich mit dem 48-Stunden-Cache des Servers.
 * * @param dateRange - Der ausgewählte Zeitraum (z.B. '30d', '3m').
 * @param projectId - (Optional) Die ID des Projekts, das abgerufen wird. 
 * Wird für BENUTZER-Rollen (Projekt-Dashboard) benötigt.
 */
export const useApiData = (dateRange: string, projectId?: string) => {
  
  const query = useQuery<ApiDataResponse, ApiError>({
    
    // Der Query Key ist entscheidend für das Caching.
    // Er enthält alle Parameter, die diese Anfrage einzigartig machen.
    queryKey: ['dashboardData', dateRange, projectId],

    queryFn: async () => {
      // Baut die URL dynamisch auf.
      const urlParams = new URLSearchParams({ dateRange });
      
      // Das `projectId` wird nur für das spezifische Projekt-Dashboard benötigt,
      // nicht für das Haupt-Dashboard (Admin/Superadmin).
      if (projectId) {
        urlParams.set('projectId', projectId);
      }
      
      const url = `/api/data?${urlParams.toString()}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        // Versucht, eine aussagekräftige Fehlermeldung aus dem API-Body zu lesen
        const errorData = await response.json().catch(() => ({})); // Fängt JSON-Parse-Fehler ab
        throw new ApiError(
          errorData.message || `API-Fehler: ${response.statusText}`, 
          response.status
        );
      }
      
      return response.json();
    },

    // --- ✅ START: CACHE-OPTIMIERUNGEN ---
    
    /**
     * staleTime: 48 Stunden (in Millisekunden)
     * Wir weisen react-query an, die Daten als "frisch" zu betrachten,
     * solange sie nicht älter als der Server-Cache (48h) sind.
     * Dies verhindert unnötige Refetches bei Tab-Wechsel oder Re-Mounts.
     */
    staleTime: 1000 * 60 * 60 * 48, // 48 Stunden

    /**
     * refetchOnWindowFocus: false
     * Verhindert, dass die Daten neu geladen werden, nur weil der Benutzer
     * zu einem anderen Tab und zurück gewechselt ist.
     */
    refetchOnWindowFocus: false,

    /**
     * refetchOnMount: false
     * Verhindert, dass die Komponente Daten neu lädt, wenn sie
     * (z.B. durch Routenwechsel) neu gemountet wird, solange
     * die Daten im Cache noch nicht "stale" (älter als 48h) sind.
     */
    refetchOnMount: false,

    /**
     * retry: 1
     * Versucht bei einem Fehler die Anfrage einmal erneut,
     * falls es sich um einen temporären Netzwerkfehler handelt.
     */
    retry: 1,
    
    // --- ✅ ENDE: CACHE-OPTIMIERUNGEN ---
  });

  return query;
};
