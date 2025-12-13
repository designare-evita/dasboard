// src/app/admin/ki-tool/page.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChatText, 
  RocketTakeoff, 
  Magic, 
  Binoculars, 
  GraphUpArrow, 
  Search, 
  PencilSquare, 
  Newspaper,
  CodeSquare
} from 'react-bootstrap-icons';

// --- Import der Module ---
import AiQuestionsCard from '@/components/AiQuestionsCard';
import CtrBooster from '@/components/admin/ki/CtrBooster';
import AiAnalysisWidget from '@/components/AiAnalysisWidget';
import LandingPageGenerator from '@/components/admin/ki/LandingPageGenerator';

// Typ-Definition der Tabs
type Tab = 'questions' | 'ctr' | 'gap' | 'spy' | 'trends' | 'schema' | 'news' | 'landingpage';

export default function KiToolPage() {
  const [activeTab, setActiveTab] = useState<Tab>('landingpage'); // Startet direkt im neuen Generator

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
      
      {/* Header Bereich */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Magic className="text-indigo-600" />
            <span>AI Content Suite</span>
          </h1>
          <p className="text-gray-500 mt-2">
            Nutze künstliche Intelligenz für Analysen, Content-Erstellung und Optimierung.
          </p>
        </div>
      </div>

      {/* Haupt-Navigation (Tabs) */}
      <div className="bg-white p-1 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <NavButton 
            active={activeTab === 'landingpage'} 
            onClick={() => setActiveTab('landingpage')}
            icon={<PencilSquare />}
            label="LP Generator"
            highlight // Hebt den neuen Generator hervor
          />
          <div className="w-px bg-gray-200 mx-1 my-2" /> {/* Separator */}
          <NavButton 
            active={activeTab === 'news'} 
            onClick={() => setActiveTab('news')}
            icon={<Newspaper />}
            label="News Crawler"
          />
          <NavButton 
            active={activeTab === 'questions'} 
            onClick={() => setActiveTab('questions')}
            icon={<ChatText />}
            label="W-Fragen"
          />
          <NavButton 
            active={activeTab === 'gap'} 
            onClick={() => setActiveTab('gap')}
            icon={<Search />}
            label="Content Gap"
          />
          <NavButton 
            active={activeTab === 'ctr'} 
            onClick={() => setActiveTab('ctr')}
            icon={<RocketTakeoff />}
            label="CTR Booster"
          />
          <NavButton 
            active={activeTab === 'spy'} 
            onClick={() => setActiveTab('spy')}
            icon={<Binoculars />}
            label="Competitor Spy"
          />
          <NavButton 
            active={activeTab === 'trends'} 
            onClick={() => setActiveTab('trends')}
            icon={<GraphUpArrow />}
            label="Trends"
          />
           <NavButton 
            active={activeTab === 'schema'} 
            onClick={() => setActiveTab('schema')}
            icon={<CodeSquare />}
            label="Schema"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[600px] animate-in fade-in duration-300">
        
        {/* 1. Landingpage Generator (NEU) */}
        {activeTab === 'landingpage' && (
          <LandingPageGenerator />
        )}

        {/* 2. News Crawler */}
        {activeTab === 'news' && (
           <div className="max-w-4xl mx-auto">
             <AiAnalysisWidget type="news" title="News & Trend Crawler" />
           </div>
        )}

        {/* 3. W-Fragen */}
        {activeTab === 'questions' && (
          <div className="max-w-4xl mx-auto">
            <AiQuestionsCard />
          </div>
        )}

        {/* 4. Content Gap */}
        {activeTab === 'gap' && (
          <div className="max-w-4xl mx-auto">
            <AiAnalysisWidget type="gap" title="Content Gap Analyse" />
          </div>
        )}

        {/* 5. CTR Booster */}
        {activeTab === 'ctr' && (
          <div className="max-w-4xl mx-auto">
            <CtrBooster />
          </div>
        )}

        {/* 6. Competitor Spy */}
        {activeTab === 'spy' && (
          <div className="max-w-4xl mx-auto">
            <AiAnalysisWidget type="spy" title="Competitor Spy" />
          </div>
        )}

        {/* 7. Trends (Platzhalter / Widget) */}
        {activeTab === 'trends' && (
          <div className="max-w-4xl mx-auto">
            <AiAnalysisWidget type="trends" title="Trend Radar" />
          </div>
        )}

        {/* 8. Schema (Platzhalter / Widget) */}
        {activeTab === 'schema' && (
          <div className="max-w-4xl mx-auto">
             <AiAnalysisWidget type="schema" title="Schema.org Generator" />
          </div>
        )}
      </div>
    </div>
  );
}

// Hilfskomponente für die Buttons
function NavButton({ 
  active, 
  onClick, 
  icon, 
  label,
  highlight = false
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  highlight?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`
        gap-2 px-4 py-2 rounded-lg transition-all
        ${active 
          ? (highlight ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' : 'bg-gray-100 text-gray-900 font-semibold') 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}
