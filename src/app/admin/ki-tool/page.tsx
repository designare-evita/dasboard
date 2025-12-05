'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

// Typen für unsere Daten
interface Project {
  id: string;
  email: string;
  domain: string;
  mandant_id?: string;
}

interface Keyword {
  query: string;
  clicks: number;
  position: number;
  impressions: number;
}

export default function KiToolPage() {
  // --- STATE ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const outputRef = useRef<HTMLDivElement>(null);

  // --- 1. PROJEKTE LADEN ---
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Fehler beim Laden der Projekte');
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error(error);
        toast.error('Projekte konnten nicht geladen werden.');
      } finally {
        setLoadingProjects(false);
      }
    }
    fetchProjects();
  }, []);

  // --- 2. PROJEKTDATEN (KEYWORDS) LADEN ---
  useEffect(() => {
    if (!selectedProjectId) {
      setKeywords([]);
      setGeneratedContent('');
      return;
    }

    const project = projects.find(p => p.id === selectedProjectId);
    setSelectedProject(project || null);

    async function fetchData() {
      setLoadingData(true);
      setKeywords([]);
      try {
        // Wir nutzen den existierenden Data-Endpoint
        const res = await fetch(`/api/data?projectId=${selectedProjectId}&dateRange=30d`);
        
        if (!res.ok) {
          const errData = await res.json();
          // 404 ist okay (keine Daten), andere Fehler nicht
          if (res.status !== 404) throw new Error(errData.message || 'Fehler beim Laden der Daten');
          toast.warning('Für dieses Projekt sind keine Google-Daten verfügbar.');
          return;
        }

        const data = await res.json();
        
        // Wir erwarten topQueries im Format des Google-Loaders
        if (data.topQueries && Array.isArray(data.topQueries)) {
          setKeywords(data.topQueries.slice(0, 20)); // Top 20 laden
        } else {
          toast.info('Keine Keywords für diesen Zeitraum gefunden.');
        }

      } catch (error) {
        console.error(error);
        toast.error('Fehler beim Abrufen der Projektdaten.');
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [selectedProjectId, projects]);

  // --- HANDLER ---

  const toggleKeyword = (query: string) => {
    setSelectedKeywords(prev => 
      prev.includes(query) 
        ? prev.filter(k => k !== query)
        : [...prev, query]
    );
  };

const handleGenerate = async () => {
  if (selectedKeywords.length === 0 || !selectedProject) {
    console.log('❌ Abbruch: Keine Keywords oder Projekt', { selectedKeywords, selectedProject });
    return;
  }

  console.log('🚀 Starte Generierung...', { keywords: selectedKeywords, domain: selectedProject.domain });
  
  setIsGenerating(true);
  setGeneratedContent('');

  try {
    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: selectedKeywords,
        domain: selectedProject.domain,
      }),
    });

    console.log('📡 Response Status:', response.status, response.statusText);
    console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Response nicht OK:', errorText);
      throw new Error(`${response.status}: ${errorText}`);
    }
    
    if (!response.body) {
      console.error('❌ Kein Response Body');
      throw new Error('Kein Antwort-Stream verfügbar');
    }

    console.log('✅ Stream verfügbar, starte Lesen...');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let fullContent = '';

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      
      if (value) {
        const chunkValue = decoder.decode(value, { stream: true });
        console.log('📦 Chunk empfangen:', chunkValue.length, 'Zeichen');
        fullContent += chunkValue;
        setGeneratedContent(fullContent);
      }
    }

    console.log('✅ Stream komplett. Gesamtlänge:', fullContent.length);

  } catch (error) {
    console.error('❌ Generierungsfehler:', error);
    toast.error('Fehler bei der KI-Generierung.');
  } finally {
    setIsGenerating(false);
  }
};

  // --- RENDER ---

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">KI Content Assistent</h1>
        <p className="text-gray-500">Erstellen Sie relevante W-Fragen basierend auf echten Google-Daten.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LINKE SPALTE: Steuerung (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* 1. PROJEKT AUSWAHL */}
          <div className="bg-white/80 backdrop-blur-md border border-gray-100 shadow-sm rounded-2xl p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Projekt wählen</label>
            <select
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedKeywords([]); // Reset Selection
              }}
              disabled={loadingProjects}
            >
              <option value="">-- Bitte wählen --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.domain} ({p.email})
                </option>
              ))}
            </select>
          </div>

          {/* 2. KEYWORDS LISTE */}
          {selectedProjectId && (
            <div className="bg-white/80 backdrop-blur-md border border-gray-100 shadow-sm rounded-2xl p-6 flex flex-col h-[600px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-800">Top Keywords</h2>
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                  {selectedKeywords.length} gewählt
                </span>
              </div>
              
              {loadingData ? (
                <div className="flex items-center justify-center flex-1 text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : keywords.length > 0 ? (
                <div className="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">
                  {keywords.map((kw, idx) => (
                    <div 
                      key={idx}
                      onClick={() => toggleKeyword(kw.query)}
                      className={`
                        group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200
                        ${selectedKeywords.includes(kw.query) 
                          ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                          : 'bg-white border-gray-100 hover:border-indigo-200 hover:bg-gray-50'}
                      `}
                    >
                      <div className={`
                        w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                        ${selectedKeywords.includes(kw.query) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}
                      `}>
                        {selectedKeywords.includes(kw.query) && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${selectedKeywords.includes(kw.query) ? 'text-indigo-900' : 'text-gray-700'}`}>
                          {kw.query}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Pos: {kw.position.toFixed(1)} • Klicks: {kw.clicks}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-gray-400 mt-10">Keine Daten verfügbar</div>
              )}

              {/* GENERATE BUTTON */}
              <div className="pt-4 mt-2 border-t border-gray-100">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || selectedKeywords.length === 0}
                  className={`
                    w-full py-3 px-4 rounded-xl font-semibold text-white shadow-lg transition-all transform active:scale-95
                    ${isGenerating || selectedKeywords.length === 0
                      ? 'bg-gray-300 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-200'}
                  `}
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"/>
                      Generiere...
                    </span>
                  ) : (
                    'Fragen generieren ✨'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RECHTE SPALTE: Output (8 Cols) */}
        <div className="lg:col-span-8">
            <div className="bg-white/90 backdrop-blur-xl border border-gray-100 shadow-xl rounded-2xl p-8 h-full min-h-[500px] flex flex-col relative overflow-hidden">
               
               {/* Decorative Background Blob */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

               <h2 className="text-lg font-semibold text-gray-800 mb-4 z-10 flex items-center gap-2">
                 <span className="text-2xl">📝</span> KI Ergebnis
               </h2>

               <div 
                 ref={outputRef}
                 className="flex-1 bg-gray-50/50 rounded-xl border border-gray-200/60 p-6 overflow-y-auto z-10 custom-scrollbar font-mono text-sm leading-relaxed text-gray-700 whitespace-pre-wrap"
               >
                 {generatedContent ? (
                   generatedContent
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-gray-400">
                     <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                     </svg>
                     <p>Wählen Sie Keywords aus und starten Sie die Generierung.</p>
                   </div>
                 )}
               </div>
            </div>
        </div>

      </div>
    </div>
  );
}
