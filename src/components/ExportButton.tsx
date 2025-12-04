/* src/components/ExportButton.tsx */
'use client';

import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { AnalysisReport } from '@/components/pdf/AnalysisReport';
import { FileEarmarkPdf } from 'react-bootstrap-icons';

interface ExportButtonProps {
  chartRef?: React.RefObject<HTMLDivElement>;
  analysisText: string;
  projectId: string;
  dateRange: string;
  kpis?: Array<{
    label: string;
    value: string | number;
    change?: number;
    unit?: string;
  }>;
}

export default function ExportButton({ 
  analysisText, 
  projectId, 
  dateRange,
  kpis
}: ExportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    if (!analysisText) return;
    setIsGenerating(true);

    try {
      // PDF Blob erstellen
      const blob = await pdf(
        <AnalysisReport 
          projectId={projectId}
          dateRange={dateRange}
          summaryText={analysisText}
          kpis={kpis}
        />
      ).toBlob();

      // Download auslösen
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Report_${projectId}_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("PDF Export Fehler:", error);
      alert("Fehler beim Erstellen des PDFs.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!analysisText) return null;

  return (
    <button 
      onClick={handleDownload} 
      disabled={isGenerating}
      // UPDATE: Farben auf das Blau angepasst (#188BDB ist ca. sky-600/700, hier Nutzung von arbitrary values für exakten Match)
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#188BDB] bg-[#188BDB]/10 hover:bg-[#188BDB]/20 border border-[#188BDB]/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="PDF Report herunterladen"
    >
      {isGenerating ? (
        <>
          <div className="animate-spin h-3 w-3 border-2 border-[#188BDB] border-t-transparent rounded-full"></div>
          <span>Erstelle PDF...</span>
        </>
      ) : (
        <>
          <FileEarmarkPdf size={14} />
          <span>Als PDF exportieren</span>
        </>
      )}
    </button>
  );
}
