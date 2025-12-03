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

  // ✅ NEU: Konvertiere oklch() zu rgb()
  const convertOklchToRgb = (element: HTMLElement) => {
    const savedStyles: Array<{element: HTMLElement, property: string, value: string}> = [];
    
    const processElement = (el: HTMLElement) => {
      const computedStyle = window.getComputedStyle(el);
      
      // Prüfe alle relevanten CSS-Properties
      const properties = [
        'color', 'backgroundColor', 'borderColor', 
        'fill', 'stroke', 'outlineColor'
      ];
      
      properties.forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        
        // Wenn oklch() gefunden, speichere Original und setze Fallback
        if (value && value.includes('oklch')) {
          savedStyles.push({
            element: el,
            property: prop,
            value: el.style.getPropertyValue(prop) || ''
          });
          
          // Setze RGB-Fallback (extrahiere aus computedStyle)
          const rgbValue = computedStyle.getPropertyValue(prop);
          if (rgbValue) {
            el.style.setProperty(prop, rgbValue, 'important');
          }
        }
      });
    };
    
    // Durchlaufe Element und alle Kinder
    processElement(element);
    element.querySelectorAll('*').forEach(child => {
      if (child instanceof HTMLElement) {
        processElement(child);
      }
    });
    
    return savedStyles;
  };

  // ✅ NEU: Stelle ursprüngliche Styles wieder her
  const restoreStyles = (savedStyles: Array<{element: HTMLElement, property: string, value: string}>) => {
    savedStyles.forEach(({element, property, value}) => {
      if (value) {
        element.style.setProperty(property, value);
      } else {
        element.style.removeProperty(property);
      }
    });
  };

  const waitForElement = (ref: React.RefObject<HTMLDivElement>, timeout = 3000): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!ref.current) {
        reject(new Error('Element nicht gefunden'));
        return;
      }

      const startTime = Date.now();
      
      const checkVisibility = () => {
        if (!ref.current) {
          reject(new Error('Element nicht gefunden'));
          return;
        }

        const rect = ref.current.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        
        if (isVisible) {
          setTimeout(() => resolve(), 500);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout beim Warten auf Element'));
        } else {
          requestAnimationFrame(checkVisibility);
        }
      };
      
      checkVisibility();
    });
  };

  const captureElement = async (ref: React.RefObject<HTMLDivElement>): Promise<string> => {
    if (!ref.current) {
      console.warn('Ref nicht vorhanden, überspringe Screenshot');
      return '';
    }
    
    let savedStyles: Array<{element: HTMLElement, property: string, value: string}> = [];
    
    try {
      await waitForElement(ref);
      
      const element = ref.current;
      
      // ✅ Konvertiere oklch vor dem Screenshot
      savedStyles = convertOklchToRgb(element);
      
      const originalBg = element.style.backgroundColor;
      element.style.backgroundColor = '#ffffff';
      
      element.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: false,
        foreignObjectRendering: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          // Entferne auch im geklonten Dokument alle oklch-Referenzen
          const clonedElement = clonedDoc.querySelector(`[data-chart-ref]`) as HTMLElement;
          if (clonedElement) {
            convertOklchToRgb(clonedElement);
          }
        }
      });
      
      element.style.backgroundColor = originalBg;
      
      // ✅ Stelle Original-Styles wieder her
      restoreStyles(savedStyles);
      
      const dataUrl = canvas.toDataURL('image/png', 0.95);
      console.log(`✅ Screenshot erfolgreich: ${dataUrl.substring(0, 50)}...`);
      
      return dataUrl;
    } catch (e) {
      console.error("Konnte Element nicht rendern:", e);
      
      // ✅ Stelle bei Fehler auch Styles wieder her
      if (savedStyles.length > 0) {
        restoreStyles(savedStyles);
      }
      
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
