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
  Binoculars, // NEU: Für Spy
  CheckLg,    // NEU: Für Spy
  InfoCircle  // NEU: Für Spy
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

// FIX: Props angepasst, damit page.tsx nicht meckert
interface LandingpageGeneratorProps {
  projectId?: string;        // Optional gemacht
  domain?: string;           // Optional gemacht
  keywords?: Keyword[];      // Optional gemacht
  loadingKeywords?: boolean; // Optional gemacht
}

type ToneOfVoice = 'professional' | 'casual' | 'technical' | 'emotional';

interface ContextData {
  gscKeywords?: string[];
  gscKeywordsRaw?: Keyword[];  
  newsInsights?: string;
  gapAnalysis?: string;
  competitorAnalysis?: string; // NEU: Für Spy Daten
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

export default function LandingpageGenerator({
  projectId,
  domain = '',
  keywords = [], // Default leeres Array
  loadingKeywords = false,
}: LandingpageGeneratorProps) {
  
  // --- STATES ---
  
  // Basis-Inputs
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [tone, setTone] = useState<ToneOfVoice>('professional');
  const [customKeywords, setCustomKeywords] = useState('');
  
  // SPY / REFERENCE URL STATE (NEU HINZUGEFÜGT)
  const [referenceUrl, setReferenceUrl] = useState('');
  const [isSpying, setIsSpying] = useState(false);
  const [spyData, setSpyData] = useState<string | null>(null);

  // Datenquellen-Toggles
  const [useGscKeywords, setUseGscKeywords] = useState(true);
  const [useNewsCrawler, setUseNewsCrawler] = useState(false);
  const [useGapAnalysis, setUseGapAnalysis] = useState(false);
  
  // News-Crawler Einstellungen
  const [newsMode, setNewsMode] = useState<'live' | 'cache'>('live');
  const [newsTopic, setNewsTopic] = useState('');
  const [cachedNewsData, setCachedNewsData] = useState<string | null>(null);
  
  // Gap-Analyse Cache
  const [cachedGapData, setCachedGapData] = useState<string | null>(null);
  
  // UI States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('sources');
  
  const outputRef = useRef<HTMLDivElement>(null);

  // --- HELPERS ---
  
  // Kombiniere alle Keywords
  const getAllKeywords = (): string[] => {
    const result: string[] = [];
    
    // GSC Keywords (Top 10)
    if (useGscKeywords && keywords.length > 0) {
      keywords.slice(0, 10).forEach(k => {
        if (!result.includes(k.query)) result.push(k.query);
      });
    }
    
    // Custom Keywords
    if (customKeywords.trim()) {
      const custom = customKeywords
        .split(/[,\n]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0);
      
      custom.forEach(k => {
        if (!result.includes(k)) result.push(k);
      });
    }
    
    return result;
  };

  const totalKeywordCount = getAllKeywords().length;

  // --- HANDLERS ---
  
  // NEU: Spy Handler
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
      toast.success('Stil & Inhalt erfolgreich erfasst!');
    } catch (e) {
      console.error(e);
      toast.error('Konnte URL nicht analysieren.');
    } finally {
      setIsSpying(false);
    }
  };

  const handleGenerate = async () => {
    // Validierung
    if (!topic.trim()) {
      toast.error('Bitte geben Sie ein Thema ein.');
      return;
    }
    
    if (getAllKeywords().length === 0) {
      toast.error('Bitte aktivieren Sie GSC Keywords oder geben Sie eigene ein.');
      return;
    }
    
    if (useNewsCrawler && newsMode === 'live' && !newsTopic.trim()) {
      toast.error('Bitte geben Sie ein News-Topic ein oder wählen Sie Cache.');
      return;
    }

    setIsGenerating(true);
    setIsWaitingForStream(true);
    setGeneratedContent('');

    try {
      // Kontext-Daten sammeln
      const contextData: ContextData = {};
      
      // NEU: Spy Data einfügen
      let currentSpyData = spyData;
      // Auto-Spy falls URL da aber noch nicht gescannt
      if (referenceUrl && !currentSpyData) {
         try {
            toast.info('Scanne Referenz-URL...');
            const res = await fetch('/api/ai/competitor-spy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ myUrl: referenceUrl }),
            });
            if (res.ok) currentSpyData = await res.text();
         } catch(e) { console.error(e); }
      }
      if (currentSpyData) {
        contextData.competitorAnalysis = currentSpyData;
      }

      // GSC Keywords
      if (useGscKeywords && keywords.length > 0) {
        contextData.gscKeywords = keywords.slice(0, 10).map(k => k.query);
        contextData.gscKeywordsRaw = keywords.slice(0, 30); 
      }
      
      // News-Crawler
      if (useNewsCrawler) {
        if (newsMode === 'live' && newsTopic.trim()) {
          toast.info('Crawle aktuelle News...');
          
          const newsResponse = await fetch('/api/ai/news-crawler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: newsTopic.trim() }),
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

      toast.success('Content erfolgreich generiert!');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      console.error('❌ Landingpage Generator Error:', error);
      toast.error(`Fehler: ${errorMessage}`);
      setIsWaitingForStream(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = (format: 'txt' | 'html' | 'md') => {
    if (!generatedContent) {
      toast.error('Kein Content zum Exportieren vorhanden.');
      return;
    }
    switch (format) {
      case 'txt': downloadAsText(generatedContent, topic || 'landingpage'); break;
      case 'html': downloadAsHtml(generatedContent, topic || 'landingpage'); break;
      case 'md': downloadAsMarkdown(generatedContent, topic || 'landingpage'); break;
    }
    toast.success(`${format.toUpperCase()} heruntergeladen`);
    setShowExportMenu(false);
  };

  const handleCopy = async () => {
    if (!generatedContent) return;
    const success = await copyToClipboard(generatedContent);
    if (success) toast.success('In Zwischenablage kopiert!');
    else toast.error('Kopieren fehlgeschlagen');
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // --- RENDER ---
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* LIGHTBOX (beim Generieren) */}
      {isWaitingForStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-md transition-all animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 flex flex-col items-center gap-6 max-w-md w-full text-center transform scale-100 animate-in zoom-in-95 duration-300">
            <div className="relative w-full flex justify-center">
              <Image
                src="/data-max-arbeitet.webp"
                alt="KI arbeitet"
                width={400}
                height={400}
                className="h-[200px] w-auto object-contain"
                priority
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Content wird erstellt</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {useNewsCrawler && newsMode === 'live' 
                  ? 'Crawle News & generiere Content...' 
                  : 'Generiere optimierte Landingpage...'}
              </p>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 w-1/3 rounded-full animate-indeterminate-bar"></div>
            </div>
          </div>
        </div>
      )}

      {/* LINKER BEREICH: INPUTS */}
      <div className="lg:col-span-4 space-y-4">
        
        {/* HEADER CARD */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
          <div className="text-center pb-4 border-b border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileText className="text-2xl text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900">Landingpage Generator</h3>
            <p className="text-xs text-gray-500 mt-1">
              Erstellt Content für <strong className="text-gray-700">{domain || 'dein Projekt'}</strong>
            </p>
          </div>

          {/* THEMA INPUT */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Lightning className="text-purple-500" /> Thema / Fokus-Keyword *
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="z.B. SEO Agentur Wien, Zahnarzt Linz..."
              className="w-full p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all text-gray-700 placeholder-purple-300"
            />
          </div>

          {/* --- NEU: SPY SECTION (Integriert in dein Design) --- */}
          <div className="mt-4 bg-amber-50/60 p-4 rounded-xl border border-amber-100 space-y-3">
             <div className="flex items-start gap-2">
               <Binoculars className="text-amber-600 mt-1 shrink-0" /> 
               <div>
                 <label className="text-sm font-medium text-gray-900 block">Referenz-URL (Spy)</label>
                 <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                   Stil & Inhalt einer URL klonen oder verbessern.
                 </p>
               </div>
             </div>
             
             <div className="flex gap-2">
               <input
                 value={referenceUrl}
                 onChange={(e) => {
                   setReferenceUrl(e.target.value);
                   setSpyData(null); 
                 }}
                 placeholder="https://..."
                 className="flex-1 px-3 py-2 border border-amber-200 bg-white rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
               />
               <Button 
                 onClick={handleAnalyzeUrl}
                 disabled={!referenceUrl || isSpying || !!spyData}
                 variant="outline"
                 size="sm"
                 className={`border-amber-200 ${spyData ? 'bg-green-50 text-green-700 border-green-200' : 'hover:bg-amber-100 text-amber-700'}`}
               >
                 {spyData ? <CheckLg /> : 'Check'}
               </Button>
             </div>
             {referenceUrl && (
               <div className="text-[11px] text-amber-800 bg-amber-100/50 p-2 rounded flex gap-2 items-start">
                 <InfoCircle className="mt-0.5 shrink-0" />
                 {domain && referenceUrl.includes(domain) ? (
                   <span><strong>Brand Voice Clone:</strong> Wir imitieren den Stil.</span>
                 ) : (
                   <span><strong>Konkurrenz-Modus:</strong> Wir schreiben es besser.</span>
                 )}
               </div>
             )}
          </div>

          {/* ZIELGRUPPE */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Search className="text-gray-500" /> Zielgruppe (optional)
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="z.B. KMUs, Entscheider, Privatpersonen..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-400 outline-none transition-all"
            />
          </div>

          {/* TONALITÄT */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              Tonalität
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTone(option.value)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    tone === option.value
                      ? 'bg-purple-50 border-purple-300 text-purple-700'
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-gray-400">{option.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* DATENQUELLEN CARD (News, GSC, Gap) */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <button
            onClick={() => toggleSection('sources')}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Database className="text-indigo-500" />
              Datenquellen
            </div>
            {expandedSection === 'sources' ? <ChevronUp /> : <ChevronDown />}
          </button>

          {expandedSection === 'sources' && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              
              {/* GSC Keywords Toggle */}
              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={useGscKeywords}
                  onChange={(e) => setUseGscKeywords(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-800">GSC Keywords</div>
                  <div className="text-xs text-gray-500">
                    {loadingKeywords 
                      ? 'Lade...' 
                      : `${keywords.length} verfügbar (Top 10 werden verwendet)`}
                  </div>
                </div>
              </label>

              {/* News-Crawler Toggle */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useNewsCrawler}
                    onChange={(e) => setUseNewsCrawler(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-800 flex items-center gap-2">
                      <Newspaper className="text-indigo-500" /> News-Crawler
                    </div>
                    <div className="text-xs text-gray-500">Aktuelle Branchennews einbinden</div>
                  </div>
                </label>

                {useNewsCrawler && (
                  <div className="mt-3 pl-6 space-y-2 animate-in slide-in-from-top-2">
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="newsMode"
                          value="live"
                          checked={newsMode === 'live'}
                          onChange={() => setNewsMode('live')}
                          className="text-indigo-600"
                        />
                        Live crawlen
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="newsMode"
                          value="cache"
                          checked={newsMode === 'cache'}
                          onChange={() => setNewsMode('cache')}
                          className="text-indigo-600"
                          disabled={!cachedNewsData}
                        />
                        Cache {!cachedNewsData && '(leer)'}
                      </label>
                    </div>
                    
                    {newsMode === 'live' && (
                      <input
                        type="text"
                        value={newsTopic}
                        onChange={(e) => setNewsTopic(e.target.value)}
                        placeholder="News-Topic eingeben..."
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Gap-Analyse Toggle */}
              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={useGapAnalysis}
                  onChange={(e) => setUseGapAnalysis(e.target.checked)}
                  disabled={!cachedGapData}
                  className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-800 flex items-center gap-2">
                    <FileEarmarkBarGraph className="text-indigo-500" /> Gap-Analyse
                  </div>
                  <div className="text-xs text-gray-500">
                    {cachedGapData 
                      ? 'Ergebnisse aus letzter Analyse verwenden' 
                      : 'Keine Analyse im Cache'}
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* EIGENE KEYWORDS */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <label className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
              <PlusCircle className="text-emerald-500" /> Zusätzliche Keywords
            </label>
            {customKeywords.trim() && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                +{customKeywords.split(/[,\n]+/).filter(k => k.trim()).length}
              </span>
            )}
          </div>
          <textarea
            value={customKeywords}
            onChange={(e) => setCustomKeywords(e.target.value)}
            placeholder="Keywords (Komma oder Zeilenumbruch getrennt)"
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-20"
          />
        </div>

        {/* KEYWORD COUNTER */}
        {totalKeywordCount > 0 && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-purple-700">Gesamt Keywords:</span>
            <span className="font-bold text-purple-700">{totalKeywordCount}</span>
          </div>
        )}

        {/* GENERATE BUTTON */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full h-auto py-4 text-base gap-2 bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isGenerating ? (
            'Generiere...'
          ) : (
            <>
              <FileText /> Landingpage generieren
            </>
          )}
        </Button>
      </div>

      {/* RECHTER BEREICH: OUTPUT */}
      <div className="lg:col-span-8">
        <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-8 h-full min-h-[600px] flex flex-col relative overflow-hidden">
          {/* Decorative Blurs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

          {/* Header mit Export */}
          <div className="flex items-center justify-between mb-4 z-10">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="text-purple-500" />
              Generierter Content
            </h2>

            {generatedContent && (
              <div className="flex items-center gap-2">
                {/* Copy Button */}
                <button
                  onClick={handleCopy}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="In Zwischenablage kopieren"
                >
                  <ClipboardCheck size={18} />
                </button>

                {/* Export Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Download size={16} />
                    Export
                    <ChevronDown size={14} />
                  </button>

                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden animate-in slide-in-from-top-2">
                      <button
                        onClick={() => handleExport('txt')}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
                      >
                        <FileText className="text-gray-400" />
                        Als Text (.txt)
                      </button>
                      <button
                        onClick={() => handleExport('html')}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors border-t border-gray-100"
                      >
                        <FileEarmarkCode className="text-orange-400" />
                        Als HTML (.html)
                      </button>
                      <button
                        onClick={() => handleExport('md')}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors border-t border-gray-100"
                      >
                        <Markdown className="text-blue-400" />
                        Als Markdown (.md)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Content Output */}
          <div
            ref={outputRef}
            className="flex-1 bg-gray-50/50 rounded-xl border border-gray-200/60 p-4 overflow-y-auto z-10 custom-scrollbar ai-output"
          >
            {generatedContent ? (
              <div
                className="ai-content"
                dangerouslySetInnerHTML={{ __html: generatedContent }}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-8">
                <FileText className="text-4xl mb-3 text-purple-200" />
                <p className="font-medium text-gray-500">Landingpage Generator</p>
                <p className="text-xs mt-2 max-w-xs">
                  Geben Sie ein Thema ein, aktivieren Sie Ihre Datenquellen und generieren Sie 
                  optimierten Content für Ihre Landingpage.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
