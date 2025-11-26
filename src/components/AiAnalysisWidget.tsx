// src/components/AiAnalysisWidget.tsx
'use client';

import { useCompletion } from '@ai-sdk/react';
import { Lightbulb, ArrowRepeat, Robot, Cpu, ExclamationTriangle } from 'react-bootstrap-icons';

interface Props {
  projectId: string;
  dateRange: string;
}

export default function AiAnalysisWidget({ projectId, dateRange }: Props) {
  // useCompletion managed den Stream-Status und den Text (completion) automatisch
  const { completion, complete, isLoading, error } = useCompletion({
    api: '/api/ai/analyze',
  });

  const handleAnalyze = async () => {
    // Wir übergeben die Daten als Body, der Prompt selbst ist hier leer (wird vom Server ignoriert)
    await complete('', { 
      body: { projectId, dateRange } 
    });
  };

  // Der Inhalt wird angezeigt, wenn er lädt ODER wenn schon Text da ist
  const showContent = isLoading || completion.length > 0;

  return (
    <div className="card-glass p-6 mb-6 relative overflow-hidden transition-all border-l-4 border-l-indigo-500">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl transition-colors duration-500 ${
          isLoading ? 'bg-indigo-100 text-indigo-600' : 
          completion ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'
        }`}>
          {isLoading ? <Cpu size={24} className="animate-spin" /> : <Robot size={24} />}
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Data Max 
              <span className="text-[10px] font-normal bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                Performance Android v1.0
              </span>
            </h3>
          </div>
          
          {/* Start-Button (nur wenn noch nichts passiert ist) */}
          {!showContent && !error && (
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-3 italic">
                &quot;Hallo. Mein Name ist Data Max. Ich bin spezialisiert auf die Auswertung komplexer Suchdaten. Darf ich die Analyse starten?&quot;
              </p>
              <button
                onClick={handleAnalyze}
                className="text-sm bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 px-4 py-2 rounded-md transition-all flex items-center gap-2 shadow-sm group"
              >
                <Lightbulb size={14} className="group-hover:text-yellow-500 transition-colors"/>
                Analyse starten
              </button>
            </div>
          )}

          {/* Lade-Indikator (nur ganz am Anfang, bis der erste Token kommt) */}
          {isLoading && completion.length === 0 && (
            <div className="mt-3 space-y-2">
               <p className="text-sm text-indigo-600 font-medium animate-pulse">Initialisiere Datenströme...</p>
               <div className="h-2 bg-indigo-100 rounded overflow-hidden max-w-[200px]">
                 <div className="h-full bg-indigo-500 animate-progress origin-left"></div>
               </div>
            </div>
          )}

          {/* HIER FLIESST DER STREAM REIN */}
          {showContent && (
            <div className="mt-2 animate-in fade-in slide-in-from-bottom-2">
              <div 
                className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none"
                // completion enthält den HTML-String, der live wächst
                dangerouslySetInnerHTML={{ __html: completion }}
              />
              
              {!isLoading && (
                <button 
                  onClick={handleAnalyze} 
                  className="text-xs text-gray-400 hover:text-indigo-600 mt-4 flex items-center gap-1 transition-colors"
                >
                  <ArrowRepeat size={10} /> Re-Analyse anfordern
                </button>
              )}
            </div>
          )}
          
          {error && (
             <div className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded border border-red-100 flex items-center gap-2">
               <ExclamationTriangle size={16} className="shrink-0" />
               Verbindungsfehler: {error.message}
               <button onClick={handleAnalyze} className="ml-auto text-red-700 underline font-semibold">Wiederholen</button>
             </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 95%; }
        }
        .animate-progress {
          animation: progress 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
