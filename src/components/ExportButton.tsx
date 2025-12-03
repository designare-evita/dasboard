/* src/components/ExportButton.tsx */
'use client';

import { useState } from 'react';
import html2canvas from 'html2canvas';
import { pdf } from '@react-pdf/renderer';
import { AnalysisReport } from '@/components/pdf/AnalysisReport';
import { FileEarmarkPdf } from 'react-bootstrap-icons';

interface ExportButtonProps {
  chartRef: React.RefObject<HTMLDivElement>;
  analysisText: string;
  projectId: string;
  dateRange: string;
}

export default function ExportButton({ chartRef, analysisText, projectId, dateRange }: ExportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    if (!analysisText) return;
    setIsGenerating(true);

    try {
      let chartImgData = '';

      // 1. Chart screenshotten (falls Ref vorhanden)
      if (chartRef.current) {
        try {
          // Temporär Hintergrund weiß setzen für sauberen Screenshot
          const originalBg = chartRef.current.style.backgroundColor;
          chartRef.current.style.backgroundColor = '#ffffff';
          
          const canvas = await html2canvas(chartRef.current, {
            scale: 2, // Bessere Qualität
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });
          
          chartImgData = canvas.toDataURL('image/png');
          
          // Style zurücksetzen
          chartRef.current.style.backgroundColor = originalBg;
        } catch (e) {
          console.warn("Konnte Chart nicht rendern:", e);
        }
      }

      // 2. PDF Blob generieren
      const blob = await pdf(
        <AnalysisReport 
          projectId={projectId}
          dateRange={dateRange}
          summaryText={analysisText} 
          chartImage={chartImgData} 
        />
      ).toBlob();

      // 3. Download erzwingen
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Report_${projectId}_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("PDF Export Fehler:", error);
      alert("Fehler beim Erstellen des PDFs.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Button nur anzeigen wenn Text da ist
  if (!analysisText) return null;

  return (
    <button 
      onClick={handleDownload} 
      disabled={isGenerating}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
      title="PDF Report herunterladen"
    >
      {isGenerating ? (
        <span className="animate-pulse">Erstelle PDF...</span>
      ) : (
        <>
          <FileEarmarkPdf size={14} />
          <span>Als PDF exportieren</span>
        </>
      )}
    </button>
  );
}
