// src/components/AiTrafficDetailWidget.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import AiTrafficDetailCard from './AiTrafficDetailCard';
import type { AiTrafficDetailData } from './AiTrafficDetailCard';

interface AiTrafficDetailWidgetProps {
  projectId?: string;
  dateRange?: string;
  className?: string;
}

export default function AiTrafficDetailWidget({
  projectId,
  dateRange = '30d',
  className
}: AiTrafficDetailWidgetProps) {
  const [data, setData] = useState<AiTrafficDetailData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const params = new URLSearchParams({ dateRange });
      if (projectId) {
        params.set('projectId', projectId);
      }

      const url = `/api/ai-traffic-detail?${params.toString()}`;
      console.log('[AiTrafficDetailWidget] Fetching:', url);
      
      const response = await fetch(url);
      
      // Prüfe ob Response OK ist
      if (!response.ok) {
        // Versuche JSON zu parsen, aber fange Fehler ab
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Response war kein JSON (z.B. HTML Error Page)
          const text = await response.text();
          console.error('[AiTrafficDetailWidget] Non-JSON Response:', text.substring(0, 200));
          errorMessage = 'Server-Fehler - bitte später erneut versuchen';
        }
        throw new Error(errorMessage);
      }

      // Versuche JSON zu parsen
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('[AiTrafficDetailWidget] JSON Parse Error:', parseError);
        throw new Error('Ungültige Server-Antwort');
      }

      console.log('[AiTrafficDetailWidget] Data received:', result.data ? 'OK' : 'null');
      setData(result.data || undefined);
      
    } catch (err) {
      console.error('[AiTrafficDetailWidget] Fetch Error:', err);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
  };

  return (
    <AiTrafficDetailCard
      data={data}
      isLoading={isLoading}
      dateRange={dateRange}
      error={error}
      onRefresh={handleRefresh}
      className={className}
    />
  );
}
