'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Search,
  Newspaper,
  FileEarmarkBarGraph,
  Download,
  ClipboardCheck,
  FileEarmarkCode,
  Markdown,
  ChevronDown,
  ChevronUp,
  Lightning,
  Database,
  PlusCircle,
  Binoculars,
  CheckLg,
  InfoCircle,
  ArrowRepeat
} from 'react-bootstrap-icons';
import {
  downloadAsText,
  downloadAsHtml,
  downloadAsMarkdown,
  copyToClipboard,
} from '@/lib/export-utils';

// ============================================================================
// TYPES
// ============================================================================

interface Keyword {
  query: string;
  clicks: number;
  position: number;
  impressions: number;
}

// Angepasst für page.tsx Kompatibilität
interface LandingpageGeneratorProps {
  projectId?: string;
  domain?: string;
  keywords?: Keyword[];
  loadingKeywords?: boolean;
}

type ToneOfVoice = 'professional' | 'casual' | 'technical' | 'emotional';

interface ContextData {
  gscKeywords?: string[];
  gscKeywordsRaw?: Keyword[];
  newsInsights?: string;
  gapAnalysis?: string;
  competitorAnalysis?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TONE_OPTIONS: { value: ToneOfVoice; label: string; description: string }[] = [
  { value: 'professional', label: 'Professionell', description: 'Seriös & vertrauenswürdig' },
  { value: 'casual', label: 'Locker', description: 'Freundlich & nahbar' },
  { value: 'technical', label: 'Technisch', description: 'Detailliert & fachlich' },
  { value: 'emotional', label: 'Emotional', description: 'Storytelling & bewegend' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function LandingPageGenerator({
  projectId,
  domain = '',
  keywords = [],
  loadingKeywords = false,
}: LandingpageGeneratorProps) {
  
  // --- STATES ---
  
  // Basis-Inputs
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [tone, setTone] = useState<ToneOfVoice>('professional');
  const [customKeywords, setCustomKeywords] = useState('');
  
  // SPY FEATURE
  const [referenceUrl, setReferenceUrl] = useState('');
  const [isSpying, setIsSpying] = useState(false);
  const [spyData, setSpyData] = useState<string | null>(null);

  // GAP FEATURE
  const [isAnalyzingGap, setIsAnalyzingGap] = useState(false);
  const [cachedGapData, setCachedGapData] = useState<string | null>(null);

  // Datenquellen-Toggles
  const [useGscKeywords, setUseGscKeywords] = useState(true);
  const [useNewsCrawler, setUseNewsCrawler] = useState(false);
  const [useGapAnalysis, setUseGapAnalysis] = useState(false);
  
  // News-Crawler Einstellungen
  const [newsMode, setNewsMode] = useState<'live' | 'cache'>('live');
  const [newsTopic, setNewsTopic] = useState('');
  const [cachedNewsData, setCachedNewsData] = useState<string | null>(null);
  
  // UI States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('sources');
  
  const outputRef = useRef<HTMLDivElement>(null);

  // --- HELPERS ---
  
  const getAllKeywords = (): string[] => {
    const result: string[] = [];
    if (useGscKeywords && keywords.length > 0) {
      keywords.slice(0, 10).forEach(k => { if (!result.includes(k.query)) result.push(k.query); });
    }
    if (customKeywords.trim()) {
      customKeywords.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 0).forEach(k => {
        if (!result.includes(k)) result.push(k);
      });
    }
    return result;
  };

  const totalKeywordCount = getAllKeywords().length;

  // --- HANDLERS ---

  // 1. SPY: URL Analysieren
  const handleAnalyzeUrl = async () => {
    if (!referenceUrl) return;
    try {
      setIsSpying(true);
      toast.info('Analysiere Referenz-Webseite...');
      const res = await fetch('/api/ai/competitor-spy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ myUrl: referenceUrl }),
      });
      if (!res.ok) throw new Error('Analyse fehlgeschlagen');
      const data = await res.text();
      setSpyData(data);
      toast.success('Stil & Inhalt erfasst!');
    } catch (e) {
      console.error(e);
      toast.error('Konnte URL nicht analysieren.');
    } finally {
      setIsSpying(false);
    }
  };

  // 2. GAP: Content Gap Analyse (Fehlte vorher!)
  const handleAnalyzeGap = async () => {
    if (!topic) {
        toast.error('Bitte erst ein Thema eingeben.');
        return;
    }
    try {
        setIsAnalyzingGap(true);
        toast.info('Führe Gap-Analyse durch...');
        const res = await fetch('/api/ai/content-gap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, domain }),
        });
        if (!res.ok) throw new Error('Gap-Analyse fehlgeschlagen');
        const data = await res.text(); // oder .json() je nach Endpoint
        setCachedGapData(data);
        setUseGapAnalysis(true); // Automatisch aktivieren
        toast.success('Content Gaps identifiziert!');
    } catch (e) {
        console.error(e);
        toast.error('Gap-Analyse Fehler');
    } finally {
        setIsAnalyzingGap(false);
    }
  };

