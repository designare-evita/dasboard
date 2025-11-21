// src/components/DashboardHeader.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

interface DashboardHeaderProps {
  domain?: string;
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
        
        {/* Linke Seite: Favicon und Info-Text */}
        <div>
          {/* Favicon (falls vorhanden) */}
          {faviconUrl && (
            <div className="mb-2">
              <Image
                src={faviconUrl}
                alt="Projekt-Favicon"
                width={24}
                height={24}
                className="w-6 h-6 rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          
          {/* Info Text */}
          <span className="text-gray-500 text-sm hidden lg:block">
            💡 GOOGLE Datenaktualisierung alle 48 Stunden | SEMRUSH Datenaktualisierung alle 14 Tage.
          </span>
        </div>
        
        {/* Rechte Seite: Nur noch DateRangeSelector */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <DateRangeSelector
            value={dateRange}
            onChange={onDateRangeChange}
            className="w-full sm:w-auto"
          />
        </div>
      </div>
    </div>
  );
}
