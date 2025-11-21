// src/components/GlobalHeader.tsx
'use client';

import React from 'react';
import { Download, Hash, Globe } from 'react-bootstrap-icons';
import { Button } from "@/components/ui/button";

// Hier haben wir dateRange und onDateRangeChange entfernt,
// da diese im unteren Header verbleiben.
interface GlobalHeaderProps {
  domain?: string;
  projectId?: string;
  onPdfExport: () => void;
}

export default function GlobalHeader({
  domain,
  projectId,
  onPdfExport
}: GlobalHeaderProps) {

  return (
    <div className="w-full bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* LINKE SEITE: Identität */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-indigo-600">
             <Globe size={18} />
          </div>
          
          <div className="h-6 w-px bg-gray-200 mx-1"></div>

          <div className="flex flex-col">
             <h1 className="text-lg font-bold text-gray-900 leading-none">
               {domain || 'Projekt Dashboard'}
             </h1>
             {projectId && (
               <div className="flex items-center gap-1 mt-1">
                 <Hash size={10} className="text-gray-400" />
                 <span className="text-[10px] font-mono text-gray-500 tracking-wide select-all">
                   {projectId}
                 </span>
               </div>
             )}
          </div>
        </div>

        {/* RECHTE SEITE: PDF Button (Kein Datum hier) */}
        <div>
          <Button
            onClick={onPdfExport}
            variant="default"
            size="sm"
            className="gap-2 bg-[#188BDB] hover:bg-[#1479BF] text-white shadow-sm"
          >
            <Download size={14} />
            <span>PDF Download</span>
          </Button>
        </div>

      </div>
    </div>
  );
}
