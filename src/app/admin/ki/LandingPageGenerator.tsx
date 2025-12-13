'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ManualKeywordInput } from '@/components/ManualKeywordInput';
// ✅ KORREKTUR: Importiere von '@ai-sdk/react' statt 'ai/react'
import { useCompletion } from '@ai-sdk/react';
import { toast } from 'sonner';
import { Magic, FileEarmarkText, Copy } from 'react-bootstrap-icons';

export default function LandingPageGenerator() {
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);

  // Vercel AI SDK Hook
  const { complete, completion, isLoading } = useCompletion({
    api: '/api/ai/generate-landingpage',
    onError: (err) => toast.error(`Fehler: ${err.message}`),
    onFinish: () => toast.success('Landingpage generiert!'),
  });

  const handleGenerate = async () => {
    if (!topic || keywords.length === 0) {
      toast.error('Bitte Thema und mindestens ein Keyword angeben.');
      return;
    }

    // Hier könnten wir später noch Daten aus dem News-Crawler holen und mitgeben
    await complete('', {
      body: {
        topic,
        keywords,
        targetAudience,
        toneOfVoice: 'Expertenstatus, vertrauenswürdig',
        contextData: { 
          source: 'User Input', 
          note: 'Generiert mit Gemini 2.5 Flash' 
        }
      }
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(completion);
    toast.success('HTML kopiert!');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Linke Spalte: Eingabe */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Magic className="text-indigo-600" /> Konfiguration
          </h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Thema der Seite</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="z.B. Nachhaltige Serverkühlung"
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <ManualKeywordInput keywords={keywords} onChange={setKeywords} />

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Zielgruppe</label>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="z.B. IT-Leiter im Mittelstand"
              className="w-full px-3 py-2 border rounded-md text-sm outline-none"
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isLoading} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isLoading ? 'Schreibe...' : 'Landingpage generieren'}
          </Button>
        </div>
      </div>

      {/* Rechte Spalte: Output */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[600px] flex flex-col">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
            <span className="font-semibold text-gray-700 flex items-center gap-2">
              <FileEarmarkText /> Ergebnis Vorschau
            </span>
            {completion && (
              <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                <Copy className="mr-2" /> HTML Kopieren
              </Button>
            )}
          </div>
          
          <div className="p-6 flex-1 overflow-auto">
            {completion ? (
              <div 
                className="prose prose-indigo max-w-none ai-content"
                dangerouslySetInnerHTML={{ __html: completion }} 
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Magic className="text-4xl mb-2 opacity-20" />
                <p>Warte auf Input...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
