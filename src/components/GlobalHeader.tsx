// src/components/GlobalHeader.tsx
'use client';

import React from 'react';
import { Download, Globe } from 'react-bootstrap-icons';
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
    // ÄNDERUNG: 'card-glass' statt 'bg-white shadow-md border...'
    <div className="card-glass p-6 mb-6 print:hidden">
      <div className="flex items-center justify-between">
        
        {/* LINKE SEITE */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50/80 p-3 rounded-xl backdrop-blur-sm">
             <Globe size={28} />
          </div>
          
          <div className="h-12 w-px bg-gray-200/60 mx-1 hidden sm:block"></div>

          <div className="flex flex-col justify-center">
             <h1 className="text-2xl font-bold text-gray-900 leading-none tracking-tight">
               {domain || 'Projekt Dashboard'}
             </h1>
             {projectId && (
               <div className="flex items-center gap-1.5 mt-1.5">
                 <span className="text-xs font-bold text-gray-400">ID:</span>
                 <span className="text-xs font-mono text-gray-500 tracking-wide select-all">
                   {projectId}
                 </span>
               </div>
             )}
          </div>
        </div>

        {/* RECHTE SEITE */}
        <div>
          <Button
            onClick={onPdfExport}
            variant="default"
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
