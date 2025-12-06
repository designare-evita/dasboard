// src/app/admin/ki-tool/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  ChatText, 
  RocketTakeoff, 
  Magic, 
  Grid,
  FileEarmarkBarGraph, 
  Globe,
  Cpu,
  Binoculars,
  LightningCharge // Optional für Design-Elemente
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

type Tab = 'questions' | 'ctr' | 'gap' | 'spy';

export default function KiToolPage() {
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  
  // URL States
  const [analyzeUrl, setAnalyzeUrl] = useState('');     
  const [competitorUrl, setCompetitorUrl] = useState(''); 

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

  // --- 2. DATEN LADEN ---
  useEffect(() => {
    if (!selectedProjectId) {
      setKeywords([]);
      setGeneratedContent('');
      setAnalyzeUrl('');
      return;
    }

    const project = projects.find(p => p.id === selectedProjectId);
    setSelectedProject(project || null);

    if (project) {
        let cleanDomain = project.domain;
        if (!cleanDomain.startsWith('http')) {
            cleanDomain = `https://${cleanDomain}`;
        }
        setAnalyzeUrl(cleanDomain);
    }

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
          return;
        }

        const data = await res.json();
        
        if (data.topQueries && Array.isArray(data.topQueries)) {
          const topKeywords = data.topQueries.slice(0, 30);
          setKeywords(topKeywords);
          }

      } catch (error) {
        console.error('❌ Fetch Error:', error);
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

  // --- GENERIERUNGS-LOGIK ---
  const handleAction = async () => {
    if (!selectedProject) {
        toast.error('Bitte wählen Sie zuerst ein Projekt aus.');
        return;
    }

    if (activeTab === 'questions' && selectedKeywords.length === 0) {
        toast.error('Bitte wählen Sie Keywords aus.');
        return;
    }
    if ((activeTab === 'gap' || activeTab === 'spy') && !analyzeUrl) {
        toast.error('Bitte geben Sie Ihre URL ein.');
        return;
    }
    if (activeTab === 'spy' && !competitorUrl) {
        toast.error('Bitte geben Sie die URL des Konkurrenten ein.');
        return;
    }

    setIsGenerating(true);
    setIsWaitingForStream(true); 
    setGeneratedContent('');

    let endpoint = '';
    let body: any = {};

    if (activeTab === 'questions') {
        endpoint = '/api/ai/generate-questions';
        body = { keywords: selectedKeywords, domain: selectedProject.domain };
    } else if (activeTab === 'gap') {
        endpoint = '/api/ai/content-gap';
        body = { keywords: selectedKeywords, url: analyzeUrl }; 
    } else if (activeTab === 'spy') {
        endpoint = '/api/ai/competitor-spy';
        body = { myUrl: analyzeUrl, competitorUrl: competitorUrl };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      setIsWaitingForStream(false); 

      if (!response.ok) {
          const errorDetail = await response.text();
          throw new Error(errorDetail || response.statusText);
      }
      
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

    } catch (error: any) {
      console.error('❌ Fehler:', error);
      toast.error(`Fehler: ${error.message}`);
      setIsWaitingForStream(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- RENDER ---
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 relative">
      
      {/* LIGHTBOX */}
      {isWaitingForStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm transition-all animate-in fade-in duration-300">
           <div className="bg-white p-8 rounded-2xl shadow-2xl border border-indigo-100 flex flex-col items-center gap-6 max-w-sm text-center transform scale-100 animate-in zoom-in-95 duration-300">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse rounded-full"></div>
                <div className="relative z-10 bg-gradient-to-tr from-indigo-600 to-purple-600 p-4 rounded-xl shadow-lg">
                   <Cpu className="text-white text-3xl animate-spin-slow" /> 
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">KI @ Work</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {activeTab === 'gap' ? 'Analysiere Webseite...' : 
                   activeTab === 'spy' ? 'Vergleiche mit Konkurrenz...' : 
                   'Generiere Inhalte...'}
                </p>
              </div>

              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-1/3 rounded-full animate-indeterminate-bar"></div>
              </div>
           </div>
        </div>
      )}

      {/* HEADER */}
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
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('questions')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'questions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <ChatText size={18} />
            Fragen
          </button>

          <button
            onClick={() => setActiveTab('gap')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'gap' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <FileEarmarkBarGraph size={18} />
            Gap Analyse
          </button>

          <button
            onClick={() => setActiveTab('spy')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'spy' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <Binoculars size={18} />
            Competitor Spy
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold">NEU</span>
          </button>

          <button
            onClick={() => setActiveTab('ctr')}
            className={`
              flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'ctr' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <RocketTakeoff size={18} />
            CTR Booster
          </button>
        </nav>
      </div>

      {/* MAIN CONTENT AREA */}
      {!selectedProjectId ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-sm mb-4">
            <Magic className="text-gray-300 text-2xl" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Kein Projekt ausgewählt</h3>
            <p className="text-gray-500 mt-1">Bitte wählen Sie oben rechts ein Projekt aus.</p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {(activeTab !== 'ctr') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LINKER BEREICH: INPUTS */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* --- URL INPUTS FÜR SPY & GAP --- */}
                {(activeTab === 'gap' || activeTab === 'spy') && (
                  <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 space-y-4">
                    
                    {/* Input: MEINE URL */}
                    <div>
                        <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Globe className="text-indigo-500" /> Meine URL
                        </h2>
                        <input 
                            type="url" 
                            value={analyzeUrl}
                            onChange={(e) => setAnalyzeUrl(e.target.value)}
                            placeholder="https://meine-seite.de/artikel"
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>

                    {/* Input: GEGNER URL (Nur bei Spy) */}
                    {activeTab === 'spy' && (
                        <div className="pt-2 border-t border-gray-50 animate-in slide-in-from-top-2">
                            <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <Binoculars className="text-rose-500" /> Konkurrenz URL
                            </h2>
                            <input 
                                type="url" 
                                value={competitorUrl}
                                onChange={(e) => setCompetitorUrl(e.target.value)}
                                placeholder="https://konkurrenz.de/besserer-artikel"
                                className="w-full p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all text-gray-700 placeholder-rose-300"
                            />
                        </div>
                    )}
                    
                    <p className="text-xs text-gray-400">
                        {activeTab === 'spy' 
                         ? 'Wir vergleichen beide Seiten in Echtzeit.' 
                         : 'Wir prüfen diese Seite auf fehlende Keywords.'}
                    </p>
                  </div>
                )}

                {/* --- KEYWORD LISTE --- */}
                {(activeTab === 'questions' || activeTab === 'gap') && (
                  <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 flex flex-col h-[500px]">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="font-semibold text-gray-800">Keywords</h2>
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                        {selectedKeywords.length}
                      </span>
                    </div>
                    
                    {loadingData ? (
                        <div className="flex items-center justify-center flex-1"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div></div>
                    ) : keywords.length > 0 ? (
                      <div className="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">
                        {keywords.map((kw, idx) => (
                          <div 
                            key={idx}
                            onClick={() => toggleKeyword(kw.query)}
                            className={`
                              cursor-pointer p-2.5 rounded-lg border text-sm flex items-center gap-2 transition-all
                              ${selectedKeywords.includes(kw.query) ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-white border-gray-100 hover:bg-gray-50'}
                            `}
                          >
                             <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedKeywords.includes(kw.query) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                {selectedKeywords.includes(kw.query) && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                             </div>
                             <span className="truncate flex-1">{kw.query}</span>
                             <span className="text-xs text-gray-400 tabular-nums">{kw.clicks}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                        <div className="text-center text-sm text-gray-400 mt-10">Keine Daten</div>
                    )}
                  </div>
                )}

                {/* --- ACTION BUTTON --- */}
                <div className="mt-4">
                    <Button
                      onClick={handleAction}
                      disabled={isGenerating}
                      className="w-full h-auto py-4 text-base gap-2 text-white" 
                    >
                      {isGenerating ? 'Arbeite...' : 
                       activeTab === 'spy' ? <>Vergleich starten <Binoculars/></> :
                       activeTab === 'gap' ? 'Gap Analyse starten 🕵️' : 
                       'Fragen generieren ✨'}
                    </Button>
                </div>
              </div>

              {/* RECHTER BEREICH: OUTPUT */}
              <div className="lg:col-span-8">
                  <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-8 h-full min-h-[600px] flex flex-col relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
                     <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

                     <h2 className="text-lg font-semibold text-gray-800 mb-4 z-10 flex items-center gap-2">
                       {activeTab === 'spy' ? 'Konkurrenz Analyse' : activeTab === 'gap' ? 'Content Gap Report' : 'KI Ergebnis'}
                     </h2>

                     <div 
                       ref={outputRef}
                       className="flex-1 bg-gray-50/50 rounded-xl border border-gray-200/60 p-6 overflow-y-auto z-10 custom-scrollbar font-mono text-sm leading-relaxed text-gray-700 whitespace-pre-wrap"
                     >
                       {generatedContent ? generatedContent : (
                         <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-8">
                            {activeTab === 'spy' ? (
                                <>
                                    <Binoculars className="text-4xl mb-3 text-rose-200" />
                                    <p className="font-medium text-gray-500">Wer ist besser?</p>
                                    <p className="text-xs mt-2">Geben Sie links Ihre URL und die URL des Konkurrenten ein.</p>
                                </>
                            ) : activeTab === 'gap' ? (
                                <>
                                    <FileEarmarkBarGraph className="text-4xl mb-3 text-indigo-200" />
                                    <p>URL eingeben & Keywords wählen.</p>
                                </>
                            ) : (
                                <>
                                    <Magic className="text-4xl mb-3 text-indigo-200" />
                                    <p>Starten Sie den Fragen-Generator.</p>
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

      {/* --- NEUER BEREICH: MODUL INFO-BOXEN (IMMER SICHTBAR) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-10 border-t border-gray-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Box 1: Fragen */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <ChatText size={20} />
           </div>
           <h3 className="font-bold text-gray-900 mb-2">Fragen Generator</h3>
           <div className="text-sm text-gray-600 space-y-2 leading-relaxed">
              <p><span className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Aktion:</span> Generiert Fragen aus Keywords.</p>
              <p><span className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Ziel:</span> Neue Content-Ideen finden.</p>
           </div>
        </div>

        {/* Box 2: Gap Analyse */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <FileEarmarkBarGraph size={20} />
           </div>
           <h3 className="font-bold text-gray-900 mb-2">Gap Analyse</h3>
           <div className="text-sm text-gray-600 space-y-2 leading-relaxed">
              <p><span className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Aktion:</span> Prüft URL auf fehlende Keywords.</p>
              <p><span className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Ziel:</span> Rankings verbessern.</p>
           </div>
        </div>

        {/* Box 3: Competitor Spy */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <Binoculars size={20} />
           </div>
           <h3 className="font-bold text-gray-900 mb-2">Competitor Spy</h3>
           <div className="text-sm text-gray-600 space-y-2 leading-relaxed">
              <p><span className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Aktion:</span> Vergleich eigene vs. Konkurrenz URL.</p>
              <p><span className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Ziel:</span> Wettbewerbsvorteile sichern.</p>
           </div>
        </div>

        {/* Box 4: CTR Booster */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
              <RocketTakeoff size={20} />
           </div>
           <h3 className="font-bold text-gray-900 mb-2">CTR Booster</h3>
           <div className="text-sm text-gray-600 space-y-2 leading-relaxed">
              <p><span className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Aktion:</span> Optimiert Titel & Beschreibung.</p>
              <p><span className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Ziel:</span> Klickrate (CTR) erhöhen.</p>
           </div>
        </div>

      </div>
      
      <style jsx global>{`
        @keyframes indeterminate-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-indeterminate-bar {
          animation: indeterminate-bar 1.5s infinite linear;
        }
        .animate-spin-slow {
            animation: spin 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
