// src/components/ProjectHeader.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Download, Hash, Globe, Calendar3 } from 'react-bootstrap-icons';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import { Button } from "@/components/ui/button";

interface ProjectHeaderProps {
  domain?: string;
  projectId?: string;
  faviconUrl?: string | null;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  onPdfExport: () => void;
}

export default function ProjectHeader({
  domain,
  projectId,
  faviconUrl,
  dateRange,
  onDateRangeChange,
  onPdfExport
}: ProjectHeaderProps) {

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 print:shadow-none print:border-none print:p-0 print:mb-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        
        {/* LINKE SEITE: Projekt Identität */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            {/* Favicon Container */}
            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
              {faviconUrl ? (
                <Image
                  src={faviconUrl}
                  alt={`${domain} Favicon`}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-contain"
                  onError={(e) => { 
                    (e.target as HTMLImageElement).style.display = 'none'; 
                    (e.target as HTMLImageElement).parentElement?.classList.add('fallback-icon');
                  }}
                />
              ) : (
                <Globe className="text-indigo-500" size={24} />
              )}
            </div>

            {/* Titel & Domain */}
            <div>
               <h1 className="text-2xl font-bold text-gray-900 leading-none tracking-tight">
                {domain || 'Projekt Dashboard'}
               </h1>
               <span className="text-sm text-gray-500 font-medium mt-1 block">
                 Übersicht & Performance
               </span>
            </div>
          </div>

          {/* ID Badge & Meta Info */}
          <div className="flex flex-wrap items-center gap-3 pl-1">
            {projectId && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-200 text-[11px] font-mono text-gray-500 select-all" title="Kopierbare Projekt-ID">
                <Hash size={10} className="text-gray-400" />
                {projectId}
              </div>
            )}
          </div>
        </div>
        
        {/* RECHTE SEITE: Actions (Date & Export) */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch sm:items-center">
          
          {/* Datums-Selektor Container */}
          <div className="relative z-20 bg-white rounded-lg shadow-sm">
            <DateRangeSelector
              value={dateRange}
              onChange={onDateRangeChange}
              className="w-full sm:w-auto"
            />
          </div>

          {/* PDF Export Button */}
          <Button
            onClick={onPdfExport}
            variant="outline"
            className="print:hidden h-[40px] gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
          >
            <Download size={16} />
            <span className="font-medium">PDF Bericht</span>
          </Button>
        </div>

      </div>
    </div>
  );
}
