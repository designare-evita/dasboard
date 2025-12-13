// src/app/admin/ki-tool/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  ChatText, 
  RocketTakeoff, 
  Magic, 
  Binoculars, 
  GraphUpArrow, 
  Search, 
  PencilSquare, 
  Newspaper,
  CodeSquare,
  Building,
  ChevronDown
} from 'react-bootstrap-icons';

// --- Import der Module ---
import AiQuestionsCard from '@/components/AiQuestionsCard';
import CtrBooster from '@/components/admin/ki/CtrBooster';
import AiAnalysisWidget from '@/components/AiAnalysisWidget';
import LandingPageGenerator from '@/components/admin/ki/LandingPageGenerator';

// Typ-Definitionen
type Tab = 'questions' | 'ctr' | 'gap' | 'spy' | 'trends' | 'schema' | 'news' | 'landingpage';

interface Project {
  id: string;
  domain: string;
  // weitere Felder falls nötig
}

export default function KiToolPage() {
  const [activeTab, setActiveTab] = useState<Tab>('landingpage');
  
  // --- PROJEKT LOGIK (Wiederhergestellt) ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Fehler beim Laden der Projekte');
        const data = await res.json();
        
        // Annahme: API gibt { projects: [...] } oder direkt Array zurück
        const projectList = Array.isArray(data) ? data : (data.projects || []);
        setProjects(projectList);

        // Erstes Projekt vorauswählen, falls vorhanden
        if (projectList.length > 0) {
          setSelectedProject(projectList[0]);
        }
      } catch (error) {
        console.error("Projekte konnten nicht geladen werden:", error);
        toast.error("Konnte Projekte nicht laden.");
      } finally {
        setIsLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
      
      {/* Header Bereich mit Projektauswahl */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Magic className="text-indigo-600" />
            <span>AI Content Suite</span>
          </h1>
          <p className="text-gray-500 mt-2">
            Nutze künstliche Intelligenz für deine Projekte.
          </p>
        </div>

        {/* --- PROJEKT SELEKTOR --- */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
           <div className="p-2 bg-indigo-50 rounded-md text-indigo-600">
             <Building />
           </div>
           <div className="relative min-w-[200px]">
             <label className="text-xs text-gray-500 font-medium block">Aktives Projekt</label>
             {isLoadingProjects ? (
               <div className="h-5 w-24 bg-gray-100 animate-pulse rounded mt-1"></div>
             ) : (
               <select 
                 className="w-full bg-transparent font-semibold text-gray-900 outline-none appearance-none cursor-pointer pr-4"
                 value={selectedProject?.id || ''}
                 onChange={(e) => {
                   const proj = projects.find(p => p.id === e.target.value);
                   setSelectedProject(proj || null);
                   if(proj) toast.success(`Projekt gewechselt: ${proj.domain}`);
                 }}
               >
                 <option value="" disabled>Kein Projekt gewählt</option>
                 {projects.map(p => (
                   <option key={p.id} value={p.id}>{p.domain}</option>
                 ))}
               </select>
             )}
             <ChevronDown className="absolute right-0 bottom-1 text-gray-400 pointer-events-none w-3 h-3" />
           </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white p-1 rounded-xl border border-gray-200 shadow-sm overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 min-w-max">
          <NavButton 
            active={activeTab === 'landingpage'} 
            onClick={() => setActiveTab('landingpage')}
            icon={<PencilSquare />}
            label="LP Generator"
            highlight
          />
          <div className="w-px bg-gray-200 mx-1 my-2" />
          <NavButton active={activeTab === 'news'} onClick={() => setActiveTab('news')} icon={<Newspaper />} label="News Crawler" />
          <NavButton active={activeTab === 'questions'} onClick={() => setActiveTab('questions')} icon={<ChatText />} label="W-Fragen" />
          <NavButton active={activeTab === 'gap'} onClick={() => setActiveTab('gap')} icon={<Search />} label="Content Gap" />
          <NavButton active={activeTab === 'ctr'} onClick={() => setActiveTab('ctr')} icon={<RocketTakeoff />} label="CTR Booster" />
          <NavButton active={activeTab === 'spy'} onClick={() => setActiveTab('spy')} icon={<Binoculars />} label="Competitor Spy" />
          <NavButton active={activeTab === 'trends'} onClick={() => setActiveTab('trends')} icon={<GraphUpArrow />} label="Trends" />
          <NavButton active={activeTab === 'schema'} onClick={() => setActiveTab('schema')} icon={<CodeSquare />} label="Schema" />
        </div>
      </div>

      {/* Content Area - Wir geben das selectedProject weiter, wo es Sinn macht */}
      <div className="min-h-[600px] animate-in fade-in duration-300">
        
        {activeTab === 'landingpage' && (
          // Wir übergeben hier zwar keine Props, aber der User sieht oben sein Projekt
          // Optional: Du könntest LandingPageGenerator erweitern, um 'domain' als Prop zu nehmen
          <LandingPageGenerator /> 
        )}

        {activeTab === 'news' && (
           <div className="max-w-4xl mx-auto">
             <AiAnalysisWidget type="news" title={`News für ${selectedProject?.domain || '...'}`} />
           </div>
        )}

        {activeTab === 'questions' && (
          <div className="max-w-4xl mx-auto">
             {/* Hier übergeben wir die Domain des gewählten Projekts an die Card */}
            <AiQuestionsCard domain={selectedProject?.domain} />
          </div>
        )}

        {activeTab === 'gap' && (
          <div className="max-w-4xl mx-auto">
            <AiAnalysisWidget 
              type="gap" 
              title="Content Gap Analyse" 
              // Wir nutzen das Widget im "Tool Mode", können aber Default-Werte setzen, wenn du AiAnalysisWidget erweiterst
              projectId={selectedProject?.id} 
              domain={selectedProject?.domain} 
            />
          </div>
        )}

        {activeTab === 'ctr' && (
          <div className="max-w-4xl mx-auto">
            <CtrBooster />
          </div>
        )}

        {activeTab === 'spy' && (
          <div className="max-w-4xl mx-auto">
            <AiAnalysisWidget type="spy" title="Competitor Spy" />
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="max-w-4xl mx-auto">
            <AiAnalysisWidget type="trends" title="Trend Radar" />
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="max-w-4xl mx-auto">
             <AiAnalysisWidget type="schema" title="Schema.org Generator" />
          </div>
        )}
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, highlight = false }: any) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`gap-2 px-4 py-2 rounded-lg transition-all ${
        active 
          ? (highlight ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' : 'bg-gray-100 text-gray-900 font-semibold') 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}
