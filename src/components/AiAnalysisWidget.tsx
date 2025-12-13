/* src/components/AiAnalysisWidget.tsx */
'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Lightbulb, ArrowRepeat, ExclamationTriangle, InfoCircle, GraphUpArrow, Search, Globe, ChatText } from 'react-bootstrap-icons';
import { getRangeLabel, DateRangeOption } from '@/components/DateRangeSelector';
import ExportButton from '@/components/ExportButton';

// Erweiterte Props: Dashboard-Props sind jetzt optional, neue Tool-Props hinzugefügt
interface Props {
  // Dashboard Mode Props (Optional)
  projectId?: string;
  domain?: string;
  dateRange?: DateRangeOption;
  chartRef?: React.RefObject<HTMLDivElement>;
  kpis?: Array<{
    label: string;
    value: string | number;
    change?: number;
    unit?: string;
  }>;

  // Tool Mode Props (Neu)
  type?: 'news' | 'gap' | 'spy' | 'trends' | 'schema';
  title?: string;
}

export default function AiAnalysisWidget({ 
  projectId, 
  domain, 
  dateRange, 
  chartRef,
  kpis,
  type,   // NEU
  title   // NEU
}: Props) {
  // Content States
  const [statusContent, setStatusContent] = useState('');
  const [analysisContent, setAnalysisContent] = useState('');
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamComplete, setIsStreamComplete] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPrefetched, setIsPrefetched] = useState(false);
  
  // Inputs für Tool-Mode
  const [inputMain, setInputMain] = useState(''); // z.B. Topic oder URL
  const [inputSecondary, setInputSecondary] = useState(''); // z.B. Keywords

  // Dynamischer Teaser Text
  const [teaserText, setTeaserText] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper: Modus bestimmen
  const isToolMode = !!type;
  const rangeLabel = dateRange ? getRangeLabel(dateRange).toLowerCase() : '';

  // Teaser Generator (Nur für Dashboard-Modus relevant)
  const generateTeaser = (rangeLabelText: string) => {
    const teasers = [
      `Der Datensatz für ${rangeLabelText} ist vollständig importiert. Soll ich die Auswertung starten?`,
      `Wollen wir herausfinden, welche Themengebiete Besucher zu Kunden machen?`,
      `Die Zahlen für ${rangeLabelText} sind bereit. Sollen wir die Analyse beginnen?`,
      `Die Performance-Daten halten neue Insights bereit. Wollen Sie wissen, welche Maßnahmen greifen?`,
    ];
    return teasers[Math.floor(Math.random() * teasers.length)];
  };

  useEffect(() => {
    // Reset bei Prop-Changes
    setStatusContent('');
    setAnalysisContent('');
    setError(null);
    setIsStreamComplete(false);
    setIsPrefetched(false);
    setTeaserText('');
    setInputMain('');
    setInputSecondary('');

    // Pre-Fetching NUR im Dashboard-Modus
    const prefetchData = async () => {
      if (!projectId || isToolMode || !dateRange) return;
      
      setTeaserText(generateTeaser(getRangeLabel(dateRange)));

      console.log(`[AI Widget] 🚀 Starte Pre-Fetching für Zeitraum: ${dateRange}`);
      try {
        await fetch(`/api/projects/${projectId}?dateRange=${dateRange}`, {
          priority: 'low'
        });
        setIsPrefetched(true);
      } catch (e) {
        console.warn('[AI Widget] Pre-Fetching fehlgeschlagen:', e);
      }
    };

    prefetchData();
  }, [projectId, dateRange, type]);

  const handleAnalyze = async () => {
    if (isToolMode && !inputMain) {
      setError(new Error('Bitte füllen Sie das Eingabefeld aus.'));
      return;
    }

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
      let url = '/api/ai/analyze';
      let body: any = { projectId, dateRange };

      // API-Routing basierend auf Typ
      if (isToolMode) {
        if (type === 'news') {
          url = '/api/ai/news-crawler';
          body = { topic: inputMain };
        } else if (type === 'gap') {
          url = '/api/ai/content-gap';
          // Keywords durch Komma trennen
          body = { 
            url: inputMain, 
            keywords: inputSecondary.split(',').map(k => k.trim()).filter(Boolean) 
          };
        } else if (type === 'spy') {
          url = '/api/ai/competitor-spy';
          body = { url: inputMain };
        } else if (type === 'trends') {
          url = '/api/ai/trend-radar';
          body = { topic: inputMain };
        } else if (type === 'schema') {
           url = '/api/ai/schema-analyzer';
           body = { url: inputMain };
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || 'Verbindung fehlgeschlagen');
      }
      
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

  // --- RENDERING ---

  // 1. Initial State (Eingabe / Teaser)
  if (!statusContent && !isLoading && !error) {
    return (
      <div className="relative group mb-6">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl opacity-5 group-hover:opacity-15 transition duration-700 blur-sm"></div>
        <div className="relative bg-white rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm border border-gray-100/80">
          
          {/* Avatar / Icon */}
          <div className="relative shrink-0">
            <div className={`absolute inset-0 rounded-2xl opacity-10 animate-pulse ${isPrefetched || isToolMode ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
            <div className={`relative p-1 rounded-2xl border-2 ${isPrefetched || isToolMode ? 'bg-emerald-50/30 border-emerald-100/50' : 'bg-indigo-50/30 border-indigo-100/50'}`}>
              <div className="relative w-20 h-20">
                <Image src="/data-max.webp" alt="Data Max AI Analyst" fill className="object-contain drop-shadow-sm" sizes="80px" priority />
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 w-full text-center md:text-left space-y-4">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <h3 className="text-xl font-bold text-gray-900">{isToolMode ? title : 'Data Max'}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-indigo-600/90 bg-indigo-50 text-[10px] font-bold uppercase tracking-wider border border-indigo-100/50">AI Analyst</span>
            </div>
            
            {!isToolMode ? (
              // DASHBOARD MODE TEASER
              <p className="text-base text-gray-600 leading-relaxed max-w-xl">
                {isPrefetched && teaserText 
                  ? <span className="text-gray-600 animate-in fade-in duration-500">{teaserText}</span>
                  : <span>Soll ich die Performance der letzten <span className="font-medium text-gray-700">{rangeLabel}</span> analysieren?</span>}
              </p>
            ) : (
              // TOOL MODE INPUTS
              <div className="space-y-3 max-w-xl">
                {/* Haupt-Input */}
                <div className="relative">
                   {type === 'news' || type === 'trends' ? <ChatText className="absolute left-3 top-3 text-gray-400" /> : null}
                   {(type === 'gap' || type === 'spy' || type === 'schema') ? <Globe className="absolute left-3 top-3 text-gray-400" /> : null}
                   
                   <input 
                     type="text" 
                     className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                     placeholder={
                        type === 'news' ? "Thema eingeben (z.B. 'Künstliche Intelligenz')" :
                        type === 'gap' ? "Deine URL (z.B. 'https://meine-seite.de')" :
                        type === 'spy' ? "Konkurrenz URL eingeben..." :
                        type === 'trends' ? "Trend-Thema eingeben..." : "Eingabe..."
                     }
                     value={inputMain}
                     onChange={(e) => setInputMain(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                   />
                </div>

                {/* Sekundär-Input (Nur für Content Gap) */}
                {type === 'gap' && (
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-400" />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Keywords (kommagetrennt, z.B. 'SEO, Marketing, AI')"
                      value={inputSecondary}
                      onChange={(e) => setInputSecondary(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Button */}
          <button 
            onClick={handleAnalyze} 
            disabled={isToolMode && !inputMain}
            className={`shrink-0 px-6 py-3 rounded-lg text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 group
              ${(isToolMode && !inputMain) 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-[#188BDB] hover:bg-[#1479BF] text-white'}`}
          >
            <Lightbulb size={18} className={`${(isToolMode && !inputMain) ? '' : 'text-white/90 group-hover:text-yellow-200 transition-colors'}`} />
            <span>{isToolMode ? 'Starten' : 'Jetzt analysieren'}</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Result / Loading State
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Linke Spalte: Status / Log */}
      <div className="bg-indigo-50/30 rounded-2xl border border-indigo-100/50 flex flex-col h-full shadow-sm min-h-[300px]">
        <div className="p-5 border-b border-indigo-100/50 bg-white/40 rounded-t-2xl backdrop-blur-sm flex justify-between items-center">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2">
            {isLoading ? <ArrowRepeat className="animate-spin" /> : <InfoCircle />}
            Status {rangeLabel && `(${rangeLabel})`}
          </h3>
          <button onClick={() => { setStatusContent(''); setAnalysisContent(''); setError(null); }} className="text-xs text-indigo-400 hover:text-indigo-700 underline">
            Neue Analyse
          </button>
        </div>
        <div className="p-5 text-sm text-indigo-900 leading-relaxed flex-grow font-mono bg-white/30">
           <div dangerouslySetInnerHTML={{ __html: statusContent }} />
           {isLoading && !analysisContent && (
             <div className="inline-flex items-center gap-2 mt-2 text-emerald-600 font-medium animate-pulse opacity-80">
               <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
               </span>
               <span className="text-xs uppercase tracking-wider">Arbeite...</span>
             </div>
           )}
        </div>
      </div>

      {/* Rechte Spalte: Ergebnis */}
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col h-full shadow-sm min-h-[300px]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <GraphUpArrow className="text-emerald-600" />
            Ergebnis
          </h3>
          
          {/* PDF EXPORT (Nur anzeigen wenn Analyse fertig & im Dashboard Modus) */}
          {/* Im Tool-Mode könnten wir den Export deaktivieren oder anpassen */}
          {!isToolMode && chartRef && analysisContent && !isLoading && (
             <ExportButton 
               chartRef={chartRef} 
               analysisText={analysisContent} 
               projectId={projectId || ''} 
               domain={domain} 
               dateRange={dateRange || '30d'}
               kpis={kpis} 
             />
          )}
        </div>
        
        <div className="p-5 text-sm text-gray-700 leading-relaxed flex-grow">
           {analysisContent ? (
             <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: analysisContent }} />
           ) : (
             isLoading && !statusContent ? <p className="text-gray-400 italic text-center mt-10">Warte auf Datenverarbeitung...</p> : null
           )}
           {isLoading && analysisContent && (
             <div className="inline-flex items-center gap-2 mt-2 text-emerald-600 font-medium animate-pulse opacity-80">
               <span className="w-1.5 h-3 bg-emerald-500 rounded-sm"></span>
               <span className="text-xs uppercase tracking-wider">Schreibt...</span>
             </div>
           )}
           {error && (
             <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200 flex gap-2 items-start">
               <ExclamationTriangle className="shrink-0 mt-0.5"/>
               <div className="flex-1">
                 <strong>Fehler:</strong> {error.message}
                 <button onClick={handleAnalyze} className="block mt-1 underline font-medium">Erneut versuchen</button>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