  // 3. MAIN: Generierung
  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error('Bitte geben Sie ein Thema ein.'); return; }
    if (getAllKeywords().length === 0) { toast.error('Bitte Keywords angeben.'); return; }
    
    if (useNewsCrawler && newsMode === 'live' && !newsTopic.trim()) {
       // Fallback: Wenn kein News-Topic, nimm das Hauptthema
       setNewsTopic(topic);
    }

    setIsGenerating(true);
    setIsWaitingForStream(true);
    setGeneratedContent('');

    try {
      const contextData: ContextData = {};
      
      // Spy Data (Auto-Fetch wenn URL da aber noch nicht gescannt)
      let currentSpyData = spyData;
      if (referenceUrl && !currentSpyData) {
         try {
            const res = await fetch('/api/ai/competitor-spy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ myUrl: referenceUrl }),
            });
            if (res.ok) currentSpyData = await res.text();
         } catch(e) { console.error(e); }
      }
      if (currentSpyData) contextData.competitorAnalysis = currentSpyData;

      // GSC
      if (useGscKeywords && keywords.length > 0) {
        contextData.gscKeywords = keywords.slice(0, 10).map(k => k.query);
        contextData.gscKeywordsRaw = keywords.slice(0, 30);
      }
      
      // News-Crawler (Live Logic)
      if (useNewsCrawler) {
        if (newsMode === 'live') {
          const fetchTopic = newsTopic.trim() || topic;
          toast.info(`Suche News zu: ${fetchTopic}...`);
          
          const newsResponse = await fetch('/api/ai/news-crawler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: fetchTopic }),
          });
          
          if (newsResponse.ok && newsResponse.body) {
            const reader = newsResponse.body.getReader();
            const decoder = new TextDecoder();
            let newsContent = '';
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              newsContent += decoder.decode(value, { stream: true });
            }
            contextData.newsInsights = newsContent;
            setCachedNewsData(newsContent);
          }
        } else if (newsMode === 'cache' && cachedNewsData) {
          contextData.newsInsights = cachedNewsData;
        }
      }
      
      // Gap-Analyse
      if (useGapAnalysis && cachedGapData) {
        contextData.gapAnalysis = cachedGapData;
      }

      // API Call
      const response = await fetch('/api/ai/generate-landingpage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          keywords: getAllKeywords(),
          targetAudience: targetAudience.trim() || undefined,
          toneOfVoice: tone,
          contextData,
          domain,
        }),
      });

      setIsWaitingForStream(false);

      if (!response.ok) throw new Error(await response.text());
      if (!response.body) throw new Error('Kein Stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        setGeneratedContent((prev) => prev + chunkValue);
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
      toast.success('Content erfolgreich generiert!');
    } catch (error: any) {
      console.error(error);
      toast.error(`Fehler: ${error.message}`);
      setIsWaitingForStream(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = (format: 'txt' | 'html' | 'md') => {
    if (!generatedContent) return;
    switch (format) {
      case 'txt': downloadAsText(generatedContent, topic || 'lp'); break;
      case 'html': downloadAsHtml(generatedContent, topic || 'lp'); break;
      case 'md': downloadAsMarkdown(generatedContent, topic || 'lp'); break;
    }
    setShowExportMenu(false);
  };

  const handleCopy = async () => {
    if (generatedContent) {
        await copyToClipboard(generatedContent);
        toast.success('Kopiert!');
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // --- RENDER ---
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* LOADING OVERLAY */}
      {isWaitingForStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-md transition-all animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 flex flex-col items-center gap-6 max-w-md w-full text-center">
            <div className="relative w-full flex justify-center">
              <Image src="/data-max-arbeitet.webp" alt="KI arbeitet" width={400} height={400} className="h-[200px] w-auto object-contain" priority />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Content wird erstellt</h3>
              <p className="text-gray-500 text-sm">{useNewsCrawler && newsMode === 'live' ? 'Recherchiere News & schreibe...' : 'Generiere Landingpage...'}</p>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
               <div className="h-full bg-purple-500 w-1/3 rounded-full animate-indeterminate-bar"></div>
            </div>
          </div>
        </div>
      )}

      {/* --- INPUTS (LINKS) --- */}
      <div className="lg:col-span-4 space-y-4">
        
        {/* 1. BRIEFING CARD */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
          <div className="text-center pb-4 border-b border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileText className="text-2xl text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900">Landingpage Generator</h3>
            <p className="text-xs text-gray-500 mt-1">für <strong className="text-gray-700">{domain || 'dieses Projekt'}</strong></p>
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Lightning className="text-purple-500" /> Thema / H1 *
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="z.B. IT-Service München..."
              className="w-full p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          {/* SPY SECTION */}
          <div className="mt-4 bg-amber-50/60 p-4 rounded-xl border border-amber-100 space-y-3">
             <div className="flex items-start gap-2">
               <Binoculars className="text-amber-600 mt-1 shrink-0" /> 
               <div>
                 <label className="text-sm font-medium text-gray-900 block">Spy & Clone (Optional)</label>
                 <p className="text-[11px] text-gray-500 leading-tight">URL analysieren und Stil übernehmen.</p>
               </div>
             </div>
             <div className="flex gap-2">
               <input
                 value={referenceUrl}
                 onChange={(e) => { setReferenceUrl(e.target.value); setSpyData(null); }}
                 placeholder="https://..."
                 className="flex-1 px-3 py-2 border border-amber-200 bg-white rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
               />
               <Button 
                 onClick={handleAnalyzeUrl}
                 disabled={!referenceUrl || isSpying || !!spyData}
                 variant="outline" size="sm"
                 className={`border-amber-200 ${spyData ? 'bg-green-50 text-green-700' : 'hover:bg-amber-100 text-amber-700'}`}
               >
                 {spyData ? <CheckLg /> : 'Check'}
               </Button>
             </div>
             {referenceUrl && spyData && (
                <div className="text-[10px] text-green-700 flex gap-1 items-center">
                    <CheckLg/> Analyse erfolgreich gespeichert.
                </div>
             )}
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Zielgruppe</label>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="z.B. KMUs, Ärzte..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-400 outline-none"
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Tonalität</label>
            <div className="grid grid-cols-2 gap-2">
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTone(option.value)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    tone === option.value ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="font-medium block">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. DATENQUELLEN CARD */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <button onClick={() => toggleSection('sources')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2 font-semibold text-gray-800"><Database className="text-indigo-500" /> Datenquellen</div>
            {expandedSection === 'sources' ? <ChevronUp /> : <ChevronDown />}
          </button>

          {expandedSection === 'sources' && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              
              {/* GSC Toggle */}
              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <input type="checkbox" checked={useGscKeywords} onChange={(e) => setUseGscKeywords(e.target.checked)} className="mt-1 rounded text-indigo-600" />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-800">GSC Keywords</div>
                  <div className="text-xs text-gray-500">{loadingKeywords ? 'Lade...' : `${keywords.length} verfügbar`}</div>
                </div>
              </label>

              {/* News Toggle */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={useNewsCrawler} onChange={(e) => setUseNewsCrawler(e.target.checked)} className="mt-1 rounded text-indigo-600" />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-800 flex items-center gap-2"><Newspaper className="text-indigo-500" /> News-Crawler</div>
                  </div>
                </label>
                {useNewsCrawler && (
                    <div className="pl-6 space-y-2">
                        <div className="flex gap-2 text-xs">
                           <button onClick={() => setNewsMode('live')} className={`px-2 py-1 rounded border ${newsMode==='live' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white'}`}>Live</button>
                           <button onClick={() => setNewsMode('cache')} disabled={!cachedNewsData} className={`px-2 py-1 rounded border ${newsMode==='cache' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white opacity-50'}`}>Cache</button>
                        </div>
                        {newsMode === 'live' && (
                            <input value={newsTopic} onChange={(e) => setNewsTopic(e.target.value)} placeholder="News Thema (leer = H1)" className="w-full p-1.5 text-xs border rounded" />
                        )}
                    </div>
                )}
              </div>

              {/* Gap Analysis (mit Button!) */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={useGapAnalysis} 
                            onChange={(e) => setUseGapAnalysis(e.target.checked)} 
                            disabled={!cachedGapData}
                            className="rounded text-indigo-600 disabled:opacity-50" 
                        />
                        <span className="font-medium text-sm text-gray-800 flex items-center gap-2">
                            <FileEarmarkBarGraph className="text-indigo-500" /> Gap-Analyse
                        </span>
                    </label>
                    <Button 
                        onClick={handleAnalyzeGap} 
                        disabled={isAnalyzingGap || !topic}
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs px-2 text-indigo-600 hover:bg-indigo-50"
                    >
                        {isAnalyzingGap ? <ArrowRepeat className="animate-spin" /> : 'Scan'}
                    </Button>
                </div>
                <div className="text-xs text-gray-500 pl-6">
                    {cachedGapData ? 'Daten verfügbar' : 'Noch keine Analyse'}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* 3. KEYWORDS CARD */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <label className="font-semibold text-gray-800 flex items-center gap-2 text-sm"><PlusCircle className="text-emerald-500" /> Manuelle Keywords</label>
            <span className="text-xs font-medium text-gray-400">{totalKeywordCount} Total</span>
          </div>
          <textarea
            value={customKeywords}
            onChange={(e) => setCustomKeywords(e.target.value)}
            placeholder="Keywords hier einfügen..."
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-20 resize-none"
          />
        </div>

        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full py-6 text-base gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200">
          {isGenerating ? 'Generiere...' : <><FileText /> Landingpage erstellen</>}
        </Button>
      </div>

      {/* --- OUTPUT (RECHTS) --- */}
      <div className="lg:col-span-8">
        <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-8 h-full min-h-[600px] flex flex-col relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 z-10">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><FileText className="text-purple-500" /> Ergebnis</h2>
            {generatedContent && (
              <div className="flex gap-2">
                <button onClick={handleCopy} className="p-2 hover:bg-gray-100 rounded-lg"><ClipboardCheck/></button>
                <div className="relative">
                   <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-1 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium"><Download/> Export</button>
                   {showExportMenu && (
                     <div className="absolute right-0 mt-2 w-40 bg-white border rounded-xl shadow-lg z-20">
                       <button onClick={() => handleExport('txt')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">TXT</button>
                       <button onClick={() => handleExport('html')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">HTML</button>
                       <button onClick={() => handleExport('md')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">Markdown</button>
                     </div>
                   )}
                </div>
              </div>
            )}
          </div>
          <div ref={outputRef} className="flex-1 bg-gray-50/50 rounded-xl border border-gray-200/60 p-6 overflow-y-auto z-10 custom-scrollbar ai-output">
            {generatedContent ? (
              <div className="ai-content prose max-w-none" dangerouslySetInnerHTML={{ __html: generatedContent }} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
                <FileText className="text-4xl mb-3 text-purple-200" />
                <p className="font-medium text-gray-500">Bereit.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
