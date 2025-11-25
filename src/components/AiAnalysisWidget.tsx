'use client';

import { useState } from 'react';
import { Lightbulb, ArrowRepeat, Stars } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
  dateRange: string;
}

export default function AiAnalysisWidget({ projectId, dateRange }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, dateRange }),
      });
      
      if (!res.ok) throw new Error('Fehler bei der Anfrage');
      
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (e) {
      setAnalysis("Entschuldigung, die KI-Analyse konnte momentan nicht erstellt werden. Bitte versuchen Sie es später erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card-glass p-6 mb-6 relative overflow-hidden transition-all border-l-4 border-l-indigo-500">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${analysis ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
          {isLoading ? <ArrowRepeat className="animate-spin" size={24} /> : <Stars size={24} />}
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Performance Analyst
              <span className="text-[10px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-0.5 rounded-full shadow-sm">GEMINI AI</span>
            </h3>
          </div>
          
          {!analysis && !isLoading && (
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

          {analysis && (
            <div className="mt-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none">
                {/* Falls Sie react-markdown installiert haben, sonst einfach {analysis} */}
                {analysis.split('\n').map((line, i) => <p key={i} className="mb-2">{line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').split(/(<strong>.*?<\/strong>)/).map((part, j) => part.startsWith('<strong>') ? <strong key={j}>{part.replace(/<\/?strong>/g, '')}</strong> : part)}</p>)}
              </div>
              <button 
                onClick={handleAnalyze} 
                className="text-xs text-gray-400 hover:text-indigo-600 mt-3 flex items-center gap-1"
              >
                <ArrowRepeat size={10} /> Neu analysieren
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
