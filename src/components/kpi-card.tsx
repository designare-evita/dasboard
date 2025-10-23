// src/components/kpi-card.tsx
import React from 'react';
import { ArrowUp, ArrowDown } from 'react-bootstrap-icons';

interface KpiCardProps {
  title: string;
  value: number;
  change: number;
  isLoading?: boolean;
}

/**
 * KpiCard - Einzelne KPI-Karte mit Wert und Veränderung
 * 
 * Zeigt einen KPI-Wert mit optionalem Lade-Skeleton und 
 * prozentualer Veränderung (mit Pfeil-Icon) an.
 * 
 * @param title - Titel der KPI-Karte (z.B. "Klicks")
 * @param value - Aktueller Wert der KPI
 * @param change - Prozentuale Veränderung (positiv oder negativ)
 * @param isLoading - Optional: Zeigt Lade-Skeleton an
 */
export default function KpiCard({ title, value, change, isLoading = false }: KpiCardProps) {
  const isPositive = change >= 0;

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mb-2">
        {value.toLocaleString('de-DE')}
      </p>
      <div className={`flex items-center text-sm font-medium ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        {isPositive ? (
          <ArrowUp className="mr-1" size={16} />
        ) : (
          <ArrowDown className="mr-1" size={16} />
        )}
        <span>{Math.abs(change).toFixed(1)}%</span>
      </div>
    </div>
  );
}
