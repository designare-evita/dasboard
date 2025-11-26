'use client';

import { useState } from 'react';
// Neue Icons für Data Max
import { Lightbulb, ArrowRepeat, Robot, Cpu, ExclamationTriangle } from 'react-bootstrap-icons';

interface Props {
  projectId: string;
  dateRange: string;
}

export default function AiAnalysisWidget({ projectId, dateRange }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, dateRange }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Fehler bei der Anfrage');
      
      setAnalysis(data.analysis);
    } catch (e) {
      console.error(e);
      // Data Max Fehlermeldung
      setError("Meine Verbindung zu den neuralen Netzwerken ist unterbrochen. Bitte versuchen Sie es erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card-glass p-6 mb-6 relative overflow-hidden transition-all border-l-4 border-l-indigo-500">
      <div className="flex items-start gap-4">
        {/* Icon Container: Wechselt zwischen Robot und CPU beim Laden */}
        <div className={`p-3 rounded-xl transition-colors duration-500 ${
          isLoading ? 'bg-indigo-100 text-indigo-600' : 
          analysis ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'
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
          
          {/* Start-Screen */}
          {!analysis && !isLoading && !error && (
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-3 italic">
                &quot;Hallo. Mein Name ist Data Max. Ich bin spezialisiert auf die Auswertung komplexer Suchdaten. Ich stehe bereit, um Ihren Ist-Zustand zu validieren und Optimierungen abzuleiten. Darf ich die Analyse starten?&quot;
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

          {/* Lade-Animation (Wichtig bei Wartezeit!) */}
          {isLoading && (
            <div className="mt-3 space-y-2">
               <p className="text-sm text-indigo-600 font-medium animate-pulse">Verarbeite Datenströme...</p>
               {/* Ladebalken-Animation */}
               <div className="h-2 bg-indigo-100 rounded overflow-hidden max-w-[200px]">
                 <div className="h-full bg-indigo-500 animate-progress origin-left"></div>
               </div>
            </div>
          )}

          {/* Ergebnis-Anzeige */}
          {analysis && (
            <div className="mt-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none">
                {/* Rendert Markdown-Fettschrift */}
                {analysis.split('\n').map((line, i) => (
                  <p key={i} className="mb-2" dangerouslySetInnerHTML={{ 
                    __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-900">$1</strong>') 
                  }} />
                ))}
              </div>
              
              <button 
                onClick={handleAnalyze} 
                className="text-xs text-gray-400 hover:text-indigo-600 mt-4 flex items-center gap-1 transition-colors"
              >
                <ArrowRepeat size={10} /> Re-Kalkulation anfordern
              </button>
            </div>
          )}
          
          {/* Fehler-Anzeige */}
          {error && (
             <div className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded border border-red-100 flex items-center gap-2">
               <ExclamationTriangle size={16} className="shrink-0" />
               {error}
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
