'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ManualKeywordInput } from '@/components/ManualKeywordInput';
import { useCompletion } from 'ai/react';
import { toast } from 'sonner';
import { Magic, FileEarmarkText, Copy, PencilSquare } from 'react-bootstrap-icons';

export default function LandingPageGenerator() {
  const [topic, setTopic] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);

  const { complete, completion, isLoading } = useCompletion({
    api: '/api/ai/generate-landingpage',
    onError: (err) => toast.error(`Fehler: ${err.message}`),
    onFinish: () => toast.success('Landingpage generiert!'),
  });

  const handleGenerate = async () => {
    if (!topic || keywords.length === 0) {
      toast.error('Thema und Keywords erforderlich!');
      return;
    }
    await complete('', {
      body: { topic, keywords, targetAudience, toneOfVoice: 'Experte' }
    });
  };

  const copyToClipboard = () => {
    if(completion) {
        navigator.clipboard.writeText(completion);
        toast.success('HTML kopiert!');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <PencilSquare className="text-indigo-600" /> Konfiguration
          </h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Thema</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="z.B. Green IT"
              className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <ManualKeywordInput keywords={keywords} onChange={setKeywords} />

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Zielgruppe</label>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="z.B. CTOs"
              className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isLoading} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isLoading ? <span className="flex items-center gap-2"><Magic className="animate-spin"/> Generiere...</span> : 'Landingpage erstellen'}
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-[600px] flex flex-col">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
            <span className="font-semibold text-gray-700 flex items-center gap-2">
              <FileEarmarkText /> Vorschau
            </span>
            {completion && (
              <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                <Copy className="mr-2" /> Kopieren
              </Button>
            )}
          </div>
          
          <div className="p-6 flex-1 overflow-auto bg-gray-50/30">
            {completion ? (
              <div 
                className="prose prose-indigo max-w-none ai-content bg-white p-6 rounded-lg shadow-sm"
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
