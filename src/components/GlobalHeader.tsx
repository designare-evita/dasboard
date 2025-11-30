'use client';

import { House, ChevronRight, InfoCircle } from 'react-bootstrap-icons';
import Link from 'next/link';
import DateRangeSelector, { DateRangeOption } from '@/components/DateRangeSelector';

interface GlobalHeaderProps {
  domain?: string;
  projectId?: string;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  // onPdfExport kann entfernt werden, da es hier nicht mehr genutzt wird
  onPdfExport?: () => void; 
}

export default function GlobalHeader({ 
  domain, 
  dateRange, 
  onDateRangeChange 
}: GlobalHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* Linke Seite: Breadcrumbs & Info */}
        <div className="space-y-1">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link 
              href="/" 
              className="hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              <House size={14} />
              <span>Übersicht</span>
            </Link>
            
            {domain && (
              <>
                <ChevronRight size={10} className="text-gray-300" />
                <span className="font-medium text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm border border-gray-100">
                  {domain}
                </span>
              </>
            )}
          </nav>

          {/* Info Text unter der ID */}
          <div className="flex items-center gap-2 text-[10px] text-gray-400 pl-1">
            <InfoCircle size={10} />
            <span>GOOGLE Datenaktualisierung alle 48 Stunden | SEMRUSH Datenaktualisierung alle 14 Tage</span>
          </div>
        </div>

        {/* Rechte Seite: NUR Date Picker */}
        <div className="self-end md:self-auto">
           <DateRangeSelector value={dateRange} onChange={onDateRangeChange} />
        </div>
      </div>
    </div>
  );
}
