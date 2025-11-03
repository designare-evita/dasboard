// src/components/DashboardHeader.tsx (KORRIGIERT - Domain-Fallback)
'use client';

import React from 'react';
import { Download } from 'react-bootstrap-icons';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  domain?: string;
  projectId?: string;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  onPdfExport: () => void;
}

export default function DashboardHeader({
  domain,
  projectId,
  dateRange,
  onDateRangeChange,
  onPdfExport
}: DashboardHeaderProps) {

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        {/* Linke Seite: Titel und ID */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {/* ✅ KORREKTUR: Zeige nur "Dashboard" wenn domain fehlt */}
            Dashboard{domain ? `: ${domain}` : ''}
          </h1>
          {projectId && (
            <p className="text-xs text-gray-400 mt-1">
              ID: {projectId}
            </p>
          )}
          <span className="text-gray-500 text-sm hidden lg:block">
            💡 GOOGLE Datenaktualisierung alle 48 Stunden | SEMRUSH Datenaktualisierung alle 14 Tage.
          </span>
        </div>
        
        {/* Rechte Seite: Wrapper für Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Zeitraum-Buttons */}
          <DateRangeSelector
            value={dateRange}
            onChange={onDateRangeChange}
            className="w-full sm:w-auto"
          />
          
          {/* PDF Button */}
          <Button
            onClick={onPdfExport}
            title="Als PDF exportieren"
            variant="outline"
            className="print:hidden gap-2 w-full sm:w-auto"
          >
            <Download size={16} />
            <span>PDF</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
