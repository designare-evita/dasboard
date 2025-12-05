// src/app/admin/ki-tool/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { 
  ChatText, 
  RocketTakeoff, 
  Magic, 
  Grid,
  FileEarmarkBarGraph, // Neues Icon für Analyse
  Globe // Icon für URL
} from 'react-bootstrap-icons';
import CtrBooster from '@/components/admin/ki/CtrBooster';

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

// "gap" als neuer Tab
type Tab = 'questions' | 'ctr' | 'gap';

export default function KiToolPage() {
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  
  // States für Generierung (Fragen & Gap)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  
  // Spezieller State für Gap Analyse
  const [analyzeUrl, setAnalyzeUrl] = useState('');

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

  // --- 2. DATEN LADEN & URL VORAUSFÜLLEN ---
  useEffect(() => {
    if (!selectedProjectId) {
      setKeywords([]);
      setGeneratedContent('');
      setAnalyzeUrl('');
      return;
    }

    const project = projects.find(p => p.id === selectedProjectId);
    setSelectedProject(project || null);

    // URL vorausfüllen, wenn Projekt gewählt wird
    if (project) {
        let cleanDomain = project.domain;
        if (!cleanDomain.startsWith('http')) {
            cleanDomain = `https://${cleanDomain}`;
        }
        setAnalyzeUrl(cleanDomain);
    }

    // Nur Daten laden, wenn wir nicht im CTR Tab sind (der lädt selbst)
    if (activeTab === 'ctr') return;

    async function fetchData() {
      setLoadingData(true);
      setKeywords([]);
      try {
        const url = `/api/data?projectId=${selectedProjectId}&dateRange=30d`;
        
        const res = await fetch(url);
        
        if (!res.ok) {
          if (res.status !== 404) {
             const errData = await res.json();
             throw new Error(errData.message || 'Fehler');
          }
          toast.warning('Keine Daten verfügbar.');
          return;
        }

        const data = await res.json();
        
        if (data.topQueries && Array.isArray(data.topQueries)) {
          // Wir nehmen hier mehr Keywords für die Analyse mit (z.B. Top 50),
          // zeigen aber vielleicht weniger an oder lassen den User wählen.
          const topKeywords = data.topQueries.slice(0, 30);
          setKeywords(topKeywords);
          // Für Gap Analyse wählen wir standardmäßig alle Top 10 vor, damit der User direkt starten kann
          if (activeTab === 'gap') {
             setSelectedKeywords(topKeywords.slice(0, 10).map((k: Keyword) => k.query));
          }
        } else {
          toast.info('Keine Keywords gefunden.');
        }

      } catch (error) {
        console.error('❌ Fetch Error:', error);
        toast.error('Fehler beim Abrufen der Projektdaten.');
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [selectedProjectId, projects, activeTab]);

  const toggleKeyword = (query: string) => {
    setSelectedKeywords(prev => {
      return prev.includes(query) 
        ? prev.filter(k => k !== query)
        : [...prev, query];
    });
  };

  // --- GENERIERUNGS-LOGIK (ZENTRALISIERT) ---
  const handleAction = async () => {
    if (selectedKeywords.length === 0 || !selectedProject) {
      toast.error('Bitte wählen Sie ein Projekt und Keywords aus.');
      return;
    }

    setIsGenerating(true);
    setGeneratedContent('');

    // Endpunkt basierend auf Tab wählen
    let endpoint = '/api/ai/generate-questions';
    let body: any = {
        keywords: selectedKeywords,
        domain: selectedProject.domain,
    };

    if (activeTab === 'gap') {
        if (!analyzeUrl) {
            toast.error('Bitte geben Sie eine URL zur Analyse ein.');
            setIsGenerating(false);
            return;
        }
        endpoint = '/api/ai/content-gap'; // Neue Route
        body = {
            ...body,
            url: analyzeUrl
        };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) throw new Error(response.statusText);
      if (!response.body) throw new Error('Kein Stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        setGeneratedContent((prev) => prev + chunkValue);
        
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      }

    } catch (error) {
      console.error('❌ Fehler:', error);
      toast.error('Fehler bei der KI-Analyse.');
    } finally {
      setIsGenerating(false);
    }
  };

  // --- RENDER ---
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      
      {/* HEADER & PROJEKT WAHL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
            <Magic className="text-indigo-600" />
            KI Content Suite
          </h1>
          <p className="text-gray-500 mt-1">Nutzen Sie KI-Tools zur Optimierung Ihrer Inhalte.</p>
        </div>

        <div className="w-full md:w-80">
          <label className="block text-xs font-semibold text-gray-500 mb-1 ml-1 uppercase tracking-wider">Aktives Projekt</label>
          <div className="relative">
            <select
              className="w-full p-3 pl-10 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm appearance-none transition-all font-medium text-gray-700"
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedKeywords([]); 
                setGeneratedContent('');
              }}
              disabled={loadingProjects}
            >
              <option value="">-- Projekt wählen --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.domain}
                </option>
              ))}
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none">
              <Grid size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('questions')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'questions'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <ChatText size={18} />
            Fragen Generator
          </button>

          <button
            onClick={() => setActiveTab('gap')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'gap'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <FileEarmarkBarGraph size={18} />
            Content Gap
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">PRO</span>
          </button>

          <button
            onClick={() => setActiveTab('ctr')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'ctr'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            <RocketTakeoff size={18} />
            CTR Booster
          </button>
        </nav>
      </div>

      {/* CONTENT AREA */}
      {!selectedProjectId ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-sm mb-4">
            <Magic className="text-gray-300 text-2xl" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Kein Projekt ausgewählt</h3>
          <p className="text-gray-500 mt-1">Bitte wählen Sie oben rechts ein Projekt aus, um die Tools zu nutzen.</p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {(activeTab === 'questions' || activeTab === 'gap') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LINKER BEREICH: URL INPUT (Nur bei Gap) + KEYWORDS */}
              <div className="lg:col-span-4 space-y-6">
                
                {activeTab === 'gap' && (
                  <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
                    <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Globe className="text-indigo-500" /> Zu prüfende URL
                    </h2>
                    <input 
                        type="url" 
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                        placeholder="https://beispiel.de/unterseite"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                    <p className="text-xs text-gray-400 mt-2">
                        Wir crawlen diese URL und vergleichen sie mit den Keywords unten.
                    </p>
                  </div>
                )}

                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 flex flex-col h-[600px]">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-semibold text-gray-800">
                        {activeTab === 'gap' ? 'Vergleichs-Keywords' : 'Basis Keywords'}
                    </h2>
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
                            group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 select-none
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
                    <div className="text-center text-sm text-gray-400 mt-10">
                      Keine Daten verfügbar
                    </div>
                  )}

                  <div className="pt-4 mt-2 border-t border-gray-100">
                    <button
                      onClick={handleAction}
                      disabled={isGenerating || selectedKeywords.length === 0}
                      className={`
                        w-full py-3 px-4 rounded-xl font-semibold text-white shadow-lg transition-all transform active:scale-95
                        ${isGenerating || selectedKeywords.length === 0
                          ? 'bg-gray-300 cursor-not-allowed shadow-none'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-200'}
                      `}
                    >
                      {isGenerating ? 'Arbeite...' : activeTab === 'gap' ? 'Gap Analyse starten 🕵️' : 'Fragen generieren ✨'}
                    </button>
                  </div>
                </div>
              </div>

              {/* RECHTER BEREICH: OUTPUT */}
              <div className="lg:col-span-8">
                  <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-8 h-full min-h-[600px] flex flex-col relative overflow-hidden">
                     {/* Bunter Hintergrund Blob nur bei Resultat oder Idle */}
                     <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
                     <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

                     <h2 className="text-lg font-semibold text-gray-800 mb-4 z-10 flex items-center gap-2">
                       {activeTab === 'gap' ? 'Analyse Ergebnis' : 'KI Ergebnis'}
                     </h2>

                     <div 
                       ref={outputRef}
                       className="flex-1 bg-gray-50/50 rounded-xl border border-gray-200/60 p-6 overflow-y-auto z-10 custom-scrollbar font-mono text-sm leading-relaxed text-gray-700 whitespace-pre-wrap"
                     >
                       {generatedContent ? generatedContent : (
                         <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-8">
                            {activeTab === 'gap' ? (
                                <>
                                    <FileEarmarkBarGraph className="text-4xl mb-3 text-indigo-200" />
                                    <p className="font-medium text-gray-500">Bereit für die Analyse</p>
                                    <p className="text-xs mt-2">Wählen Sie links Keywords aus, die auf der Seite vorkommen sollen.<br/>Geben Sie oben die passende URL ein.</p>
                                </>
                            ) : (
                                <>
                                    <Magic className="text-4xl mb-3 text-indigo-200" />
                                    <p>Wählen Sie Keywords aus und starten Sie die Generierung.</p>
                                </>
                            )}
                         </div>
                       )}
                     </div>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'ctr' && (
            <div className="w-full">
              <CtrBooster projectId={selectedProjectId} />
            </div>
          )}
          
        </div>
      )}
    </div>
  );
}
