// src/components/GlobalHeader.tsx
'use client';

import React from 'react';
import { Download, Hash, Globe } from 'react-bootstrap-icons';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import { Button } from "@/components/ui/button";

interface GlobalHeaderProps {
  domain?: string;
  projectId?: string;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  onPdfExport: () => void;
}

export default function GlobalHeader({
  domain,
  projectId,
  dateRange,
  onDateRangeChange,
  onPdfExport
}: GlobalHeaderProps) {

  return (
    <div className="w-full mb-8 border-b border-gray-200 pb-6 bg-white/50 backdrop-blur-sm sticky top-0 z-20 print:static print:bg-white">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        
        {/* LINKE SEITE: Projekt Identität */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Globe size={20} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight leading-none">
              {domain || 'Projekt Dashboard'}
            </h1>
          </div>

          {/* ID Badge */}
          {projectId && (
            <div className="flex items-center gap-2 ml-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[11px] font-mono border border-gray-200 select-all transition-colors hover:bg-gray-200 hover:text-gray-700 cursor-copy" title="Projekt ID kopieren">
                <Hash size={10} />
                ID: {projectId}
              </span>
            </div>
          )}
        </div>

        {/* RECHTE SEITE: Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          
          {/* Datums-Auswahl */}
          <div className="shadow-sm rounded-lg bg-white">
            <DateRangeSelector
              value={dateRange}
              onChange={onDateRangeChange}
            />
          </div>

          {/* PDF Download */}
          <Button
            onClick={onPdfExport}
            variant="default" // Nutzt eure Primary Color (#188BDB)
            className="print:hidden gap-2 shadow-sm h-[40px] font-medium px-5"
          >
            <Download size={16} />
            PDF Download
          </Button>
        </div>

      </div>
    </div>
  );
}
