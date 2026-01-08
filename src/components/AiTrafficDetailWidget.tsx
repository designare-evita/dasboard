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

      const response = await fetch(`/api/ai-traffic-detail?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Fehler beim Laden');
      }

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
