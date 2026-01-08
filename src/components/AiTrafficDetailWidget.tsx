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
      
      // Erst als Text lesen, dann parsen
      const responseText = await response.text();
      
      // Versuche JSON zu parsen
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[AiTrafficDetailWidget] JSON Parse Error:', parseError);
        console.error('[AiTrafficDetailWidget] Response was:', responseText.substring(0, 500));
        throw new Error('Ungültige Server-Antwort');
      }

      // Prüfe ob Response OK ist
      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`);
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
