// src/components/kpi-card.tsx

import React from 'react';

// Eine kleine Komponente für die prozentuale Veränderung
const ChangeIndicator = ({ change }: { change: number | null }) => {
  if (change === null || isNaN(change)) {
    return null;
  }

  const isPositive = change > 0;
  const isNegative = change < 0;
  const colorClass = isPositive ? 'bg-green-100 text-green-800' : isNegative ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';
  const arrow = isPositive ? '↑' : isNegative ? '↓' : '';

  return (
    <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
      {arrow} {Math.abs(change)}%
    </span>
  );
};

interface KpiCardProps {
  title: string;
  value: number | undefined;
  change: number | undefined;
  isLoading: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, change, isLoading }) => {
  // Formatiert große Zahlen für eine bessere Lesbarkeit (z.B. 12345 -> 12.345)
  const formattedValue = value?.toLocaleString('de-DE') ?? '...';

  return (
    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-between">
      <h3 className="text-lg font-medium text-gray-500">{title}</h3>
      {isLoading ? (
        <div className="mt-2 h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
      ) : (
        <div className="mt-2 flex items-baseline">
          <p className="text-3xl font-bold text-gray-900">{formattedValue}</p>
          <ChangeIndicator change={change ?? null} />
        </div>
      )}
      <p className="text-sm text-gray-400 mt-1">Letzte 30 Tage vs. Vorperiode</p>
    </div>
  );
};

export default KpiCard;
