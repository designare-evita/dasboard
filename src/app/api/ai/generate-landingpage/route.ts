import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES } from '@/lib/ai-styles';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 60; // Flash ist schnell genug

export async function POST(req: NextRequest) {
  try {
    const { topic, keywords, targetAudience, toneOfVoice, contextData } = await req.json();

    if (!topic || !keywords || keywords.length === 0) {
      return NextResponse.json({ message: 'Thema und Keywords fehlen.' }, { status: 400 });
    }

    // Prompt optimiert für Flash (kürzer, präziser)
    const prompt = `
      Du bist ein Senior SEO-Copywriter. Erstelle den Content für eine Landingpage.
      
      ### 1. INPUT DATEN
      - Thema: "${topic}"
      - Manuelle Keywords: ${JSON.stringify(keywords)} (Integriere diese sinnvoll!)
      - Zielgruppe: ${targetAudience || 'Allgemein'}
      - Ton: ${toneOfVoice || 'Professionell'}
      - Kontext-Fakten (News/Gap): ${JSON.stringify(contextData || {})}

      ### 2. FORMATIERUNG (HTML + Tailwind)
      Nutze EXAKT diese CSS-Klassen aus dem Design-System:
      
      <section class="mb-12">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">[Spannende H1 mit Keyword]</h1>
        <p class="text-xl text-gray-600 mb-8 leading-relaxed">[Intro Text]</p>
      </section>

      <div class="${STYLES.card} mb-8">
        <h2 class="${STYLES.h3} mb-4"><i class="bi bi-star-fill ${STYLES.iconIndigo}"></i> [H2 Überschrift]</h2>
        <div class="${STYLES.p}">
           [Fließtext mit <strong>Fettungen</strong> für Keywords. Nutze die Fakten aus dem Kontext.]
        </div>
      </div>

      <h3 class="${STYLES.h3} mb-4">Vorteile auf einen Blick</h3>
      <ul class="${STYLES.list} mb-8">
        <li class="${STYLES.listItem} bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
           <strong class="text-indigo-700">Vorteil 1:</strong> [Erklärung]
        </li>
        <li class="${STYLES.listItem} bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
           <strong class="text-indigo-700">Vorteil 2:</strong> [Erklärung]
        </li>
      </ul>

      <div class="space-y-4 mt-8">
        <h3 class="${STYLES.h3}">Häufige Fragen</h3>
        <details class="bg-gray-50 p-4 rounded-lg">
          <summary class="font-bold cursor-pointer">[Frage 1 aus Kontext?]</summary>
          <p class="mt-2 text-gray-600">[Antwort]</p>
        </details>
      </div>

      Generiere NUR den HTML-Code für den Body. Keine Einleitung.
    `;

    const result = streamText({
      model: google('gemini-2.5-flash'), // ✅ Hier nutzen wir jetzt Flash
      prompt: prompt,
      temperature: 0.6, // Etwas Kreativität erlauben
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('Landingpage Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
