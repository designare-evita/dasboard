'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Lightbulb, ArrowRepeat, ExclamationTriangle, InfoCircle, GraphUpArrow } from 'react-bootstrap-icons';
import { getRangeLabel, DateRangeOption } from '@/components/DateRangeSelector';
import ExportButton from '@/components/ExportButton'; // <--- NEU

interface Props {
  projectId: string;
  dateRange: string;
  chartRef?: React.RefObject<HTMLDivElement>; // <--- NEU: Ref für das Chart
}

export default function AiAnalysisWidget({ projectId, dateRange, chartRef }: Props) {
  // Content States
  const [statusContent, setStatusContent] = useState('');
  const [analysisContent, setAnalysisContent] = useState('');
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamComplete, setIsStreamComplete] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPrefetched, setIsPrefetched] = useState(false);
  
  // Dynamischer Teaser Text
  const [teaserText, setTeaserText] = useState('');

  // Ref für AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helfer: Zufälligen "Anfütter"-Text generieren
  const generateTeaser = (range: string) => {
    const teasers = [
      `Der Datensatz für ${range} ist vollständig importiert und wartet auf Sie. Soll ich die Auswertung jetzt starten?`,
      `Wollen wir herausfinden, welche Themengebiete nicht nur Besucher anlocken, sondern sie auch zu Kunden machen?`,
      `Die Zahlen für ${range} sind bereit zur Verknüpfung. Sollen wir die Analyse beginnen?`,
      `Ich habe die Trends für ${range} im Blick. Eine detaillierte Zusammenfassung ist nur einen Klick entfernt.`
    ];
    setTeaserText(teasers[Math.floor(Math.random() * teasers.length)]);
  };

  useEffect(() => {
    generateTeaser(getRangeLabel(dateRange));
    // Reset bei Range Change
    setAnalysisContent('');
    setStatusContent('');
    setIsStreamComplete(false);
    setError(null);
    setIsPrefetched(false);
  }, [dateRange]);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisContent('');
    setStatusContent('');
    
    // Alten Request abbrechen falls vorhanden
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          dateRange,
          stream: true 
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Server Error: ${response.status}`);
      }

      if (!response.body) throw new Error('No readable stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });

        // Wir splitten nach Event-Doppelumbruch, falls Server SSE Format nutzt
        // Hier vereinfacht für direkten Text-Stream oder SSE
        // Annahme: Dein API Stream sendet rohe Chunks oder SSE Events.
        // Falls SSE, müsste man sauber parsen. Hier basic append:
        
        // Simples Parsen (Anpassen an deine API Response Struktur!)
        // Wenn deine API rohen Text streamt:
        setAnalysisContent((prev) => prev + chunkValue);
        
        // Wenn deine API JSON-Chunks oder SSE sendet, müsste man das hier filtern.
        // Da der Code vorher nicht sichtbar war, nehme ich an, es kommt Text an.
      }
      
      setIsStreamComplete(true);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        console.error('Stream error:', err);
        setError(err);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 flex flex-col h-full shadow-sm">
      <div className="p-5 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <GraphUpArrow className="text-emerald-600" />
          Analyse & Fazit
        </h3>
        
        {/* PDF EXPORT BUTTON HIER INTEGRIERT */}
        {chartRef && analysisContent && !isLoading && (
           <ExportButton 
             chartRef={chartRef} 
             analysisText={analysisContent} 
             projectId={projectId} 
             dateRange={dateRange} 
           />
        )}
      </div>
      
      <div className="p-5 text-sm text-gray-700 leading-relaxed flex-grow">
         {analysisContent ? (
           <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: analysisContent }} />
         ) : (
           isLoading && !statusContent ? (
             <p className="text-gray-400 italic">Analysiere Datenpunkte...</p>
           ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-center gap-4">
              <div className="bg-emerald-50 p-3 rounded-full">
                <Lightbulb className="text-emerald-600 w-6 h-6" />
              </div>
              <p className="text-gray-600 max-w-sm">
                {teaserText}
              </p>
              <button 
                onClick={handleAnalyze}
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                <Lightbulb className="w-4 h-4" />
                Jetzt analysieren
              </button>
            </div>
           )
         )}

         {isLoading && (
           <div className="inline-flex items-center gap-2 mt-4 text-emerald-600 font-medium animate-pulse opacity-80">
             <span className="w-1.5 h-3 bg-emerald-500 rounded-sm"></span>
             <span className="text-xs uppercase tracking-wider">Erstelle Bericht...</span>
           </div>
         )}
         
         {error && (
           <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200 flex gap-2">
             <ExclamationTriangle className="shrink-0 mt-0.5"/>
             <div>
               <strong>Fehler:</strong> {error.message}
               <button onClick={handleAnalyze} className="underline ml-2">Wiederholen</button>
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
