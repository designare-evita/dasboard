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

  // ✅ Erstelle ein unsichtbares Clone des Elements
  const cloneAndPrepareElement = async (element: HTMLElement): Promise<HTMLElement> => {
    // Clone das Element
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Verstecke das Original temporär
    const originalDisplay = element.style.display;
    
    // Füge Clone zum Body hinzu (unsichtbar)
    clone.style.position = 'fixed';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.style.zIndex = '-1';
    document.body.appendChild(clone);
    
    // Warte kurz, damit Browser alles rendert
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Ersetze oklch-Farben im Clone durch berechnete RGB-Werte
    const replaceOklchInClone = (el: HTMLElement) => {
      const computedStyle = window.getComputedStyle(el);
      
      // Hole alle Style-Properties
      const styleProps = [
        'color', 
        'backgroundColor', 
        'borderColor', 
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor'
      ];
      
      styleProps.forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        // Wenn oklch erkannt wird, setze den berechneten Wert
        if (value && !value.includes('oklch')) {
          el.style.setProperty(prop, value);
        }
      });
      
      // SVG-spezifische Attribute
      if (el instanceof SVGElement) {
        const fill = computedStyle.getPropertyValue('fill');
        const stroke = computedStyle.getPropertyValue('stroke');
        
        if (fill && !fill.includes('oklch')) {
          el.setAttribute('fill', fill);
        }
        if (stroke && !stroke.includes('oklch')) {
          el.setAttribute('stroke', stroke);
        }
      }
    };
    
    // Durchlaufe Clone und alle Kinder
    replaceOklchInClone(clone);
    clone.querySelectorAll('*').forEach(child => {
      if (child instanceof HTMLElement) {
        replaceOklchInClone(child);
      }
    });
    
    return clone;
  };

  const captureElement = async (ref: React.RefObject<HTMLDivElement>): Promise<string> => {
    if (!ref.current) {
      console.warn('Ref nicht vorhanden, überspringe Screenshot');
      return '';
    }
    
    let clone: HTMLElement | null = null;
    
    try {
      const element = ref.current;
      
      // ✅ Erstelle vorbereitetes Clone
      clone = await cloneAndPrepareElement(element);
      
      // Screenshot vom Clone
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: false,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight
      });
      
      // Entferne Clone
      if (clone && clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
      
      const dataUrl = canvas.toDataURL('image/png', 0.95);
      console.log(`✅ Screenshot erfolgreich (${Math.round(dataUrl.length / 1024)}KB)`);
      
      return dataUrl;
    } catch (e) {
      console.error("Konnte Element nicht rendern:", e);
      
      // Cleanup bei Fehler
      if (clone && clone.parentNode) {
        clone.parentNode.removeChild(clone);
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
      
      if (!trendChart) {
        console.warn('⚠️ Trend Chart konnte nicht erstellt werden');
      }
      
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
