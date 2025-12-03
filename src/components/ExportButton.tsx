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
  
  // NEU: Zusätzliche Refs für mehr Charts
  pieChartsRefs?: {
    country?: React.RefObject<HTMLDivElement>;
    channel?: React.RefObject<HTMLDivElement>;
    device?: React.RefObject<HTMLDivElement>;
  };
  
  // NEU: KPI Daten
  kpis?: Array<{
    label: string;
    value: string | number;
    change?: number;
    unit?: string;
  }>;
}

export default function ExportButton({ 
  chartRef, 
  analysisText, 
  projectId, 
  dateRange,
  pieChartsRefs,
  kpis
}: ExportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const captureElement = async (ref: React.RefObject<HTMLDivElement>): Promise<string> => {
    if (!ref.current) return '';
    
    try {
      const originalBg = ref.current.style.backgroundColor;
      ref.current.style.backgroundColor = '#ffffff';
      
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      ref.current.style.backgroundColor = originalBg;
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn("Konnte Element nicht rendern:", e);
      return '';
    }
  };

  const handleDownload = async () => {
    if (!analysisText) return;
    setIsGenerating(true);

    try {
      // 1. Trend Chart
      const trendChart = await captureElement(chartRef);
      
      // 2. Pie Charts
      const pieCharts = pieChartsRefs ? {
        country: await captureElement(pieChartsRefs.country || { current: null }),
        channel: await captureElement(pieChartsRefs.channel || { current: null }),
        device: await captureElement(pieChartsRefs.device || { current: null })
      } : undefined;

      // 3. PDF Blob generieren
      const blob = await pdf(
        <AnalysisReport 
          projectId={projectId}
          dateRange={dateRange}
          summaryText={analysisText} 
          trendChart={trendChart}
          pieCharts={pieCharts}
          kpis={kpis}
        />
      ).toBlob();

      // 4. Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Performance_Report_${projectId}_${new Date().toISOString().slice(0,10)}.pdf`;
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

  if (!analysisText) return null;

  return (
    <button 
      onClick={handleDownload} 
      disabled={isGenerating}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Vollständigen PDF Report herunterladen"
    >
      {isGenerating ? (
        <>
          <div className="animate-spin h-3 w-3 border-2 border-emerald-600 border-t-transparent rounded-full"></div>
          <span>Generiere PDF...</span>
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
