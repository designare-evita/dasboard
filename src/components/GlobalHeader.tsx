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
  userEmail?: string; // ✅ NEU: E-Mail für "Betreut durch"
}

export default function GlobalHeader({
  domain,
  projectId,
  dateRange,
  onDateRangeChange,
  userRole = 'USER',
  userEmail = '' // ✅ NEU: Default
}: GlobalHeaderProps) {

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';

  return (
    <div className="card-glass p-6 mb-6 print:hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* LINKE SEITE */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50/80 p-3 rounded-xl backdrop-blur-sm shadow-sm border border-indigo-100/50">
             <Globe size={28} />
          </div>
          
          <div className="h-12 w-px bg-gray-200/60 mx-1 hidden sm:block"></div>

          <div className="flex flex-col justify-center">
             <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
               <h1 className="text-2xl font-bold text-gray-900 leading-none tracking-tight">
                 {domain || 'Projekt Dashboard'}
               </h1>
               
               {/* ✅ KORRIGIERT: Dynamische E-Mail statt statischem Text */}
               {userEmail && (
                 <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-100/80 shadow-sm">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    Betreut durch: {userEmail}
                 </div>
               )}
             </div>

             <div className="flex flex-col gap-1">
               
               {/* ID nur für Admins sichtbar */}
               {isAdmin && projectId && (
                 <div className="flex items-center gap-1.5 animate-in fade-in duration-300">
                   <ShieldLock size={10} className="text-gray-400" />
                   <span className="text-xs font-bold text-gray-400">ID:</span>
                   <span className="text-xs font-mono text-gray-500 tracking-wide select-all bg-gray-50 px-1 rounded border border-gray-100">
                     {projectId}
                   </span>
                 </div>
               )}
               
               <span className="text-gray-500 text-xs flex items-center gap-1">
                 <span>Google Updates: 48h</span>
                 <span className="text-gray-300">•</span>
                 <span>Semrush Updates: 14 Tage</span>
               </span>
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
