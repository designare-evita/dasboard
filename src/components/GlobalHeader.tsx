// src/components/GlobalHeader.tsx
'use client';

import React from 'react';
import { Globe } from 'react-bootstrap-icons';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

interface GlobalHeaderProps {
  domain?: string;
  projectId?: string;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}

export default function GlobalHeader({
  domain,
  projectId,
  dateRange,
  onDateRangeChange
}: GlobalHeaderProps) {

  return (
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
               <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-1.5">
                   <span className="text-xs font-bold text-gray-400">ID:</span>
                   <span className="text-xs font-mono text-gray-500 tracking-wide select-all">
                     {projectId}
                   </span>
                 </div>
                 <span className="text-gray-500 text-xs">
                   GOOGLE Datenaktualisierung alle 48 Stunden | SEMRUSH Datenaktualisierung alle 14 Tage.
                 </span>
               </div>
             )}
          </div>
        </div>

        {/* RECHTE SEITE */}
        <div>
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
