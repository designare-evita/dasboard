'use client';

import { Lightbulb, ArrowRepeat, Stars } from 'react-bootstrap-icons';
import { useCompletion } from '@ai-sdk/react'; // KORREKTUR: Import aus @ai-sdk/react

interface Props {
  projectId: string;
  dateRange: string;
}

export default function AiAnalysisWidget({ projectId, dateRange }: Props) {
  // useCompletion verwaltet den Stream und den Ladezustand
  const { 
    completion,   // Der generierte Text (wächst live)
    isLoading,    // true während der Generierung
    complete      // Funktion zum Starten
  } = useCompletion({
    api: '/api/ai/analyze', 
    onError: (error) => {
      console.error("Stream error:", error);
    }
  });

  const handleAnalyze = async () => {
    // Wir starten die Generierung. 
    // Der erste Parameter ist der Prompt (hier leer, da wir serverseitig Daten nutzen),
    // der zweite Parameter übergibt unseren Body.
    await complete('', {
      body: { projectId, dateRange }
    });
  };

  // Hilfsfunktion: Rendert einfaches Markdown (fett gedruckt) live
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => (
      <p key={i} className="mb-2">
        {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </p>
    ));
  };

  return (
    <div className="card-glass p-6 mb-6 relative overflow-hidden transition-all border-l-4 border-l-indigo-500">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${completion ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
          {isLoading ? <ArrowRepeat className="animate-spin" size={24} /> : <Stars size={24} />}
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Performance Analyst
              <span className="text-[10px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-0.5 rounded-full shadow-sm">GEMINI AI</span>
            </h3>
          </div>
          
          {/* Zeige Start-Button nur, wenn noch nichts läuft und kein Ergebnis da ist */}
          {!completion && !isLoading && (
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-3">
                Lassen Sie Google Gemini Ihre aktuellen Daten interpretieren, um Ursachen für Traffic-Veränderungen zu finden.
              </p>
              <button
                onClick={handleAnalyze}
                className="text-sm bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 px-4 py-2 rounded-md transition-all flex items-center gap-2 shadow-sm"
              >
                <Lightbulb size={14} />
                Analyse starten
              </button>
            </div>
          )}

          {/* Anzeige während des Ladens oder wenn Text da ist */}
          {(completion || isLoading) && (
            <div className="mt-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none min-h-[60px]">
                {completion ? renderMarkdown(completion) : <span className="text-gray-400 italic">Analysiere Daten...</span>}
              </div>
              
              {!isLoading && completion && (
                <button 
                  onClick={handleAnalyze} 
                  className="text-xs text-gray-400 hover:text-indigo-600 mt-3 flex items-center gap-1"
                >
                  <ArrowRepeat size={10} /> Neu analysieren
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
