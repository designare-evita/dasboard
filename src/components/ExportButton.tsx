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
  
  pieChartsRefs?: {
    country?: React.RefObject<HTMLDivElement>;
    channel?: React.RefObject<HTMLDivElement>;
    device?: React.RefObject<HTMLDivElement>;
  };
  
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

  // ✅ NEUE STRATEGIE: Injiziere CSS Override vor Screenshot
  const injectScreenshotStyles = () => {
    const styleId = 'screenshot-color-override';
    
    // Entferne alte Version falls vorhanden
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Überschreibe alle oklch-Farben für Screenshots */
      .screenshot-mode,
      .screenshot-mode * {
        color: rgb(0, 0, 0) !important;
        background-color: rgb(255, 255, 255) !important;
        border-color: rgb(229, 231, 235) !important;
        fill: currentColor !important;
        stroke: currentColor !important;
      }
      
      /* Chart-spezifische Farben */
      .screenshot-mode .recharts-surface {
        background: white !important;
      }
      
      .screenshot-mode .recharts-cartesian-axis-tick-value {
        fill: rgb(107, 114, 128) !important;
      }
      
      .screenshot-mode .recharts-legend-item-text {
        color: rgb(55, 65, 81) !important;
      }
    `;
    
    document.head.appendChild(style);
    return styleId;
  };

  const removeScreenshotStyles = (styleId: string) => {
    const style = document.getElementById(styleId);
    if (style) style.remove();
  };

  const captureElement = async (ref: React.RefObject<HTMLDivElement>): Promise<string> => {
    if (!ref.current) {
      console.warn('Ref nicht vorhanden, überspringe Screenshot');
      return '';
    }
    
    let styleId: string | null = null;
    
    try {
      const element = ref.current;
      
      // ✅ Füge CSS Override hinzu
      styleId = injectScreenshotStyles();
      
      // ✅ Füge screenshot-mode Klasse hinzu
      element.classList.add('screenshot-mode');
      
      // Warte kurz, damit Browser Styles anwendet
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Scroll in View
      element.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: true, // ✅ Aktiviere Logging zum Debuggen
        backgroundColor: '#ffffff',
        allowTaint: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });
      
      // ✅ Entferne screenshot-mode Klasse
      element.classList.remove('screenshot-mode');
      
      // ✅ Entferne CSS Override
      if (styleId) removeScreenshotStyles(styleId);
      
      const dataUrl = canvas.toDataURL('image/png', 0.95);
      console.log(`✅ Screenshot erfolgreich (${dataUrl.length} bytes)`);
      
      return dataUrl;
    } catch (e) {
      console.error("Konnte Element nicht rendern:", e);
      
      // Cleanup bei Fehler
      if (ref.current) {
        ref.current.classList.remove('screenshot-mode');
      }
      if (styleId) removeScreenshotStyles(styleId);
      
      return '';
    }
  };

  const handleDownload = async () => {
    if (!analysisText) return;
    setIsGenerating(true);

    try {
      console.log('🚀 Starte PDF-Generierung...');
      
      // 1. Trend Chart
      console.log('📊 Erstelle Trend Chart Screenshot...');
      const trendChart = await captureElement(chartRef);
      
      // 2. Pie Charts
      console.log('📊 Erstelle Pie Charts Screenshots...');
      const pieCharts = pieChartsRefs ? {
        channel: pieChartsRefs.channel ? await captureElement(pieChartsRefs.channel) : '',
        country: pieChartsRefs.country ? await captureElement(pieChartsRefs.country) : '',
        device: pieChartsRefs.device ? await captureElement(pieChartsRefs.device) : ''
      } : undefined;

      console.log('📄 Generiere PDF...');
      
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

      console.log('✅ PDF erfolgreich generiert');

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
      console.error("❌ PDF Export Fehler:", error);
      alert("Fehler beim Erstellen des PDFs. Bitte versuchen Sie es erneut.");
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
