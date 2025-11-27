'use client';

import { useState, useRef, useEffect } from 'react';
import { Lightbulb, ArrowRepeat, Robot, Cpu, ExclamationTriangle, InfoCircle, GraphUpArrow } from 'react-bootstrap-icons';

interface Props {
  projectId: string;
  dateRange: string;
}

export default function AiAnalysisWidget({ projectId, dateRange }: Props) {
  // Content States
  const [statusContent, setStatusContent] = useState('');
  const [analysisContent, setAnalysisContent] = useState('');
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamComplete, setIsStreamComplete] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPrefetched, setIsPrefetched] = useState(false); // Neuer State für Debug-Zwecke (optional)

  // Ref für AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- PRE-FETCHING LOGIK ---
  // Sobald die Komponente gemountet wird (User betritt Seite),
  // stoßen wir den Daten-Abruf an. Die Daten landen im serverseitigen Cache.
  useEffect(() => {
    const prefetchData = async () => {
      if (!projectId) return;
      
      console.log('[AI Widget] 🚀 Starte Pre-Fetching im Hintergrund...');
      try {
        // Wir rufen die Standard-Daten-Route auf.
        // Diese führt intern getOrFetchGoogleData aus und füllt den Cache.
        await fetch(`/api/projects/${projectId}?dateRange=${dateRange}`, {
          priority: 'low' // Browser-Hint: Nicht kritisch für initiales Rendering
        });
        setIsPrefetched(true);
        console.log('[AI Widget] ✅ Pre-Fetching abgeschlossen. Daten sind im Cache.');
      } catch (e) {
        console.warn('[AI Widget] Pre-Fetching fehlgeschlagen (nicht kritisch):', e);
      }
    };

    prefetchData();
  }, [projectId, dateRange]);
  // ---------------------------

  const handleAnalyze = async () => {
    setIsLoading(true);
    setIsStreamComplete(false);
    setError(null);
    setStatusContent('');
    setAnalysisContent('');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, dateRange }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('Verbindung fehlgeschlagen');
      if (!response.body) throw new Error('Kein Stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 50; // 20fps für flüssigen Text

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        const now = Date.now();
        if (now - lastUpdateTime > UPDATE_INTERVAL) {
          parseAndSetContent(fullText);
          lastUpdateTime = now;
        }
      }
      
      parseAndSetContent(fullText);
      setIsStreamComplete(true);

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const parseAndSetContent = (text: string) => {
    const marker = '[[SPLIT]]';
    if (text.includes(marker)) {
      const [part1, part2] = text.split(marker);
      setStatusContent(part1);
      setAnalysisContent(part2);
    } else {
      setStatusContent(text);
    }
  };

  // Start-Ansicht (Leerzustand)
  if (!statusContent && !isLoading && !error) {
    return (
      <div className="card-glass p-6 mb-6 flex items-center gap-4 transition-all hover:shadow-md">
        <div className={`p-3 rounded-xl text-indigo-600 transition-colors ${isPrefetched ? 'bg-green-50 text-green-600' : 'bg-indigo-50'}`}>
          {isPrefetched ? <Cpu size={24} /> : <Robot size={24} />}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">Data Max Analyse</h3>
          <p className="text-sm text-gray-500">
            {isPrefetched 
              ? "Daten sind vorbereitet und liegen bereit." 
              : "Soll ich die aktuellen Projektdaten für Sie auswerten?"}
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          className="px-4 py-2 bg-[#188BDB] text-white rounded-lg text-sm font-medium hover:bg-[#1479BF] transition-colors flex items-center gap-2 shadow-sm"
        >
          <Lightbulb size={14} />
          Jetzt analysieren
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* SPALTE 1: Status */}
      <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col h-full shadow-sm">
        <div className="p-5 border-b border-indigo-100 bg-white/40 rounded-t-2xl backdrop-blur-sm">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2">
            {isLoading ? <ArrowRepeat className="animate-spin" /> : <InfoCircle />}
            Projekt Status & Zahlen
          </h3>
        </div>
        <div className="p-5 text-sm text-indigo-900 leading-relaxed flex-grow">
           <div dangerouslySetInnerHTML={{ __html: statusContent }} />
           {isLoading && !analysisContent && (
             <span className="inline-block w-2 h-4 bg-indigo-400 ml-1 animate-pulse align-middle"/>
           )}
        </div>
      </div>

      {/* SPALTE 2: Analyse */}
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col h-full shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <GraphUpArrow className="text-emerald-600" />
            Performance Analyse
          </h3>
        </div>
        <div className="p-5 text-sm text-gray-700 leading-relaxed flex-grow">
           {analysisContent ? (
             <div dangerouslySetInnerHTML={{ __html: analysisContent }} />
           ) : (
             isLoading && <p className="text-gray-400 italic">Warte auf Datenverarbeitung...</p>
           )}

           {isLoading && analysisContent && (
             <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse align-middle"/>
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

    </div>
  );
}
