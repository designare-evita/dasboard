// src/app/api/ai/generate-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { STYLES } from '@/lib/ai-styles';

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
      // Prompt mit zentralen Styles
      const systemPrompt = `
        Du bist ein erfahrener SEO-Redakteur. 
        Generiere relevante 'W-Fragen' (Wer, Wie, Was, Wo, Warum) für die Keywords.

        REGELN FÜR FORMATIERUNG:
        1. KEIN MARKDOWN.
        2. Nur HTML mit Tailwind Klassen.
        3. Nutze Bootstrap Icons.
        
        STYLING:
        - Überschrift: <h3 class="${STYLES.h3}"><i class="bi bi-lightbulb-fill ${STYLES.iconIndigo}"></i> Relevante Nutzerfragen</h3>
        - Listen-Container: <ul class="${STYLES.list}">
        - Listen-Item (Karte): 
          <li class="${STYLES.listItem} bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:border-indigo-200 transition-colors">
             <div class="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center ${STYLES.textIndigo} shrink-0">
               <i class="bi bi-question-lg text-xs"></i>
             </div>
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
