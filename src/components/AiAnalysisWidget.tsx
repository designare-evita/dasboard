'use client';

import { useState, useRef } from 'react';
import { Lightbulb, ArrowRepeat, Robot, Cpu, ExclamationTriangle, InfoCircle, GraphUpArrow } from 'react-bootstrap-icons';

interface Props {
  projectId: string;
  dateRange: string;
}

export default function AiAnalysisWidget({ projectId, dateRange }: Props) {
  // Wir speichern den Text für beide Spalten separat
  const [statusContent, setStatusContent] = useState('');
  const [analysisContent, setAnalysisContent] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamComplete, setIsStreamComplete] = useState(false); // Neu: Um Cursors zu steuern
  const [error, setError] = useState<Error | null>(null);

  // Ref, um Re-Renders beim Streamen nicht zu blockieren
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setIsStreamComplete(false);
    setError(null);
    setStatusContent('');
    setAnalysisContent('');

    // Alten Request abbrechen falls vorhanden
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
      
      // Throttling Variablen
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 50; // Sehr flüssig (20fps)

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
      
      // Finales Update
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

  // Logik zum Trennen des Streams am Marker
  const parseAndSetContent = (text: string) => {
    const marker = '[[SPLIT]]';
    if (text.includes(marker)) {
      const [part1, part2] = text.split(marker);
      setStatusContent(part1);
      setAnalysisContent(part2);
    } else {
      // Solange der Marker noch nicht da ist, landet alles in Spalte 1
      setStatusContent(text);
    }
  };

  // Start-Ansicht (Leerzustand)
  if (!statusContent && !isLoading && !error) {
    return (
      <div className="card-glass p-6 mb-6 flex items-center gap-4">
        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
          <Robot size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">Data Max Analyse</h3>
          <p className="text-sm text-gray-500">Soll ich die aktuellen Projektdaten für Sie auswerten?</p>
        </div>
        <button
          onClick={handleAnalyze}
          className="px-4 py-2 bg-[#188BDB] text-white rounded-lg text-sm font-medium hover:bg-[#1479BF] transition-colors flex items-center gap-2"
        >
          <Lightbulb size={14} />
          Jetzt analysieren
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-stretch animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* SPALTE 1: Status (Blaues Theme) */}
      <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col h-full shadow-sm">
        <div className="p-5 border-b border-indigo-100 bg-white/40 rounded-t-2xl backdrop-blur-sm">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2">
            {isLoading ? <ArrowRepeat className="animate-spin" /> : <InfoCircle />}
            Projekt Status & Zahlen
          </h3>
        </div>
        <div className="p-5 text-sm text-indigo-900 leading-relaxed flex-grow">
           {/* Inhalt rendern */}
           <div dangerouslySetInnerHTML={{ __html: statusContent }} />
           
           {/* Cursor Effekt während Stream läuft und wir in Spalte 1 sind */}
           {isLoading && !analysisContent && (
             <span className="inline-block w-2 h-4 bg-indigo-400 ml-1 animate-pulse align-middle"/>
           )}
        </div>
      </div>

      {/* SPALTE 2: Analyse (Weißes Theme) */}
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col h-full shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <GraphUpArrow className="text-emerald-600" />
            Performance Analyse
          </h3>
        </div>
        <div className="p-5 text-sm text-gray-700 leading-relaxed flex-grow">
           {/* Inhalt rendern */}
           {analysisContent ? (
             <div dangerouslySetInnerHTML={{ __html: analysisContent }} />
           ) : (
             /* Platzhalter solange Spalte 1 noch lädt */
             isLoading && <p className="text-gray-400 italic">Warte auf Datenverarbeitung...</p>
           )}

           {/* Cursor Effekt während Stream läuft und wir in Spalte 2 sind */}
           {isLoading && analysisContent && (
             <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse align-middle"/>
           )}
           
           {/* Fehleranzeige */}
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
