// src/app/api/ai/generate-landingpage/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES } from '@/lib/ai-styles';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 Minuten für komplexe Generierung

// ============================================================================
// TYPES
// ============================================================================

interface ContextData {
  gscKeywords?: string[];
  newsInsights?: string;
  gapAnalysis?: string;
}

interface LandingpageRequest {
  topic: string;
  keywords: string[];
  targetAudience?: string;
  toneOfVoice: 'professional' | 'casual' | 'technical' | 'emotional';
  contextData?: ContextData;
  domain?: string;
}

// ============================================================================
// TONE MAPPING
// ============================================================================

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: `
    TONALITÄT: Professionell & Seriös
    - Verwende eine sachliche, vertrauenswürdige Sprache
    - Setze auf Fakten und klare Vorteile
    - Vermeide übertriebene Werbesprache
    - Sprich den Leser höflich mit "Sie" an
  `,
  casual: `
    TONALITÄT: Locker & Nahbar
    - Verwende eine freundliche, zugängliche Sprache
    - Schreibe wie in einem persönlichen Gespräch
    - Nutze gelegentlich rhetorische Fragen
    - Der Text darf "Du" verwenden wenn es zur Zielgruppe passt
  `,
  technical: `
    TONALITÄT: Technisch & Detailliert
    - Verwende Fachbegriffe (aber erkläre sie kurz)
    - Gehe ins Detail bei Features und Prozessen
    - Füge konkrete Zahlen und Spezifikationen ein
    - Strukturiere mit klaren Überschriften und Listen
  `,
  emotional: `
    TONALITÄT: Emotional & Storytelling
    - Beginne mit einer fesselnden Geschichte oder Szenario
    - Sprich Emotionen und Wünsche der Zielgruppe an
    - Nutze bildhafte Sprache und Metaphern
    - Fokussiere auf Transformation und Ergebnisse
  `,
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body: LandingpageRequest = await req.json();
    const { topic, keywords, targetAudience, toneOfVoice, contextData, domain } = body;

    // Validierung
    if (!topic || !keywords || keywords.length === 0) {
      return NextResponse.json(
        { message: 'Thema und mindestens ein Keyword sind erforderlich.' },
        { status: 400 }
      );
    }

    // Kontext-Blöcke aufbauen
    let contextSection = '';

    if (contextData?.gscKeywords && contextData.gscKeywords.length > 0) {
      contextSection += `
### GSC KEYWORDS (aus Google Search Console - hohe Relevanz!)
Diese Keywords bringen bereits Traffic. MUSS integriert werden:
${contextData.gscKeywords.map(k => `- "${k}"`).join('\n')}
`;
    }

    if (contextData?.newsInsights) {
      // Extrahiere nur die Key Takeaways aus dem News-Crawler Output
      const takeawaysMatch = contextData.newsInsights.match(/Key Takeaways[\s\S]*?(?=<h3|$)/i);
      const relevantNews = takeawaysMatch ? takeawaysMatch[0] : contextData.newsInsights.slice(0, 1500);
      
      contextSection += `
### AKTUELLE BRANCHEN-NEWS (Kontext für Aktualität)
Nutze diese Informationen um den Content aktuell und relevant zu machen:
${relevantNews.replace(/<[^>]*>/g, '').slice(0, 1000)}
`;
    }

    if (contextData?.gapAnalysis) {
      // Extrahiere die wichtigsten Lücken
      const gapText = contextData.gapAnalysis.replace(/<[^>]*>/g, '').slice(0, 800);
      
      contextSection += `
### CONTENT-GAPS (Fehlende Themen, die abgedeckt werden sollten)
${gapText}
`;
    }

    // Tonalitäts-Instruktionen
    const toneInstructions = TONE_INSTRUCTIONS[toneOfVoice] || TONE_INSTRUCTIONS.professional;

    // Hauptprompt
    const prompt = `
Du bist ein erfahrener SEO-Copywriter und Content-Stratege.
Erstelle den vollständigen Textinhalt für eine Landingpage.

═══════════════════════════════════════════════════════════════════════════════
AUFTRAG
═══════════════════════════════════════════════════════════════════════════════

THEMA / FOKUS: "${topic}"
DOMAIN: ${domain || 'Nicht angegeben'}
ZIELGRUPPE: ${targetAudience || 'Allgemein'}
KEYWORDS ZU INTEGRIEREN: ${keywords.join(', ')}

${toneInstructions}

${contextSection ? `
═══════════════════════════════════════════════════════════════════════════════
ZUSÄTZLICHER KONTEXT (aus Datenquellen)
═══════════════════════════════════════════════════════════════════════════════
${contextSection}
` : ''}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT ANFORDERUNGEN
═══════════════════════════════════════════════════════════════════════════════

REGELN:
1. KEIN MARKDOWN - nur HTML mit Tailwind-Klassen
2. Integriere ALLE angegebenen Keywords natürlich in den Text
3. Der Content muss SOFORT verwendbar sein (Copy & Paste)
4. Fokus auf TEXTBLÖCKE - wenig Design-Elemente

STRUKTUR (in dieser Reihenfolge):

1. <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
     [Aufmerksamkeitsstarke H1 mit Hauptkeyword]
   </h1>

2. <p class="text-xl text-gray-600 mb-8 leading-relaxed">
     [Einleitender Absatz - Hook & Value Proposition, 2-3 Sätze]
   </p>

3. <section class="mb-8">
     <h2 class="${STYLES.h3} mb-4">[Nutzen-orientierte H2]</h2>
     <p class="${STYLES.p}">[Ausführlicher Absatz mit Keywords, min. 100 Wörter]</p>
   </section>

4. <section class="mb-8">
     <h2 class="${STYLES.h3} mb-4">[Problem-Lösung H2]</h2>
     <p class="${STYLES.p}">[Beschreibe das Problem der Zielgruppe und deine Lösung]</p>
   </section>

5. <section class="mb-8">
     <h2 class="${STYLES.h3} mb-4">Ihre Vorteile auf einen Blick</h2>
     <ul class="${STYLES.list}">
       <li class="${STYLES.listItem} bg-white p-3 rounded-lg border border-gray-100">
         <strong class="text-indigo-700">[Vorteil 1]:</strong> [Erklärung]
       </li>
       [3-5 Vorteile]
     </ul>
   </section>

6. <section class="mb-8">
     <h2 class="${STYLES.h3} mb-4">[Vertrauens-H2, z.B. "Warum uns vertrauen?"]</h2>
     <p class="${STYLES.p}">[Trust-Building Absatz]</p>
   </section>

7. <section class="mb-8">
     <h2 class="${STYLES.h3} mb-4">Häufig gestellte Fragen</h2>
     <div class="space-y-3">
       <details class="bg-gray-50 p-4 rounded-lg group">
         <summary class="font-semibold cursor-pointer flex justify-between items-center">
           [Frage 1 - keyword-relevant]
           <span class="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
         </summary>
         <p class="mt-3 text-gray-600">[Ausführliche Antwort]</p>
       </details>
       [3-5 FAQs]
     </div>
   </section>

8. <section class="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
     <h2 class="text-xl font-bold text-indigo-900 mb-2">[Call-to-Action Überschrift]</h2>
     <p class="text-indigo-700 mb-4">[Abschließender CTA-Text]</p>
   </section>

═══════════════════════════════════════════════════════════════════════════════

Generiere NUR den HTML-Code. Keine Einleitung, keine Erklärungen.
Der Content muss mindestens 800 Wörter haben.
`;

    // --- HYBRID STRATEGY: Versuche Pro, Fallback auf Flash ---
    try {
      console.log('🤖 Landingpage Generator: Versuche Gemini 3 Pro Preview...');
      
      const result = streamText({
        model: google('gemini-3-pro-preview'),
        prompt: prompt,
        temperature: 0.6, // Etwas Kreativität für besseren Content
      });

      return result.toTextStreamResponse({
        headers: {
          'X-AI-Model': 'gemini-3-pro-preview',
          'X-AI-Status': 'primary',
        },
      });
      
    } catch (error) {
      console.warn('⚠️ Gemini 3 Pro failed, falling back to Flash:', error);

      const result = streamText({
        model: google('gemini-2.5-flash'),
        prompt: prompt,
        temperature: 0.6,
      });

      return result.toTextStreamResponse({
        headers: {
          'X-AI-Model': 'gemini-2.5-flash',
          'X-AI-Status': 'fallback',
        },
      });
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ Landingpage Generator Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
