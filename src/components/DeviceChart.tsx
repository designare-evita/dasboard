// src/components/DeviceChart.tsx
'use client';
import { ChartEntry } from '@/lib/dashboard-shared';
import KpiPieChart from './charts/KpiPieChart';

interface Props {
  data?: ChartEntry[];
  isLoading?: boolean;
}

export default function DeviceChart({ data, isLoading }: Props) {
  return (
    <KpiPieChart
      data={data}
      isLoading={isLoading}
      title="Zugriffe nach Endgerät"
    />
  );
}
