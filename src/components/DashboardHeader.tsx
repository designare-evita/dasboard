// src/components/DashboardHeader.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Download } from 'react-bootstrap-icons';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  domain?: string; // Bleibt, wird aber nicht mehr angezeigt (nur für Favicon-Logik)
  projectId?: string;
  faviconUrl?: string | null;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  onPdfExport: () => void;
}

export default function DashboardHeader({
  domain,
  projectId,
  faviconUrl,
  dateRange,
  onDateRangeChange,
  onPdfExport
}: DashboardHeaderProps) {

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        {/* Linke Seite: Titel und ID */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            {/* Favicon bleibt */}
            {faviconUrl && (
              <Image
                src={faviconUrl}
                alt="Projekt-Favicon"
                width={24}
                height={24}
                className="w-6 h-6 rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            
            {/* KORREKTUR: Domain entfernt, stattdessen "Statistiken" */}
            <span>Statistiken</span>
          </h1>
          
          {/* ID und Info-Text bleiben */}
          {projectId && (
            <p className="text-xs text-gray-400 mt-1">
              ID: {projectId}
            </p>
          )}
          <span className="text-gray-500 text-sm hidden lg:block">
            💡 GOOGLE Datenaktualisierung alle 48 Stunden | SEMRUSH Datenaktualisierung alle 14 Tage.
          </span>
        </div>
        
        {/* Rechte Seite: Wrapper für Buttons (unverändert) */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <DateRangeSelector
            value={dateRange}
            onChange={onDateRangeChange}
            className="w-full sm:w-auto"
          />
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
