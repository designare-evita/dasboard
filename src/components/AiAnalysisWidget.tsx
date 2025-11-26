// src/components/AiAnalysisWidget.tsx
'use client';

import { useState } from 'react';
import { Lightbulb, ArrowRepeat, Robot, Cpu, ExclamationTriangle } from 'react-bootstrap-icons';

interface Props {
  projectId: string;
  dateRange: string;
}

export default function AiAnalysisWidget({ projectId, dateRange }: Props) {
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleAnalyze = async () => {
    const endpoint = '/api/ai/analyze';
    console.log("[AI Widget] Starting analysis with:", { projectId, dateRange });
    setIsLoading(true);
    setError(null);
    setCompletion('');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId, dateRange }),
      });

      console.log("[AI Widget] Response status:", response.status);
      console.log("[AI Widget] Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Stream verarbeiten mit Throttling für flüssigeres Rendering
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let lastUpdateTime = Date.now();
      const UPDATE_INTERVAL = 100; // Update UI alle 100ms

      console.log("[AI Widget] Starting to read stream...");

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Finales Update mit komplettem Text
          setCompletion(accumulatedText);
          console.log("[AI Widget] Stream completed. Total length:", accumulatedText.length);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log("[AI Widget] Received chunk:", chunk.substring(0, 100));
        accumulatedText += chunk;

        // Throttle UI updates: Nur alle 100ms updaten
        const now = Date.now();
        if (now - lastUpdateTime >= UPDATE_INTERVAL) {
          setCompletion(accumulatedText);
          lastUpdateTime = now;
        }
      }

      setIsLoading(false);
      console.log("[AI Widget] Analysis finished successfully");

    } catch (err) {
      console.error("[AI Widget] Error:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  };

  // Benutzerfreundliche Fehlermeldung
  const displayError = error
    ? `Meine Verbindung zu den neuralen Netzwerken ist unterbrochen. ${error.message || 'Unbekannter Fehler'}`
    : null;

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
          
          {/* Initialzustand: Weder am Laden, noch Text vorhanden, noch Fehler */}
          {!completion && !isLoading && !displayError && (
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

          {/* Ladebalken, während die Daten verarbeitet werden (optional, falls der Stream etwas braucht um zu starten) */}
          {isLoading && !completion && (
            <div className="mt-3 space-y-2">
               <p className="text-sm text-indigo-600 font-medium animate-pulse">Verarbeite Datenströme...</p>
               <div className="h-2 bg-indigo-100 rounded overflow-hidden max-w-[200px]">
                 <div className="h-full bg-indigo-500 animate-progress origin-left"></div>
               </div>
            </div>
          )}

          {/* Hier wird das gestreamte HTML gerendert */}
          {completion && (
            <div className="mt-2 animate-in fade-in slide-in-from-bottom-2">
              <div 
                className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-h4:text-indigo-900 prose-h4:font-bold prose-h4:mb-1 prose-h4:mt-3"
                // Das HTML baut sich hier live auf
                dangerouslySetInnerHTML={{ __html: completion }}
              />
              
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
          
          {displayError && (
             <div className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded border border-red-100 flex items-center gap-2">
               <ExclamationTriangle size={16} className="shrink-0" />
               {displayError}
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
