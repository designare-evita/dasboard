'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ManualKeywordInput } from '@/components/ManualKeywordInput';
import { useCompletion } from '@ai-sdk/react'; 
import { toast } from 'sonner';
import { 
  Magic, 
  FileEarmarkText, 
  Copy, 
  PencilSquare, 
  Binoculars, 
  CheckLg,
  Globe,
  InfoCircle
} from 'react-bootstrap-icons';

// --- ÄNDERUNG 1: Interface an die Aufrufe in page.tsx anpassen ---
interface Props {
  projectId?: string;        // Neu: Projekt-ID (optional gemacht, falls mal nicht vorhanden)
  domain?: string;           // Umbenannt von defaultDomain zu domain (passend zum Aufruf)
  keywords?: any[];          // Neu: Keywords vom Parent (Typ any, da Struktur von 'Keyword' hier unbekannt)
  loadingKeywords?: boolean; // Neu: Ladestatus
}

export default function LandingPageGenerator({ 
  projectId, 
  domain = '', 
  keywords: initialKeywords = [], // Wir nennen es um, um Konflikt mit dem State zu vermeiden
  loadingKeywords = false 
}: Props) {
  
  // --- Inputs ---
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  
  // State für Keywords (String Array)
  const [keywords, setKeywords] = useState<string[]>([]);
  
  // Die "Spy" URL (Quelle für Daten/Stil)
  const [referenceUrl, setReferenceUrl] = useState('');
  // Unsere eigene Domain
  const [myDomain, setMyDomain] = useState(domain);

  // --- UI States ---
  const [copied, setCopied] = useState(false);
  const [isSpying, setIsSpying] = useState(false);
  const [spyData, setSpyData] = useState<string | null>(null);

  // --- ÄNDERUNG 2: Sync von Props zu State ---

  // 1. Domain synchronisieren
  useEffect(() => {
    if (domain) setMyDomain(domain);
  }, [domain]);

  // 2. Keywords synchronisieren (wenn vom Parent geladen)
  useEffect(() => {
    if (initialKeywords && initialKeywords.length > 0) {
      // Wir wandeln die eingehenden Keywords in simple Strings um
      // Annahme: Das Keyword-Objekt hat eine Eigenschaft 'term', 'word' oder ist direkt ein String
      const mappedKeywords = initialKeywords.map((k: any) => {
        if (typeof k === 'string') return k;
        return k.term || k.keyword || k.word || ''; // Hier ggf. anpassen, je nachdem wie dein Keyword-Objekt aussieht
      }).filter(k => k !== '');
      
      setKeywords(prev => {
        // Nur setzen, wenn noch keine eigenen Keywords eingegeben wurden, um Überschreiben zu vermeiden
        if (prev.length === 0) return mappedKeywords;
        return prev;
      });
    }
  }, [initialKeywords]);

  // --- KI Hook ---
  const { complete, completion, isLoading: isGenerating } = useCompletion({
    api: '/api/ai/generate-landingpage',
    onError: (err) => {
      console.error(err);
      toast.error(`Fehler: ${err.message}`);
    },
    onFinish: () => toast.success('Landingpage erfolgreich erstellt!'),
  });

  // --- Logik ---

  const handleAnalyzeUrl = async () => {
    if (!referenceUrl) return;
    
    try {
      setIsSpying(true);
      toast.info('Analysiere Referenz-Webseite...');
      
      const res = await fetch('/api/ai/competitor-spy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          myUrl: referenceUrl, 
        }),
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

  const handleGenerate = async () => {
    if (!topic || keywords.length === 0) {
      toast.error('Bitte Thema und Keywords angeben.');
      return;
    }

    let currentSpyData = spyData;
    if (referenceUrl && !currentSpyData) {
      await handleAnalyzeUrl();
    }

    await complete('', {
      body: { 
        topic, 
        keywords, 
        targetAudience, 
        domain: myDomain, 
        toneOfVoice: 'professional', 
        contextData: { 
          source: 'User Input',
          competitorAnalysis: currentSpyData || undefined,
          projectId // Wir geben die ProjektID mit ans Backend weiter (falls benötigt)
        }
      }
    });
  };

  const copyToClipboard = () => {
    if(completion) {
        navigator.clipboard.writeText(completion);
        setCopied(true);
        toast.success('HTML kopiert!');
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const isLoading = isSpying || isGenerating || loadingKeywords; // loadingKeywords hier integriert

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* --- Linke Spalte: Konfiguration --- */}
      <div className="xl:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
          
          <div className="border-b border-gray-100 pb-4 mb-2">
             <h3 className="font-semibold text-gray-900 flex items-center gap-2">
               <PencilSquare className="text-indigo-600" /> Content Briefing
             </h3>
             <p className="text-xs text-gray-500 mt-1">
               Definiere Ziel und Inhalt der Seite.
             </p>
          </div>
          
          {/* Domain Einstellung */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Deine Domain</label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 text-gray-400 text-sm" />
              <input
                value={myDomain}
                onChange={(e) => setMyDomain(e.target.value)}
                placeholder="z.B. meine-firma.de"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Thema & Keywords */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Thema / H1</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="z.B. IT-Outsourcing für KMU"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            
            {/* Ladeindikator für Keywords */}
            {loadingKeywords ? (
                <div className="text-xs text-indigo-500 animate-pulse">Lade Keywords aus Projekt...</div>
            ) : (
                <ManualKeywordInput keywords={keywords} onChange={setKeywords} />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Zielgruppe</label>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="z.B. Geschäftsführer"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* --- SPY & CLONE SECTION --- */}
          <div className="bg-amber-50/60 p-4 rounded-lg border border-amber-100 space-y-3">
             <div className="flex items-start gap-2">
               <Binoculars className="text-amber-600 mt-1 shrink-0" /> 
               <div>
                 <label className="text-sm font-medium text-gray-900 block">Referenz-URL (Optional)</label>
                 <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                   Nutze eine URL als Vorlage für Stil & Inhalt.
                 </p>
               </div>
             </div>
             
             <div className="flex gap-2">
               <input
                 value={referenceUrl}
                 onChange={(e) => {
                   setReferenceUrl(e.target.value);
                   setSpyData(null); // Reset wenn URL ändert
                 }}
                 placeholder="https://..."
                 className="flex-1 px-3 py-2 border border-amber-200 bg-white rounded-md text-sm outline-none focus:ring-2 focus:ring-amber-500"
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
                 {myDomain && referenceUrl.includes(myDomain) ? (
                   <span><strong>Brand Voice Clone:</strong> Wir analysieren deinen eigenen Text und imitieren deinen Schreibstil exakt.</span>
                 ) : (
                   <span><strong>Konkurrenz-Modus:</strong> Wir analysieren den Gegner und schreiben den Text inhaltlich besser und überzeugender.</span>
                 )}
               </div>
             )}
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isLoading} 
            className={`w-full text-white font-medium py-6 transition-all shadow-md ${
              isSpying ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700'
            }`}
          >
            {isSpying ? (
              <span className="flex items-center gap-2"><Binoculars className="animate-pulse"/> Analysiere Vorlage...</span>
            ) : isGenerating ? (
              <span className="flex items-center gap-2"><Magic className="animate-spin"/> Generiere Landingpage...</span>
            ) : (
              <span className="flex items-center gap-2"><Magic /> Landingpage Erstellen</span>
            )}
          </Button>

        </div>
      </div>

      {/* --- Rechte Spalte: Output --- */}
      <div className="xl:col-span-2">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-[800px] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 backdrop-blur-sm">
            <span className="font-semibold text-gray-700 flex items-center gap-2">
              <FileEarmarkText className="text-indigo-600" /> 
              Ergebnis Vorschau
            </span>
            {completion && (
              <Button variant="outline" size="sm" onClick={copyToClipboard} className={copied ? "text-green-600 border-green-200 bg-green-50" : "hover:bg-white"}>
                {copied ? <CheckLg className="mr-2" /> : <Copy className="mr-2" />} 
                {copied ? "Kopiert" : "HTML Kopieren"}
              </Button>
            )}
          </div>
          
          <div className="p-8 flex-1 overflow-auto bg-slate-50 relative">
            {completion ? (
              <div 
                className="prose prose-indigo max-w-none ai-content bg-white p-10 rounded-xl shadow-sm border border-gray-200/60"
                dangerouslySetInnerHTML={{ __html: completion }} 
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${isSpying ? 'bg-amber-100 text-amber-400 scale-110' : 'bg-indigo-50 text-indigo-200'}`}>
                   {isSpying ? <Binoculars className="text-4xl animate-pulse" /> : <Magic className="text-4xl" />}
                </div>
                <div className="text-center max-w-sm">
                  <p className="font-medium text-gray-600 mb-1">
                    {isSpying ? 'Analysiere Referenz-Daten...' : 'Bereit zur Generierung'}
                  </p>
                  <p className="text-sm">
                    {isSpying 
                      ? 'Die KI liest gerade die angegebene URL, um den Stil zu erfassen.' 
                      : 'Fülle das Briefing links aus, um hochwertigen Content zu erzeugen.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
