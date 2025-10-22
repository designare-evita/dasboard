// src/components/DateRangeSelector.tsx
'use client';

import React from 'react';

export type DateRangeOption = '30d' | '3m' | '6m' | '12m';

interface DateRangeSelectorProps {
  value: DateRangeOption;
  onChange: (value: DateRangeOption) => void;
  className?: string;
}

const rangeLabels: Record<DateRangeOption, string> = {
  '30d': 'Letzte 30 Tage',
  '3m': 'Letzte 3 Monate',
  '6m': 'Letzte 6 Monate',
  '12m': 'Letzte 12 Monate',
};

export function getRangeLabel(range: DateRangeOption): string {
  return rangeLabels[range];
}

export default function DateRangeSelector({ 
  value, 
  onChange, 
  className = '' 
}: DateRangeSelectorProps) {
  const options: DateRangeOption[] = ['30d', '3m', '6m', '12m'];

  return (
    <div className={`inline-flex rounded-lg border border-gray-300 bg-white ${className}`}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`px-4 py-2 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
            value === option
              ? 'bg-indigo-600 text-white'
              : 'text-gray-700 hover:bg-gray-50'
          } ${
            value !== option && option !== options[0] ? 'border-l border-gray-300' : ''
          }`}
        >
          {rangeLabels[option]}
        </button>
      ))}
    </div>
  );
}
