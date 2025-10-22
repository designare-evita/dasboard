// src/components/DateRangeSelector.tsx
'use client';

import React from 'react';
import { Calendar } from 'react-bootstrap-icons';

export type DateRangeOption = '30d' | '3m' | '6m' | '12m';

interface DateRangeSelectorProps {
  selectedRange: DateRangeOption;
  onRangeChange: (range: DateRangeOption) => void;
  isLoading?: boolean;
}

const rangeLabels: Record<DateRangeOption, string> = {
  '30d': '30 Tage',
  '3m': '3 Monate',
  '6m': '6 Monate',
  '12m': '12 Monate',
};

export default function DateRangeSelector({ 
  selectedRange, 
  onRangeChange,
  isLoading = false 
}: DateRangeSelectorProps) {
  const ranges: DateRangeOption[] = ['30d', '3m', '6m', '12m'];

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-700">
          <Calendar size={18} />
          <span className="text-sm font-medium">Zeitraum:</span>
        </div>
        
        <div className="flex gap-2">
          {ranges.map((range) => (
            <button
              key={range}
              onClick={() => onRangeChange(range)}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                selectedRange === range
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {rangeLabels[range]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Hilfsfunktion: Berechnet Start- und Enddatum basierend auf dem gewählten Zeitraum
 */
export function getDateRange(range: DateRangeOption): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1); // Gestern (aktuellste vollständige Daten)
  
  const startDate = new Date(endDate);
  
  switch (range) {
    case '30d':
      startDate.setDate(startDate.getDate() - 29); // 30 Tage inkl. heute
      break;
    case '3m':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case '6m':
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case '12m':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Hilfsfunktion: Berechnet das vorherige Zeitfenster für Vergleichswerte
 */
export function getPreviousDateRange(range: DateRangeOption): { startDate: string; endDate: string } {
  const current = getDateRange(range);
  const currentStart = new Date(current.startDate);
  const currentEnd = new Date(current.endDate);
  
  // Berechne die Länge des aktuellen Zeitraums in Tagen
  const daysDiff = Math.floor((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Vorheriger Zeitraum endet einen Tag vor dem aktuellen Start
  const endDate = new Date(currentStart);
  endDate.setDate(endDate.getDate() - 1);
  
  // Startdatum ist die gleiche Anzahl Tage davor
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - daysDiff + 1);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Hilfsfunktion: Gibt ein lesbares Label für den Zeitraum zurück
 */
export function getRangeLabel(range: DateRangeOption): string {
  return rangeLabels[range];
}
