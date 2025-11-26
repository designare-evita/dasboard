'use client';

import { useState } from 'react';
// Robot Icon hinzugefügt für "Data Max" Feeling
import { Lightbulb, ArrowRepeat, Robot, Cpu } from 'react-bootstrap-icons';
import { useCompletion } from '@ai-sdk/react';

interface Props {
  projectId: string;
  dateRange: string;
}

export default function AiAnalysisWidget({ projectId, dateRange }: Props) {
  const { complete, completion, isLoading, error } = useCompletion({
    api: '/api/ai/analyze',
  });

  const handleAnalyze = async () => {
    await complete('', {
      body: { projectId, dateRange }
    });
  };

  return (
    <div className="card-glass p-6 mb-6 relative overflow-hidden transition-all border-l-4 border-l-indigo-500">
      <div className="flex items-start gap-4">
        {/* Icon Container: Robot Icon für Data Max */}
        <div className={`p-3 rounded-xl transition-colors duration-500 ${
          isLoading ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 
          completion ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'
        }`}>
          {isLoading ? <Cpu size={24} className="animate-spin" /> : <Robot size={24} />}
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Data Max 
              <span className="text-[10px] font-normal bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                Performance AI v1.0
              </span>
            </h3>
          </div>
          
          {!completion && !isLoading && (
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-3 italic">
                "Ich bin bereit, Ihre Daten zu verarbeiten. Soll ich eine logische Analyse der aktuellen Performance-Parameter initiieren?"
              </p>
              <button
                onClick={handleAnalyze}
                className="text-sm bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 px-4 py-2 rounded-md transition-all flex items-center gap-2 shadow-sm group"
              >
                <Lightbulb size={14} className="group-hover:text-yellow-500 transition-colors"/>
                Analyse initiieren
              </button>
            </div>
          )}

          {(completion || isLoading) && (
            <div className="mt-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none">
                {/* Data Max Antwort rendern */}
                {completion.split('\n').map((line, i) => (
                  <p key={i} className="mb-2" dangerouslySetInnerHTML={{ 
                    __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-900">$1</strong>') 
                  }} />
                ))}
                {isLoading && <span className="inline-flex gap-1 ml-1 items-center"><span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce"></span><span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-100"></span><span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-200"></span></span>}
              </div>
              
              {!isLoading && (
                <button 
                  onClick={handleAnalyze} 
                  className="text-xs text-gray-400 hover:text-indigo-600 mt-4 flex items-center gap-1 transition-colors"
                >
                  <ArrowRepeat size={10} /> Re-Kalkulation anfordern
                </button>
              )}
            </div>
          )}
          
          {error && (
             <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">
               Es gibt einen Fehler im System. Bitte versuchen Sie es erneut.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
