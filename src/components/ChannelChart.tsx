// src/components/ChannelChart.tsx
'use client';
import { ChartEntry } from '@/lib/dashboard-shared';
import KpiPieChart from './charts/KpiPieChart';

interface Props {
  data?: ChartEntry[];
  isLoading?: boolean;
  error?: string | null; // +++ KORREKTUR: error-Prop hinzugefügt +++
}

export default function ChannelChart({ data, isLoading, error }: Props) { // +++ KORREKTUR: error empfangen +++
  return (
    <KpiPieChart
      data={data}
      isLoading={isLoading}
      title="Zugriffe nach Channel"
      error={error} // +++ KORREKTUR: error weitergeben +++
    />
  );
}
