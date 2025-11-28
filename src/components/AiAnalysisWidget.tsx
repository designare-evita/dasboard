'use client';

import { useState, useRef, useEffect } from 'react';
import { Lightbulb, ArrowRepeat, Robot, ExclamationTriangle, InfoCircle, GraphUpArrow } from 'react-bootstrap-icons';
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
  
  // NEU: Dynamischer Teaser Text
  const [teaserText, setTeaserText] = useState('');

  // Ref für AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helfer: Zufälligen "Anfütter"-Text generieren
  const generateTeaser = (range: string) => {
    const teasers = [
      `Ich habe spannende Muster in den letzten ${range} entdeckt.`,
      `Ihre Performance-Daten für ${range} halten Überraschungen bereit.`,
      `Analyse vorbereitet: Es gibt Neuigkeiten zu Ihrem Traffic.`,
      `Wollen Sie wissen, wie Ihre Keywords in ${range} performt haben?`,
      `Die Daten sind komplett. Zeit für neue Insights?`
    ];
    return teasers[Math.floor(Math.random() * teasers.length)];
  };

  const rangeLabel = getRangeLabel(dateRange as DateRangeOption).toLowerCase();

  // --- PRE-FETCHING & RESET LOGIK ---
  useEffect(() => {
    setStatusContent('');
    setAnalysisContent('');
    setError(null);
    setIsStreamComplete(false);
    setIsPrefetched(false);
    setTeaserText(''); // Reset Teaser

    const prefetchData = async () => {
      if (!projectId) return;
      
      console.log(`[AI Widget] 🚀 Starte Pre-Fetching für Zeitraum: ${dateRange}`);
      try {
        await fetch(`/api/projects/${projectId}?dateRange=${dateRange}`, {
          priority: 'low'
        });
        
        // Wenn fertig: Status setzen und Teaser generieren
        setIsPrefetched(true);
        setTeaserText(generateTeaser(rangeLabel));
        
        console.log('[AI Widget] ✅ Pre-Fetching abgeschlossen.');
      } catch (e) {
        console.warn('[AI Widget] Pre-Fetching fehlgeschlagen (nicht kritisch):', e);
      }
    };

    prefetchData();
  }, [projectId, dateRange, rangeLabel]);

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

  // 1. Start-Ansicht (Leerzustand - DEZENTES DESIGN)
  if (!statusContent && !isLoading && !error) {
    return (
      <div className="relative group mb-6">
        {/* Dekorativer Hintergrund-Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl opacity-5 group-hover:opacity-15 transition duration-700 blur-sm"></div>
        
        <div className="relative bg-white rounded-xl p-6 flex flex-col sm:flex-row items-center gap-5 shadow-sm border border-gray-100/80">
          
          {/* Icon mit Puls-Effekt */}
          <div className="relative shrink-0">
            <div className={`absolute inset-0 rounded-xl opacity-10 animate-pulse ${isPrefetched ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
            
            <div className={`relative p-4 rounded-xl border ${isPrefetched ? 'bg-emerald-50/50 border-emerald-100/50 text-emerald-600' : 'bg-indigo-50/50 border-indigo-100/50 text-indigo-600'}`}>
              {/* Immer Roboter, aber Farbe ändert sich */}
              <Robot size={28} />
            </div>
            
            {/* Status Dot */}
            <span className={`absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${isPrefetched ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPrefetched ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
            </span>
          </div>

          {/* Text Inhalt */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900">Data Max</h3>
              <span className="px-2 py-0.5 rounded text-indigo-600/80 bg-indigo-50 text-[10px] font-bold uppercase tracking-wider border border-indigo-100/50">
                AI Analyst
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {isPrefetched && teaserText 
                ? <span className="font-medium text-gray-800 animate-in fade-in duration-500">{teaserText}</span>
                : <span>Soll ich die Performance der letzten <span className="font-medium text-gray-700">{rangeLabel}</span> analysieren?</span>}
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleAnalyze}
            className="shrink-0 px-5 py-2.5 bg-[#188BDB] hover:bg-[#1479BF] text-white rounded-lg text-sm font-medium shadow-sm hover:shadow transition-all duration-200 flex items-center gap-2"
          >
            <Lightbulb size={16} className="text-white/90" />
            <span>Jetzt analysieren</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Aktive Ansicht (Split Screen mit Analyse)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* SPALTE 1: Status */}
      <div className="bg-indigo-50/30 rounded-2xl border border-indigo-100/50 flex flex-col h-full shadow-sm">
        <div className="p-5 border-b border-indigo-100/50 bg-white/40 rounded-t-2xl backdrop-blur-sm flex justify-between items-center">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2">
            {isLoading ? <ArrowRepeat className="animate-spin" /> : <InfoCircle />}
            Status ({rangeLabel})
          </h3>
        </div>
        <div className="p-5 text-sm text-indigo-900 leading-relaxed flex-grow">
           <div dangerouslySetInnerHTML={{ __html: statusContent }} />
           
           {isLoading && !analysisContent && (
             <div className="inline-flex items-center gap-2 mt-2 text-emerald-600 font-medium animate-pulse opacity-80">
               <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
               </span>
               <span className="text-xs uppercase tracking-wider">Analysiert...</span>
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
             isLoading && !statusContent ? <p className="text-gray-400 italic">Warte auf Datenverarbeitung...</p> : null
           )}

           {isLoading && analysisContent && (
             <div className="inline-flex items-center gap-2 mt-2 text-emerald-600 font-medium animate-pulse opacity-80">
               <span className="w-1.5 h-3 bg-emerald-500 rounded-sm"></span>
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
