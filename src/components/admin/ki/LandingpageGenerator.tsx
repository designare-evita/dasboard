// src/components/admin/ki/LandingpageGenerator.tsx
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
  ArrowRepeat,
  LayoutTextWindowReverse, 
  WindowDesktop          
} from 'react-bootstrap-icons';

// ============================================================================
// TYPES
// ============================================================================

interface Keyword {
  query: string;
  clicks: number;
  position: number;
  impressions: number;
}

interface LandingpageGeneratorProps {
  projectId?: string;
  domain?: string;
  keywords?: Keyword[];
  loadingKeywords?: boolean;
}

type ToneOfVoice = 'professional' | 'casual' | 'technical' | 'emotional';
type ContentType = 'landingpage' | 'blog';

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

// ✅ STEP DEFINITION
interface OnboardingStep {
  id: number;
  label: string;
  optional?: boolean;
  cardId?: string; // Welche Card gehört zu diesem Step
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 1, label: 'Thema / H1', cardId: 'briefing' },
  { id: 2, label: 'Art des Inhalts', cardId: 'briefing' },
  { id: 3, label: 'Spy & Clone', optional: true, cardId: 'briefing' },
  { id: 4, label: 'Zielgruppe', optional: true, cardId: 'briefing' },
  { id: 5, label: 'Tonalität', cardId: 'briefing' },
  { id: 6, label: 'Datenquellen', cardId: 'sources' },
  { id: 7, label: 'Keywords', cardId: 'keywords' },
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
  const [contentType, setContentType] = useState<ContentType>('landingpage');
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
  const [showKeywordAnalysis, setShowKeywordAnalysis] = useState(false);
  
  // ✅ ONBOARDING STATES
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(true); // User kann es ausschalten
  
  const outputRef = useRef<HTMLDivElement>(null);

  // --- KEYWORD ANALYSE (für Frontend-Anzeige) ---
  const keywordAnalysis = React.useMemo(() => {
    if (!keywords || keywords.length === 0) return null;
    
    const byClicks = [...keywords].sort((a, b) => b.clicks - a.clicks);
    const mainKeyword = byClicks[0];
    
    const secondaryKeywords = byClicks.slice(1, 6);
    
    const strikingDistance = keywords
      .filter(k => k.position >= 4 && k.position <= 20)
      .sort((a, b) => (b.impressions / b.position) - (a.impressions / a.position))
      .slice(0, 5)
      .map(k => ({
        ...k,
        priority: k.position <= 10 && k.impressions > 500 ? 'high' as const
                : k.position <= 15 || k.impressions > 300 ? 'medium' as const
                : 'low' as const
      }));
    
    const questionWords = ['was', 'wie', 'wo', 'wer', 'warum', 'wann', 'welche', 'welcher'];
    const questionKeywords = keywords
      .filter(k => questionWords.some(w => k.query.toLowerCase().startsWith(w)))
      .slice(0, 5);
    
    const longTailKeywords = keywords
      .filter(k => k.query.split(' ').length >= 3)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);
    
    const totalClicks = keywords.reduce((sum, k) => sum + k.clicks, 0);
    const totalImpressions = keywords.reduce((sum, k) => sum + k.impressions, 0);
    const avgPosition = keywords.reduce((sum, k) => sum + k.position, 0) / keywords.length;
    
    return {
      mainKeyword,
      secondaryKeywords,
      strikingDistance,
      questionKeywords,
      longTailKeywords,
      stats: { totalClicks, totalImpressions, avgPosition: Math.round(avgPosition * 10) / 10 }
    };
  }, [keywords]);

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

  const extractGapText = (html: string): string[] => {
    const text = html.replace(/<[^>]*>/g, '');
    const items = text
      .split(/[\n•\-]/)
      .map(item => item.trim())
      .filter(item => item.length > 10 && item.length < 200);
    return items.slice(0, 5);
  };

  // ============================================================================
  // ✅ ONBOARDING LOGIC
  // ============================================================================
  
  // Prüfe ob ein Step abgeschlossen ist (für Button-Validation)
  const isStepComplete = React.useCallback((step: number): boolean => {
    switch(step) {
      case 1: return topic.trim().length > 0;
      case 2: return true; // Content Type hat Default
      case 3: return true; // Optional
      case 4: return true; // Optional
      case 5: return true; // Tone hat Default
      case 6: return useGscKeywords || useNewsCrawler || useGapAnalysis;
      case 7: return totalKeywordCount > 0;
      default: return false;
    }
  }, [topic, useGscKeywords, useNewsCrawler, useGapAnalysis, totalKeywordCount]);

  // Auto-Advance bei Step-Completion
  
  // 1️⃣ Markiere den AKTUELLEN Step als completed wenn Bedingung erfüllt
  useEffect(() => {
    if (!showOnboarding) return;
    if (completedSteps.includes(currentStep)) return;
    
    let stepComplete = false;
    let autoAdvance = false; // ✅ NEU: Nur bestimmte Steps auto-advance
    
    switch(currentStep) {
      case 1: 
        stepComplete = topic.trim().length > 0;
        autoAdvance = true; // ✅ Thema → auto-advance
        break;
      case 2: 
        stepComplete = true; // Content Type hat Default
        autoAdvance = false; // ⏸️ KEIN auto-advance - User soll bewusst wählen
        break;
      case 3: 
        stepComplete = true; // Optional - Spy
        autoAdvance = false; // ⏸️ KEIN auto-advance - ist optional
        break;
      case 4: 
        stepComplete = true; // Optional - Zielgruppe
        autoAdvance = false; // ⏸️ KEIN auto-advance - ist optional
        break;
      case 5: 
        stepComplete = true; // Tone hat Default
        autoAdvance = false; // ⏸️ KEIN auto-advance - User soll bewusst wählen
        break;
      case 6: 
        stepComplete = useGscKeywords || useNewsCrawler || useGapAnalysis;
        autoAdvance = true; // ✅ Datenquellen → auto-advance
        break;
      case 7: 
        stepComplete = totalKeywordCount > 0;
        autoAdvance = true; // ✅ Keywords → auto-advance
        break;
    }
    
    if (stepComplete) {
      console.log('✅ Step', currentStep, 'is complete, auto-advance:', autoAdvance);
      setCompletedSteps(prev => [...prev, currentStep]);
      
      // ✅ Nur auto-advance wenn explizit erlaubt
      if (autoAdvance && currentStep < ONBOARDING_STEPS.length) {
        const timer = setTimeout(() => {
          console.log('⏭️ Auto-advancing to step', currentStep + 1);
          setCurrentStep(prev => prev + 1);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [currentStep, topic, useGscKeywords, useNewsCrawler, useGapAnalysis, customKeywords, showOnboarding, completedSteps, totalKeywordCount]);

  // CSS Class Helpers
  const getCardClass = (cardId: string): string => {
    const cardSteps = ONBOARDING_STEPS.filter(s => s.cardId === cardId).map(s => s.id);
    const minStep = Math.min(...cardSteps);
    const maxStep = Math.max(...cardSteps);
    
    if (!showOnboarding) return 'bg-white border border-gray-100 shadow-sm rounded-2xl transition-all duration-300';
    
    // Aktiv wenn currentStep in diesem Card ist
    if (currentStep >= minStep && currentStep <= maxStep) {
      return 'bg-white border-2 border-purple-400 shadow-lg shadow-purple-100 rounded-2xl transition-all duration-300';
    }
    
    // Completed wenn alle Steps des Cards abgeschlossen
    if (cardSteps.every(s => completedSteps.includes(s))) {
      return 'bg-white border-2 border-green-400 shadow-sm rounded-2xl transition-all duration-300';
    }
    
    // Inactive wenn noch nicht dran
    if (currentStep < minStep) {
      return 'bg-white border border-gray-200 rounded-2xl transition-all duration-300 opacity-40 blur-sm pointer-events-none';
    }
    
    return 'bg-white border border-gray-100 shadow-sm rounded-2xl transition-all duration-300';
  };

  const getFieldClass = (fieldStep: number): string => {
    if (!showOnboarding) return 'transition-all duration-300';
    
    if (currentStep >= fieldStep) {
      return 'transition-all duration-300 opacity-100';
    }
    return 'transition-all duration-300 opacity-30 pointer-events-none blur-sm';
  };

  const shouldShowStepBadge = (cardId: string): boolean => {
    if (!showOnboarding) return false;
    const cardSteps = ONBOARDING_STEPS.filter(s => s.cardId === cardId).map(s => s.id);
    return cardSteps.includes(currentStep);
  };

  const getCurrentStepForCard = (cardId: string): OnboardingStep | null => {
    if (!showOnboarding) return null;
    return ONBOARDING_STEPS.find(s => s.cardId === cardId && s.id === currentStep) || null;
  };

  // ============================================================================
  // HANDLERS (Unverändert)
  // ============================================================================

  const handleExport = (format: 'txt' | 'html' | 'md') => {
    if (!generatedContent) {
      toast.error('Kein Inhalt zum Exportieren.');
      return;
    }

    try {
      let content = generatedContent;
      let mimeType = 'text/plain';
      let extension = format;

      if (format === 'html') {
        mimeType = 'text/html';
        content = `<!DOCTYPE html><html><head><title>${topic}</title><meta charset="UTF-8"></head><body>${generatedContent}</body></html>`;
      } else if (format === 'md') {
        mimeType = 'text/markdown';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'content'}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`${format.toUpperCase()} Export gestartet`);
      setShowExportMenu(false);
    } catch (e) {
      console.error("Export Error:", e);
      toast.error("Export fehlgeschlagen.");
    }
  };

  const handleAnalyzeUrl = async () => {
    if (!referenceUrl) return;
    try {
      setIsSpying(true);
      
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
        
        const data = await res.text();
        setCachedGapData(data);
        setUseGapAnalysis(true);
        toast.success('Content Gaps identifiziert!');
    } catch (e) {
        console.error(e);
        toast.error('Gap-Analyse Fehler');
    } finally {
        setIsAnalyzingGap(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error('Bitte geben Sie ein Thema ein.'); return; }
    if (getAllKeywords().length === 0) { toast.error('Bitte Keywords angeben.'); return; }
    
    // ✅ Onboarding deaktivieren bei erster Generierung
    if (showOnboarding) setShowOnboarding(false);
    
    if (useNewsCrawler && newsMode === 'live' && !newsTopic.trim()) {
       setNewsTopic(topic);
    }

    setIsGenerating(true);
    setIsWaitingForStream(true);
    setGeneratedContent('');

    try {
      const contextData: ContextData = {};
      
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

      if (useGscKeywords && keywords.length > 0) {
        contextData.gscKeywords = keywords.slice(0, 10).map(k => k.query);
        contextData.gscKeywordsRaw = keywords.slice(0, 30);
      }
      
      if (useNewsCrawler) {
        if (newsMode === 'live') {
          const fetchTopic = newsTopic.trim() || topic;
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
      
      if (useGapAnalysis && cachedGapData) {
        contextData.gapAnalysis = cachedGapData;
      }

      const response = await fetch('/api/ai/generate-landingpage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          contentType, 
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

  const handleCopy = async () => {
    if (generatedContent) {
        try {
            await navigator.clipboard.writeText(generatedContent);
            toast.success('Kopiert!');
        } catch (err) {
            console.error('Copy failed', err);
            toast.error('Kopieren fehlgeschlagen');
        }
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      
      {/* ✅ ONBOARDING TOGGLE (Oben rechts) */}
      {!isGenerating && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowOnboarding(!showOnboarding)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:text-purple-600 bg-white border border-gray-200 rounded-lg hover:border-purple-300 transition-all"
          >
            <InfoCircle size={14} />
            {showOnboarding ? 'Schritt-für-Schritt ausblenden' : 'Schritt-für-Schritt einblenden'}
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* LOADING / SPY LIGHTBOX */}
      {(isWaitingForStream || isSpying) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-md transition-all animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 flex flex-col items-center gap-6 max-w-md w-full text-center">
            <div className="relative w-full flex justify-center">
              <Image src="/data-max-arbeitet.webp" alt="KI arbeitet" width={400} height={400} className="h-[200px] w-auto object-contain" priority />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">
                {isSpying ? 'Analysiere URL...' : 'Content wird erstellt'}
              </h3>
              <p className="text-gray-500 text-sm">
                {isSpying 
                  ? 'Klone Stil, Wortwahl und Struktur der Zielseite...' 
                  : (useNewsCrawler && newsMode === 'live' ? 'Recherchiere News & schreibe...' : 'Generiere optimierten Content...')}
              </p>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
               <div className={`h-full bg-purple-500 w-1/3 rounded-full animate-indeterminate-bar ${isSpying ? 'bg-amber-500' : ''}`}></div>
            </div>
          </div>
        </div>
      )}

      {/* --- INPUTS (LINKS) --- */}
      <div className="lg:col-span-4 space-y-4">
        
        {/* ✅ PROGRESS TRACKER (nur wenn Onboarding aktiv) */}
        {showOnboarding && (
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 animate-in fade-in slide-in-from-top-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              🎯 Fortschritt
              <span className="ml-auto text-purple-600">{completedSteps.length}/{ONBOARDING_STEPS.length}</span>
            </div>
            <div className="space-y-2">
              {ONBOARDING_STEPS.map((step) => {
                const isActive = currentStep === step.id;
                const isCompleted = completedSteps.includes(step.id);
                
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                      isActive ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : isActive
                          ? 'bg-purple-600 border-purple-600 text-white animate-pulse'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}
                    >
                      {isCompleted ? '✓' : step.id}
                    </div>
                    <div
                      className={`text-sm font-medium transition-all ${
                        isCompleted
                          ? 'text-green-600 line-through opacity-70'
                          : isActive
                          ? 'text-purple-700 font-semibold'
                          : 'text-gray-600'
                      }`}
                    >
                      {step.label}
                      {step.optional && (
                        <span className="text-[10px] text-gray-400 ml-1">(optional)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* 1. BRIEFING CARD */}
        <div className={`${getCardClass('briefing')} p-6 relative`}>
          
          {/* ✅ STEP BADGE (pulsierend) */}
          {shouldShowStepBadge('briefing') && (() => {
            const step = getCurrentStepForCard('briefing');
            return step ? (
              <div className="absolute top-4 right-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-200 animate-in fade-in zoom-in-95">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                Schritt {step.id}
              </div>
            ) : null;
          })()}
          
          <div className="text-center pb-4 border-b border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileText className="text-2xl text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900">Content Generator</h3>
            <p className="text-xs text-gray-500 mt-1">für <strong className="text-gray-700">{domain || 'dieses Projekt'}</strong></p>
          </div>

          {/* STEP 1: THEMA */}
          <div className={`mt-4 ${getFieldClass(1)}`}>
            <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Lightning className="text-purple-500" /> Thema / H1 *
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="z.B. IT-Service München..."
              className="w-full p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            />
            {/* ✅ TOOLTIP (nur bei aktiv) */}
            {showOnboarding && currentStep === 1 && (
              <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex gap-2 animate-in slide-in-from-top-2">
                <InfoCircle className="text-indigo-600 shrink-0 mt-0.5" size={16} />
                <div className="text-xs text-indigo-700 leading-relaxed">
                  <strong>Tipp:</strong> Verwende dein Hauptkeyword hier. Beispiel: "SEO Agentur Wien" oder "Zahnarzt Linz für Angstpatienten"
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: CONTENT TYPE */}
          <div className={`mt-4 ${getFieldClass(2)}`}>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Art des Inhalts</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
               <button
                 onClick={() => setContentType('landingpage')}
                 className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${contentType === 'landingpage' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 <WindowDesktop size={14} /> Landingpage
               </button>
               <button
                 onClick={() => setContentType('blog')}
                 className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${contentType === 'blog' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 <LayoutTextWindowReverse size={14} /> Blog-Artikel
               </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 px-1">
              {contentType === 'landingpage' ? 'Fokus auf Conversion, Leads & Verkauf.' : 'Fokus auf Information, SEO-Traffic & Mehrwert.'}
            </p>
            
            {/* ✅ WEITER-BUTTON (nur wenn Onboarding aktiv und Step 2 ist aktuell) */}
            {showOnboarding && currentStep === 2 && (
              <button
                onClick={() => setCurrentStep(3)}
                className="mt-3 w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                Weiter zu Schritt 3 →
              </button>
            )}
          </div>

          {/* STEP 3: SPY SECTION */}
          <div className={`mt-4 ${getFieldClass(3)}`}>
            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-100 space-y-3">
              <div className="flex items-start gap-2">
                <Binoculars className="text-amber-600 mt-1 shrink-0" /> 
                <div>
                  <label className="text-sm font-medium text-gray-900 block">Spy & Clone (Stil-Kopie)</label>
                  <p className="text-[11px] text-gray-500 leading-tight">URL analysieren und Wording/Stil exakt übernehmen.</p>
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
                  <div className="text-[10px] text-green-700 flex gap-1 items-center font-medium bg-green-50 p-1.5 rounded border border-green-100">
                      <CheckLg/> Stil analysiert. Wird angewendet.
                  </div>
              )}
            </div>
            
            {/* ✅ WEITER-BUTTON (Überspringen möglich) */}
            {showOnboarding && currentStep === 3 && (
              <button
                onClick={() => setCurrentStep(4)}
                className="mt-3 w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {spyData ? 'Weiter zu Schritt 4 →' : 'Überspringen (Optional) →'}
              </button>
            )}
          </div>

          {/* STEP 4: ZIELGRUPPE */}
          <div className={`mt-4 ${getFieldClass(4)}`}>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              Zielgruppe <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="z.B. KMUs, Ärzte..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-400 outline-none"
            />
            
            {/* ✅ WEITER-BUTTON */}
            {showOnboarding && currentStep === 4 && (
              <button
                onClick={() => setCurrentStep(5)}
                className="mt-3 w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {targetAudience ? 'Weiter zu Schritt 5 →' : 'Überspringen (Optional) →'}
              </button>
            )}
          </div>

          {/* STEP 5: TONALITÄT */}
          <div className={`mt-4 ${getFieldClass(5)}`}>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Tonalität (Fallback)</label>
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
            {spyData && <p className="text-[10px] text-amber-600 mt-1">*Wird durch Spy-Analyse überschrieben.</p>}
            
            {/* ✅ WEITER-BUTTON */}
            {showOnboarding && currentStep === 5 && (
              <button
                onClick={() => setCurrentStep(6)}
                className="mt-3 w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                Weiter zu Schritt 6 →
              </button>
            )}
          </div>
        </div>

        {/* 2. DATENQUELLEN CARD */}
        <div className={`${getCardClass('sources')} overflow-hidden relative`}>
          
          {/* ✅ STEP BADGE */}
          {shouldShowStepBadge('sources') && (
            <div className="absolute top-4 right-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-200 z-10 animate-in fade-in zoom-in-95">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              Schritt 6
            </div>
          )}
          
          <button onClick={() => toggleSection('sources')} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2 font-semibold text-gray-800"><Database className="text-indigo-500" /> Datenquellen</div>
            {expandedSection === 'sources' ? <ChevronUp /> : <ChevronDown />}
          </button>

          {expandedSection === 'sources' && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              
              {/* GSC Toggle + Keyword-Analyse */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={useGscKeywords} onChange={(e) => setUseGscKeywords(e.target.checked)} className="mt-1 rounded text-indigo-600" />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-800">GSC Keywords</div>
                    <div className="text-xs text-gray-500">{loadingKeywords ? 'Lade...' : `${keywords.length} verfügbar`}</div>
                  </div>
                </label>
                
                {useGscKeywords && keywords.length > 0 && keywordAnalysis && (
                  <div className="pl-6 pt-2 border-t border-gray-200 mt-2">
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-2">
                      <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                        🎯 {keywordAnalysis.mainKeyword?.query?.slice(0, 20)}{keywordAnalysis.mainKeyword?.query?.length > 20 ? '...' : ''}
                      </span>
                      {keywordAnalysis.strikingDistance.length > 0 && (
                        <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          📈 {keywordAnalysis.strikingDistance.length} Striking
                        </span>
                      )}
                      {keywordAnalysis.questionKeywords.length > 0 && (
                        <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          ❓ {keywordAnalysis.questionKeywords.length} FAQ
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => setShowKeywordAnalysis(!showKeywordAnalysis)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                    >
                      {showKeywordAnalysis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showKeywordAnalysis ? 'Analyse ausblenden' : 'Analyse anzeigen'}
                    </button>
                    
                    {showKeywordAnalysis && (
                      <div className="mt-3 space-y-3 animate-in slide-in-from-top-2">
                        
                        <div className="bg-white p-3 rounded-lg border border-indigo-200 shadow-sm">
                          <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-1">Hauptkeyword</div>
                          <div className="font-semibold text-gray-900 text-sm">{keywordAnalysis.mainKeyword?.query}</div>
                          <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
                            <span>{keywordAnalysis.mainKeyword?.clicks} Klicks</span>
                            <span>Pos. {Math.round(keywordAnalysis.mainKeyword?.position * 10) / 10}</span>
                            <span>{keywordAnalysis.mainKeyword?.impressions.toLocaleString('de-DE')} Impr.</span>
                          </div>
                        </div>
                        
                        {keywordAnalysis.strikingDistance.length > 0 && (
                          <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-sm">
                            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-2">
                              🎯 Striking Distance <span className="font-normal text-gray-400">(fast Seite 1!)</span>
                            </div>
                            <ul className="space-y-1.5">
                              {keywordAnalysis.strikingDistance.map((k, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-[11px]">
                                  <span className={`w-2 h-2 rounded-full ${
                                    k.priority === 'high' ? 'bg-red-500' : 
                                    k.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}></span>
                                  <span className="flex-1 text-gray-700 truncate">{k.query}</span>
                                  <span className="text-gray-400 tabular-nums">Pos. {Math.round(k.position * 10) / 10}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {keywordAnalysis.questionKeywords.length > 0 && (
                          <div className="bg-white p-3 rounded-lg border border-purple-200 shadow-sm">
                            <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-2">
                              ❓ Fragen für FAQ
                            </div>
                            <ul className="space-y-1">
                              {keywordAnalysis.questionKeywords.map((k, idx) => (
                                <li key={idx} className="text-[11px] text-gray-700 flex items-start gap-1.5">
                                  <span className="text-purple-400">•</span>
                                  <span>{k.query}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {keywordAnalysis.longTailKeywords.length > 0 && (
                          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-2">
                              📝 Long-Tail Keywords
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {keywordAnalysis.longTailKeywords.map((k, idx) => (
                                <span key={idx} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                  {k.query}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-100">
                          <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-2">📊 Statistik</div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <div className="text-sm font-bold text-gray-900">{keywordAnalysis.stats.totalClicks.toLocaleString('de-DE')}</div>
                              <div className="text-[9px] text-gray-500 uppercase">Klicks</div>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{keywordAnalysis.stats.totalImpressions.toLocaleString('de-DE')}</div>
                              <div className="text-[9px] text-gray-500 uppercase">Impressionen</div>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{keywordAnalysis.stats.avgPosition}</div>
                              <div className="text-[9px] text-gray-500 uppercase">Ø Position</div>
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-[9px] text-gray-400 italic">
                          Diese Analyse wird automatisch bei der Generierung berücksichtigt.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

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

              {/* Gap Analysis */}
              <div className="p-3 bg-gray-50 rounded-lg transition-all">
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
                        className="h-6 text-xs px-2 text-indigo-600 hover:bg-indigo-50 border border-indigo-100 bg-white"
                    >
                        {isAnalyzingGap ? <ArrowRepeat className="animate-spin" /> : 'Jetzt scannen'}
                    </Button>
                </div>
                
                <div className="text-xs text-gray-500 pl-6">
                    {!cachedGapData && !isAnalyzingGap && 'Findet fehlende Themen für bessere Rankings.'}
                    {isAnalyzingGap && <span className="text-indigo-600 animate-pulse">Analysiere Wettbewerb & Semantik...</span>}
                    
                    {cachedGapData && !isAnalyzingGap && (
                        <div className="mt-2 p-3 bg-white border border-green-200 rounded-lg shadow-sm">
                            <div className="flex items-center gap-1 text-green-600 font-semibold mb-2">
                                <CheckLg /> Analyse erfolgreich!
                            </div>
                            <p className="text-[11px] font-medium text-gray-700 mb-2">Empfohlene Ergänzungen:</p>
                            <ul className="space-y-1.5">
                                {extractGapText(cachedGapData).map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-[11px] text-gray-600">
                                        <span className="text-indigo-500 mt-0.5">•</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                            {useGapAnalysis && (
                                <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-green-600 font-medium">
                                    ✓ Wird bei Generierung berücksichtigt
                                </div>
                            )}
                        </div>
                    )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* 3. KEYWORDS CARD */}
        <div className={`${getCardClass('keywords')} p-4 relative`}>
          
          {/* ✅ STEP BADGE */}
          {shouldShowStepBadge('keywords') && (
            <div className="absolute top-4 right-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-200 z-10 animate-in fade-in zoom-in-95">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              Schritt 7
            </div>
          )}
          
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

        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || (showOnboarding && completedSteps.length < ONBOARDING_STEPS.length)} 
          className="w-full py-6 text-base gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200"
        >
          {isGenerating ? 'Generiere...' : <><FileText /> {contentType === 'landingpage' ? 'Landingpage erstellen' : 'Blog-Artikel schreiben'}</>}
        </Button>
      </div>

      {/* --- OUTPUT (RECHTS) --- */}
      <div className="lg:col-span-8">
        <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-8 h-full min-h-[600px] flex flex-col relative">
          <div className="flex items-center justify-between mb-4 relative z-20">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><FileText className="text-purple-500" /> Ergebnis</h2>
            {generatedContent && (
              <div className="flex gap-2 relative">
                <button onClick={handleCopy} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="In Zwischenablage kopieren"><ClipboardCheck/></button>
                
                <div className="relative">
                   <button 
                      onClick={() => setShowExportMenu(!showExportMenu)} 
                      className="flex items-center gap-1 px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-sm font-medium"
                   >
                      <Download size={16} /> Export <ChevronDown size={14} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                   </button>
                   {showExportMenu && (
                     <>
                       <div 
                         className="fixed inset-0 z-30" 
                         onClick={() => setShowExportMenu(false)}
                       />
                       <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-40 animate-in fade-in slide-in-from-top-2">
                         <button 
                           onClick={() => handleExport('txt')} 
                           className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 rounded-t-xl"
                         >
                           <FileText className="text-gray-400" /> Als Text (.txt)
                         </button>
                         <button 
                           onClick={() => handleExport('html')} 
                           className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                         >
                           <FileEarmarkCode className="text-orange-400" /> Als HTML (.html)
                         </button>
                         <button 
                           onClick={() => handleExport('md')} 
                           className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 rounded-b-xl"
                         >
                           <Markdown className="text-blue-400" /> Als Markdown (.md)
                         </button>
                       </div>
                     </>
                   )}
                </div>
              </div>
            )}
          </div>
          
          <div ref={outputRef} className="flex-1 bg-gray-50/50 rounded-xl border border-gray-200/60 p-6 overflow-y-auto relative z-0 custom-scrollbar ai-output">
            {generatedContent ? (
              <div className="ai-content prose max-w-none" dangerouslySetInnerHTML={{ __html: generatedContent }} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
                <FileText className="text-4xl mb-3 text-purple-200" />
                <p className="font-medium text-gray-500">Bereit für Content</p>
                <p className="text-xs text-gray-400 mt-2">Wähle links Blog oder Landingpage</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    
    {/* ✅ CUSTOM STYLES */}
    <style jsx global>{`
      @keyframes indeterminate-bar {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(300%); }
      }
      .animate-indeterminate-bar {
        animation: indeterminate-bar 1.5s infinite linear;
      }
    `}</style>
    </div>
  );
}
