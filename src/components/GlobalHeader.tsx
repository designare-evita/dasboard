// src/components/GlobalHeader.tsx
'use client';

import React from 'react';
import { Globe, ShieldLock } from 'react-bootstrap-icons'; 
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';

interface GlobalHeaderProps {
  domain?: string;
  projectId?: string;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  userRole?: string;
  userEmail?: string;
}

export default function GlobalHeader({
  domain,
  projectId,
  dateRange,
  onDateRangeChange,
  userRole = 'USER',
  userEmail = ''
}: GlobalHeaderProps) {

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  return (
    // ✅ ÄNDERUNG: sticky, top-0, z-50 hinzugefügt. 
    // bg-white/95 sorgt dafür, dass durchscrollender Inhalt nicht stört (passend zum Glass-Look).
    <div className="sticky top-0 z-50 card-glass p-6 mb-6 print:hidden bg-white/95 backdrop-blur-sm transition-all duration-200 border-b border-gray-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* LINKE SEITE */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50/80 p-3 rounded-xl backdrop-blur-sm shadow-sm border border-indigo-100/50">
             <Globe size={28} />
          </div>
          
          <div className="h-12 w-px bg-gray-200/60 mx-1 hidden sm:block"></div>

          <div>
             <div className="flex items-center gap-2 mb-1">
               <h1 className="text-xl font-bold text-gray-900 tracking-tight">{domain || 'Projekt Dashboard'}</h1>
               {isAdmin && (
                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                   <ShieldLock size={10} />
                   <span>Admin</span>
                 </span>
               )}
             </div>

             <div className="flex flex-col gap-1">
               {projectId && (
                  <span className="text-[10px] text-gray-400 font-mono tracking-wide">ID: {projectId}</span>
               )}
               
               <span className="text-gray-500 text-xs flex items-center gap-1">
                 <span>Google Updates: 48h</span>
                 <span className="text-gray-300">•</span>
                 <span>Semrush Updates: 14 Tage</span>
               </span>
               
               {userEmail && (
                 <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full text-[10px] font-bold tracking-wider bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-100/80 shadow-sm w-fit">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="uppercase">Betreut durch:</span>
                    <span className="lowercase font-medium">{userEmail}</span>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* RECHTE SEITE */}
        <div className="w-full sm:w-auto">
          <DateRangeSelector
            value={dateRange}
            onChange={onDateRangeChange}
            className="w-full sm:w-auto shadow-sm"
          />
        </div>

      </div>
    </div>
  );
}
