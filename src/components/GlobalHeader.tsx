// src/components/GlobalHeader.tsx
'use client';

import React from 'react';
import { Download, Hash, Globe } from 'react-bootstrap-icons';
import { Button } from "@/components/ui/button";

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
    // Höhe auf h-24 erhöht (ca. 30% mehr als h-16)
    <div className="w-full bg-white border-b border-gray-200 sticky top-0 z-50 shadow-md print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
        
        {/* LINKE SEITE: Identität (Vergrößert) */}
        <div className="flex items-center gap-5">
          {/* Icon vergrößert */}
          <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 p-2.5 rounded-xl">
             <Globe size={28} />
          </div>
          
          <div className="h-10 w-px bg-gray-200 mx-1"></div>

          <div className="flex flex-col justify-center">
             {/* Titel deutlich größer */}
             <h1 className="text-2xl font-bold text-gray-900 leading-none tracking-tight">
               {domain || 'Projekt Dashboard'}
             </h1>
             {projectId && (
               <div className="flex items-center gap-1.5 mt-1.5">
                 <Hash size={12} className="text-gray-400" />
                 <span className="text-xs font-mono text-gray-500 tracking-wide select-all">
                   {projectId}
                 </span>
               </div>
             )}
          </div>
        </div>

        {/* RECHTE SEITE: Aktionen */}
        <div>
          <Button
            onClick={onPdfExport}
            variant="default"
            // Button etwas größer für die Balance
            className="h-10 px-5 gap-2.5 bg-[#188BDB] hover:bg-[#1479BF] text-white shadow-sm text-sm font-medium rounded-lg"
          >
            <Download size={16} />
            <span>PDF Download</span>
          </Button>
        </div>

      </div>
    </div>
  );
}
