// src/app/api/ai/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await req.json();
    const { keywords, domain } = body;

    if (!keywords || !Array.isArray(keywords) || !domain) {
      return NextResponse.json({ message: 'Fehlende Parameter' }, { status: 400 });
    }

    try {
      // PROMPT FÜR HTML-FRAGEN-LISTE
      const systemPrompt = `
        Du bist ein erfahrener SEO-Redakteur. 
        Generiere relevante 'W-Fragen' (Wer, Wie, Was, Wo, Warum) für die Keywords.

        REGELN FÜR FORMATIERUNG:
        1. KEIN MARKDOWN.
        2. Nur HTML mit Tailwind Klassen.
        
        STYLING:
        - Überschrift: <h3 class="font-bold text-indigo-900 mb-6 text-lg flex items-center gap-2">💡 Relevante Nutzerfragen</h3>
        - Listen-Container: <ul class="space-y-3 list-none pl-0">
        - Listen-Item (Karte): 
          <li class="flex items-center gap-4 text-sm text-gray-700 bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-indigo-200 transition-colors">
             <div class="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">?</div>
             <span class="font-medium">Die Frage...</span>
          </li>
      `;

      const result = streamText({
        model: google('gemini-2.5-flash'), 
        system: systemPrompt,
        prompt: `Domain: "${domain}"\nKeywords: ${keywords.join(', ')}.\n\nGeneriere eine Liste von 10-15 relevanten Fragen als HTML.`,
        temperature: 0.7,
      });

      return result.toTextStreamResponse();
      
    } catch (aiError) {
      console.error('[AI Generate] Google API Fehler:', aiError);
      return NextResponse.json({ message: 'AI Fehler', details: String(aiError) }, { status: 502 });
    }

  } catch (error) {
    return NextResponse.json({ message: 'Server Fehler' }, { status: 500 });
  }
}
