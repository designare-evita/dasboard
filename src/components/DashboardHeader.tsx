// src/components/DashboardHeader.tsx
'use client';

import React from 'react';
import { Download } from 'react-bootstrap-icons';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

// 1. Wir definieren die Props, die der Header benötigt
interface DashboardHeaderProps {
  domain?: string;
  projectId?: string;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  onPdfExport: () => void; // Eine Funktion für den PDF-Export
}

// 2. Wir erstellen die Komponente
export default function DashboardHeader({
  domain,
  projectId,
  dateRange,
  onDateRangeChange,
  onPdfExport
}: DashboardHeaderProps) {

  // 3. Hier ist der komplette JSX-Code für den Header
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex flex-col gap-4">
        {/* Erste Zeile: Domain und PDF Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Dashboard: {domain}
            </h1>
            {projectId && (
              <p className="text-xs text-gray-400 mt-1">
                ID: {projectId}
              </p>
            )}
          </div>
          
          <button
            onClick={onPdfExport} // Wir verwenden die 'onPdfExport' Prop
            className="px-3 py-1 text-sm font-medium rounded-md transition-colors bg-indigo-600 text-white hover:bg-indigo-700 print:hidden flex items-center gap-2"
            title="Als PDF exportieren"
          >
            <Download size={16} />
            <span>PDF</span>
          </button>
        </div>

        {/* Zweite Zeile: Zeitraum-Buttons */}
        <div>
          <DateRangeSelector
            value={dateRange}
            onChange={onDateRangeChange}
          />
        </div>
      </div>
    </div>
  );
}
