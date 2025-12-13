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

    // Hauptkeyword extrahieren (erstes Keyword oder Topic)
    const mainKeyword = keywords[0] || topic;
    
    // Hauptprompt mit erweiterten Qualitätskriterien
    const prompt = `
Du bist ein erfahrener SEO-Copywriter und Content-Stratege mit 10+ Jahren Erfahrung.
Erstelle den vollständigen Textinhalt für eine hochwertige, rankingfähige Landingpage.

═══════════════════════════════════════════════════════════════════════════════
AUFTRAG
═══════════════════════════════════════════════════════════════════════════════

THEMA / FOKUS: "${topic}"
HAUPTKEYWORD: "${mainKeyword}"
DOMAIN: ${domain || 'Nicht angegeben'}
ZIELGRUPPE: ${targetAudience || 'Allgemein'}
ALLE KEYWORDS: ${keywords.join(', ')}

${toneInstructions}

${contextSection ? `
═══════════════════════════════════════════════════════════════════════════════
ZUSÄTZLICHER KONTEXT (aus Datenquellen)
═══════════════════════════════════════════════════════════════════════════════
${contextSection}
` : ''}

═══════════════════════════════════════════════════════════════════════════════
QUALITÄTSKRITERIEN (STRIKT EINHALTEN!)
═══════════════════════════════════════════════════════════════════════════════

### 1. KEYWORD-OPTIMIERUNG
- Das HAUPTKEYWORD "${mainKeyword}" MUSS in der H1 vorkommen (Pflicht!)
- Das HAUPTKEYWORD MUSS im ersten Absatz erscheinen (erste 100 Wörter)
- Keyword-Dichte: 1-2% - natürlich verteilt, KEIN Keyword-Stuffing
- Nutze LSI-Keywords (semantisch verwandte Begriffe) für thematische Tiefe
- Variiere die Keyword-Formulierungen (Singular/Plural, Synonyme)

### 2. E-E-A-T SIGNALE (Google Ranking-Faktor!)
- EXPERTISE: Zeige Fachwissen durch präzise Fachbegriffe und Details
- EXPERIENCE: Integriere Praxis-Beispiele und konkrete Erfahrungswerte
- AUTHORITY: Nenne konkrete Zahlen, Statistiken, Fakten (erfinde realistische wenn nötig)
- TRUST: Baue Vertrauenselemente ein (Garantien, Zertifikate, Referenzen erwähnen)
- VERMEIDE generische Floskeln wie "Wir sind die Besten", "höchste Qualität"
- STATTDESSEN: Spezifische Claims wie "Über 500 erfolgreiche Projekte seit 2015"

### 3. LESBARKEIT (Flesch-Reading-Ease optimiert)
- KURZE SÄTZE: Maximal 20 Wörter pro Satz
- KURZE ABSÄTZE: Maximal 3-4 Sätze pro Absatz
- AKTIVE SPRACHE: "Wir optimieren Ihre Website" statt "Ihre Website wird optimiert"
- DIREKTE ANSPRACHE: Den Leser mit "Sie" direkt ansprechen
- EINFACHE WÖRTER: Fachbegriffe kurz erklären oder vermeiden

### 4. CONVERSION-OPTIMIERUNG
- KLARE CTAs: Jede Section endet mit einer Handlungsaufforderung
- BENEFIT-ORIENTIERT: Nicht Features beschreiben, sondern NUTZEN für den Kunden
- SOCIAL PROOF: Referenzen, Kundenzahlen, Bewertungen erwähnen
- URGENCY/SCARCITY: Wo passend, zeitliche oder mengenmäßige Begrenzungen andeuten
  (z.B. "Begrenzte Kapazitäten", "Jetzt Erstberatung sichern")

═══════════════════════════════════════════════════════════════════════════════
OUTPUT ANFORDERUNGEN
═══════════════════════════════════════════════════════════════════════════════

REGELN:
1. KEIN MARKDOWN - nur HTML mit Tailwind-Klassen
2. Integriere ALLE angegebenen Keywords natürlich in den Text
3. Der Content muss SOFORT verwendbar sein (Copy & Paste)
4. Fokus auf TEXTBLÖCKE - wenig Design-Elemente
5. MINDESTENS 900 Wörter für ausreichende Content-Tiefe

STRUKTUR (in dieser Reihenfolge):

1. <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
     [Aufmerksamkeitsstarke H1 - MUSS "${mainKeyword}" enthalten!]
   </h1>

2. <p class="text-xl text-gray-600 mb-8 leading-relaxed">
     [Einleitender Absatz mit HAUPTKEYWORD - Hook, UVP & Benefit in 2-3 Sätzen]
   </p>

3. <section class="mb-8">
     <h2 class="${STYLES.h3} mb-4">[Nutzen-orientierte H2 mit Keyword-Variante]</h2>
     <p class="${STYLES.p}">[Ausführlicher Absatz - Problem der Zielgruppe ansprechen, min. 100 Wörter]</p>
     <p class="${STYLES.p}">[Zweiter Absatz - Lösung präsentieren mit konkreten Vorteilen]</p>
     <p class="${STYLES.p} font-medium text-indigo-700">[Mini-CTA: "Erfahren Sie mehr..." oder "Kontaktieren Sie uns..."]</p>
   </section>

4. <section class="mb-8">
     <h2 class="${STYLES.h3} mb-4">[E-E-A-T H2: "Unsere Expertise" / "Warum wir"]</h2>
     <p class="${STYLES.p}">[Authority-Building: Konkrete Zahlen, Jahre Erfahrung, Anzahl Projekte]</p>
     <p class="${STYLES.p}">[Experience: Ein konkretes Beispiel oder Erfolgsgeschichte andeuten]</p>
   </section>

5. <section class="mb-8">
     <h2 class="${STYLES.h3} mb-4">Ihre Vorteile auf einen Blick</h2>
     <ul class="${STYLES.list}">
       <li class="${STYLES.listItem} bg-white p-3 rounded-lg border border-gray-100">
         <strong class="text-indigo-700">[Benefit 1]:</strong> [Konkreter Nutzen, nicht Feature]
       </li>
       <li class="${STYLES.listItem} bg-white p-3 rounded-lg border border-gray-100">
         <strong class="text-indigo-700">[Benefit 2]:</strong> [Mit Zahl oder Zeitangabe wenn möglich]
       </li>
       <li class="${STYLES.listItem} bg-white p-3 rounded-lg border border-gray-100">
         <strong class="text-indigo-700">[Benefit 3]:</strong> [Emotionaler Nutzen]
       </li>
       <li class="${STYLES.listItem} bg-white p-3 rounded-lg border border-gray-100">
         <strong class="text-indigo-700">[Benefit 4]:</strong> [Trust-Element: Garantie/Support]
       </li>
     </ul>
   </section>

6. <section class="mb-8 bg-gray-50 p-6 rounded-xl">
     <h2 class="${STYLES.h3} mb-4">[Social Proof H2: "Das sagen unsere Kunden" / "Erfolge"]</h2>
     <p class="${STYLES.p}">[Referenz-Absatz: Branche, Anzahl Kunden, durchschnittliche Ergebnisse]</p>
     <p class="${STYLES.p} italic text-gray-600">[Optional: Kurzes Zitat-Beispiel eines fiktiven zufriedenen Kunden]</p>
   </section>

7. <section class="mb-8">
     <h2 class="${STYLES.h3} mb-4">Häufig gestellte Fragen</h2>
     <div class="space-y-3">
       <details class="bg-gray-50 p-4 rounded-lg group">
         <summary class="font-semibold cursor-pointer flex justify-between items-center">
           [Frage 1 - MUSS Hauptkeyword enthalten]
           <span class="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
         </summary>
         <p class="mt-3 text-gray-600">[Ausführliche Antwort mit LSI-Keywords, 2-3 Sätze]</p>
       </details>
       <details class="bg-gray-50 p-4 rounded-lg group">
         <summary class="font-semibold cursor-pointer flex justify-between items-center">
           [Frage 2 - Keyword-Variante]
           <span class="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
         </summary>
         <p class="mt-3 text-gray-600">[Antwort mit konkreten Zahlen/Fakten]</p>
       </details>
       <details class="bg-gray-50 p-4 rounded-lg group">
         <summary class="font-semibold cursor-pointer flex justify-between items-center">
           [Frage 3 - Einwandbehandlung: Kosten/Zeit/Aufwand]
           <span class="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
         </summary>
         <p class="mt-3 text-gray-600">[Antwort die Bedenken ausräumt]</p>
       </details>
       <details class="bg-gray-50 p-4 rounded-lg group">
         <summary class="font-semibold cursor-pointer flex justify-between items-center">
           [Frage 4 - "Wie läuft der Prozess ab?" o.ä.]
           <span class="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
         </summary>
         <p class="mt-3 text-gray-600">[Klare Schritte, Transparenz schaffen]</p>
       </details>
     </div>
   </section>

8. <section class="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-xl text-white">
     <h2 class="text-2xl font-bold mb-3">[Starker CTA-Titel mit Urgency]</h2>
     <p class="text-indigo-100 mb-4">[Zusammenfassung des Hauptnutzens + Handlungsaufforderung]</p>
     <p class="font-semibold">[Konkreter nächster Schritt: "Jetzt unverbindlich anfragen" / "Kostenlose Erstberatung sichern"]</p>
   </section>

═══════════════════════════════════════════════════════════════════════════════

WICHTIG: Generiere NUR den HTML-Code. Keine Einleitung, keine Erklärungen.
Prüfe vor Ausgabe: Ist "${mainKeyword}" in H1 und erstem Absatz? Mindestens 900 Wörter?
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
