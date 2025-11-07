// src/components/DashboardHeader.tsx
'use client';

import React from 'react';
// ✅ NEU: Image von next/image importieren
import Image from 'next/image';
import { Download } from 'react-bootstrap-icons';
import DateRangeSelector, { type DateRangeOption } from '@/components/DateRangeSelector';
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  domain?: string;
  projectId?: string;
  faviconUrl?: string | null; // ✅ NEU: Favicon-URL hinzugefügt
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  onPdfExport: () => void;
}

export default function DashboardHeader({
  domain,
  projectId,
  faviconUrl, // ✅ NEU: Prop hier entgegennehmen
  dateRange,
  onDateRangeChange,
  onPdfExport
}: DashboardHeaderProps) {

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        {/* Linke Seite: Titel und ID */}
        <div>
          {/* ✅ START: h1-Tag angepasst für Favicon */}
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <span>Dashboard</span>
            {faviconUrl && (
              <Image
                src={faviconUrl}
                alt="Projekt-Favicon"
                width={24} 
                height={24}
                className="w-6 h-6 rounded" // Stellt sicher, dass es 24px ist
                // Versteckt das Icon, wenn es nicht geladen werden kann
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            {/* Zeigt die Domain mit Doppelpunkt an, wenn vorhanden */}
            {domain ? <span>: {domain}</span> : ''}
          </h1>
          {/* ✅ ENDE: h1-Tag Anpassung */}

          {projectId && (
            <p className="text-xs text-gray-400 mt-1">
              ID: {projectId}
            </p>
          )}
          <span className="text-gray-500 text-sm hidden lg:block">
            💡 GOOGLE Datenaktualisierung alle 48 Stunden | SEMRUSH Datenaktualisierung alle 14 Tage.
          </span>
        </div>
        
        {/* Rechte Seite: Wrapper für Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Zeitraum-Buttons */}
          <DateRangeSelector
            value={dateRange}
            onChange={onDateRangeChange}
            className="w-full sm:w-auto"
          />
          
          {/* PDF Button */}
          <Button
            onClick={onPdfExport}
            title="Als PDF exportieren"
            variant="outline"
            className="print:hidden gap-2 w-full sm:w-auto"
          >
            <Download size={16} />
            <span>PDF</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
