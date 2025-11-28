'use client';

import { useState, useRef, useEffect } from 'react';
import { Lightbulb, ArrowRepeat, Robot, Cpu, ExclamationTriangle, InfoCircle, GraphUpArrow } from 'react-bootstrap-icons';
import { getRangeLabel, DateRangeOption } from '@/components/DateRangeSelector';

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
  const [isPrefetched, setIsPrefetched] = useState(false);

  // Ref für AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- PRE-FETCHING & RESET LOGIK ---
  useEffect(() => {
    // 1. RESET: Wenn sich das Datum ändert, löschen wir die alte Analyse
    setStatusContent('');
    setAnalysisContent('');
    setError(null);
    setIsStreamComplete(false);
    setIsPrefetched(false);

    const prefetchData = async () => {
      if (!projectId) return;
      
      console.log(`[AI Widget] 🚀 Starte Pre-Fetching für Zeitraum: ${dateRange}`);
      try {
        // Cache aufwärmen für den neuen Zeitraum
        await fetch(`/api/projects/${projectId}?dateRange=${dateRange}`, {
          priority: 'low'
        });
        setIsPrefetched(true);
        console.log('[AI Widget] ✅ Pre-Fetching abgeschlossen.');
      } catch (e) {
        console.warn('[AI Widget] Pre-Fetching fehlgeschlagen (nicht kritisch):', e);
      }
    };

    prefetchData();
  }, [projectId, dateRange]);

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
      const UPDATE_INTERVAL = 50;

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

  // Helfer für den Anzeigetext
  const rangeLabel = getRangeLabel(dateRange as DateRangeOption).toLowerCase();

  // 1. Start-Ansicht (Leerzustand - NEUES PREMIUM DESIGN)
  if (!statusContent && !isLoading && !error) {
    return (
      <div className="relative group mb-6">
        {/* Dekorativer Hintergrund-Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
        
        <div className="relative bg-white rounded-xl p-6 flex flex-col sm:flex-row items-center gap-5 shadow-sm border border-indigo-50">
          
          {/* Icon mit Puls-Effekt */}
          <div className="relative shrink-0">
            {/* Pulsierender Ring hinter dem Icon */}
            <div className={`absolute inset-0 rounded-xl opacity-30 ${isPrefetched ? 'bg-emerald-400 animate-ping' : 'bg-indigo-400 animate-pulse'}`}></div>
            
            <div className={`relative p-4 rounded-xl shadow-sm border ${isPrefetched ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
              {isPrefetched ? <Cpu size={28} /> : <Robot size={28} />}
            </div>
            
            {/* Status Dot (Online Indikator) */}
            <span className={`absolute -top-1 -right-1 flex h-3 w-3`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPrefetched ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isPrefetched ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
            </span>
          </div>

          {/* Text Inhalt */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900">Data Max</h3>
              <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider border border-indigo-200">
                AI Analyst
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {isPrefetched 
                ? <span>Ich habe die Daten der letzten <span className="font-semibold text-gray-900">{rangeLabel}</span> vorbereitet.</span>
                : <span>Soll ich die Performance der letzten <span className="font-semibold text-gray-900">{rangeLabel}</span> für Sie auswerten?</span>}
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleAnalyze}
            className="shrink-0 px-6 py-3 bg-gradient-to-r from-[#188BDB] to-[#1479BF] text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 group/btn"
          >
            <Lightbulb size={16} className={isPrefetched ? "text-yellow-200" : "group-hover/btn:text-yellow-200 transition-colors"} />
            <span>Analyse starten</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Aktive Ansicht (Split Screen mit Analyse)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* SPALTE 1: Status */}
      <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col h-full shadow-sm">
        <div className="p-5 border-b border-indigo-100 bg-white/40 rounded-t-2xl backdrop-blur-sm flex justify-between items-center">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2">
            {isLoading ? <ArrowRepeat className="animate-spin" /> : <InfoCircle />}
            Status ({rangeLabel})
          </h3>
        </div>
        <div className="p-5 text-sm text-indigo-900 leading-relaxed flex-grow">
           <div dangerouslySetInnerHTML={{ __html: statusContent }} />
           
           {/* GRÜNE ANIMATION SPALTE 1 */}
           {isLoading && !analysisContent && (
             <div className="inline-flex items-center gap-2 mt-2 text-emerald-600 font-medium animate-pulse">
               <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
               </span>
               <span className="text-xs uppercase tracking-wider">Data Max analysiert...</span>
             </div>
           )}
        </div>
      </div>

      {/* SPALTE 2: Analyse */}
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col h-full shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <GraphUpArrow className="text-emerald-600" />
            Analyse & Fazit
          </h3>
        </div>
        <div className="p-5 text-sm text-gray-700 leading-relaxed flex-grow">
           {analysisContent ? (
             <div dangerouslySetInnerHTML={{ __html: analysisContent }} />
           ) : (
             /* Platzhalter, solange Spalte 1 noch lädt */
             isLoading && !statusContent ? <p className="text-gray-400 italic">Warte auf Datenverarbeitung...</p> : null
           )}

           {/* GRÜNE ANIMATION SPALTE 2 */}
           {isLoading && analysisContent && (
             <div className="inline-flex items-center gap-2 mt-2 text-emerald-600 font-medium animate-pulse">
               <span className="w-2 h-4 bg-emerald-500 rounded-sm shadow-[0_0_10px_rgba(16,185,129,0.6)]"></span>
               <span className="text-xs uppercase tracking-wider">Schreibt...</span>
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

    </div>
  );
}
