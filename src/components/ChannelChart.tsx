// src/components/ChannelChart.tsx
'use client';
import { ChartEntry } from '@/lib/dashboard-shared';
import KpiPieChart from '@/components/charts/KpiPieChart';

interface Props {
  data?: ChartEntry[];
  isLoading?: boolean;
}

export default function ChannelChart({ data, isLoading }: Props) {
  return (
    <KpiPieChart
      data={data}
      isLoading={isLoading}
      title="Zugriffe nach Channel"
    />
  );
}
