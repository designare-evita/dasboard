// src/app/api/ai/generate-landingpage/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES } from '@/lib/ai-styles';
import { 
  analyzeKeywords, 
  generateKeywordPromptContext,
  generateIntentReport,
  type Keyword,
  type SearchIntent
} from '@/lib/keyword-analyzer';

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
  gscKeywordsRaw?: Keyword[];  // Vollständige Keyword-Objekte für Analyse
  newsInsights?: string;
  gapAnalysis?: string;
  competitorAnalysis?: string; // Für Brand Voice Clone & Spy
}

interface LandingpageRequest {
  topic: string;
  keywords: string[];
  targetAudience?: string;
  toneOfVoice: 'professional' | 'casual' | 'technical' | 'emotional';
  contentType: 'landingpage' | 'blog';
  contextData?: ContextData;
  domain?: string;
  // ✅ NEU: Optionaler Kontext für Produkte/Fakten
  productContext?: string; 
}

// ============================================================================
// TONE MAPPING (Fallback wenn keine Brand Voice)
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
// INTENT-BASIERTE STRUKTUR-GUIDANCE
// ============================================================================

function generateIntentGuidance(intent: SearchIntent, confidence: string): string {
  const intentLabels = {
    informational: 'INFORMATIONS-SUCHE',
    commercial: 'VERGLEICHS-/RESEARCH-ABSICHT',
    transactional: 'KAUFABSICHT',
    navigational: 'NAVIGATIONS-ABSICHT'
  };

  let guidance = `
═══════════════════════════════════════════════════════════════════════════════
🎯 SUCHINTENTIONS-ANALYSE (PRIORITÄT 1 - STRIKT BEFOLGEN!)
═══════════════════════════════════════════════════════════════════════════════

**ERKANNTE INTENTION: ${intentLabels[intent]}**
Confidence: ${confidence}

`;

  switch (intent) {
    case 'transactional':
      guidance += `
⚠️ KAUFABSICHT ERKANNT → STRUKTUR ANPASSEN!

**KRITISCHE ELEMENTE (PFLICHT):**
1. ✅ H1: Keyword + Handlungsaufforderung
   Beispiel: "SEO Agentur Wien jetzt buchen" statt nur "SEO Agentur Wien"

2. ✅ Hero-Section (direkt nach H1):
   - Starker CTA-Button above-the-fold
   - Preis/Angebot sofort sichtbar (wenn verfügbar)
   - Trust-Badge oder Gütesiegel erwähnen

3. ✅ Mehrere CTAs im Text verteilen:
   - Nach Benefits-Section
   - Nach Social Proof
   - Am Ende (finaler CTA)

4. ✅ Trust-Elemente prominent:
   - Zahlungsarten / Buchungsoptionen
   - Geld-zurück-Garantie falls relevant
   - Kundenbewertungen / Testimonials

5. ✅ WENIGER Erklärungs-Text, MEHR Action:
   - Kurze, knackige Absätze (max. 3 Sätze)
   - Bullet Points statt langer Fließtexte
   - Fokus auf Benefits statt Features

**VERMEIDEN:**
- Lange theoretische Erklärungen
- "Mehr erfahren" statt "Jetzt buchen/kaufen"
- CTA erst ganz am Ende der Seite
`;
      break;

    case 'commercial':
      guidance += `
⚠️ VERGLEICHS-ABSICHT ERKANNT → STRUKTUR ANPASSEN!

**KRITISCHE ELEMENTE (PFLICHT):**
1. ✅ H1: Vergleichs-orientiert
   Beispiel: "Die besten SEO Tools 2025 im Vergleich"

2. ✅ Vergleichstabelle oder Pro/Contra-Listen:
   - Feature-Vergleich prominent platzieren
   - Bewertungskriterien transparent machen
   - "Gewinner"-Kategorien definieren

3. ✅ Bewertungs-Methodik erklären:
   - Wie wurden die Optionen getestet?
   - Nach welchen Kriterien bewertet?
   - Transparenz schafft Vertrauen

4. ✅ Social Proof intensivieren:
   - Kundenbewertungen / Rezensionen
   - Testergebnisse / Auszeichnungen
   - Case Studies oder Erfolgsgeschichten

5. ✅ FAQ: Einwandbehandlung
   - "Lohnt sich X?"
   - "X vs Y - Was ist besser?"
   - "Kosten-Nutzen-Verhältnis?"

**CTAs:**
- Soft CTAs: "Mehr erfahren", "Details ansehen"
- Finale Conversion am Ende nach vollem Vergleich
`;
      break;

    case 'navigational':
      guidance += `
⚠️ NAVIGATIONS-ABSICHT ERKANNT → STRUKTUR ANPASSEN!

**KRITISCHE ELEMENTE (PFLICHT):**
1. ✅ H1: Brand-Name + Service/Kategorie
   Beispiel: "Designare SEO - Ihre Agentur in Wien"

2. ✅ Kontakt-Informationen prominent (im oberen Bereich):
   - Adresse, Telefon, E-Mail
   - Öffnungszeiten / Verfügbarkeit
   - Standort-Karte falls relevant

3. ✅ "Über uns" Section früh platzieren:
   - Team vorstellen
   - Geschichte / Meilensteine
   - Was macht uns aus?

4. ✅ Interne Navigation stärken:
   - Links zu allen wichtigen Unterseiten
   - Service-Übersicht mit Links
   - "Direktkontakt"-Optionen

5. ✅ Weniger Verkaufs-Pitch, mehr Information:
   - Nutzer kennt die Brand bereits
   - Will primär Kontakt oder spezifische Info finden
   - Strukturierte Informationen statt Überzeugungsarbeit

**VERMEIDEN:**
- Lange Verkaufsargumente
- Übertriebene Selbstdarstellung
`;
      break;

    case 'informational':
    default:
      guidance += `
⚠️ INFORMATIONS-ABSICHT ERKANNT → STRUKTUR ANPASSEN!

**KRITISCHE ELEMENTE (PFLICHT):**
1. ✅ H1: Frage beantworten oder "Was ist X?" Format
   Beispiel: "Was ist SEO? Der komplette Guide 2025"

2. ✅ Sofortige Antwort im ersten Absatz:
   - Featured Snippet optimiert
   - Klare, prägnante Definition
   - Dann weitere Details

3. ✅ Inhaltsverzeichnis (bei >800 Wörtern):
   - Ermöglicht schnelles Springen
   - Zeigt Content-Tiefe
   - Verbessert User Experience

4. ✅ Detaillierte Erklärungen mit Struktur:
   - H2/H3 für Unterthemen
   - Beispiele und Analogien nutzen
   - Schritt-für-Schritt Anleitungen

5. ✅ FAQ-Section mit W-Fragen:
   - Beantworte verwandte Fragen
   - "Wie funktioniert...", "Warum ist..."
   - Featured Snippet Chancen

6. ✅ Visuelle Elemente erwähnen (konzeptionell):
   - "Hier könnte eine Infografik zeigen..."
   - "Beispiel-Diagramm würde verdeutlichen..."

**CTAs:**
- Soft CTAs: "Jetzt beraten lassen", "Mehr Details"
- Primär am Ende nach vollständiger Info-Vermittlung
`;
      break;
  }

  guidance += `
═══════════════════════════════════════════════════════════════════════════════
`;

  return guidance;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body: LandingpageRequest = await req.json();
    const { 
        topic, 
        keywords, 
        targetAudience, 
        toneOfVoice, 
        contentType = 'landingpage', 
        contextData, 
        domain,
        productContext // ✅ NEU
    } = body;

    // ========================================================================
    // 1. VALIDIERUNG
    // ========================================================================
    
    if (!topic || !keywords || keywords.length === 0) {
      return NextResponse.json(
        { message: 'Thema und mindestens ein Keyword sind erforderlich.' },
        { status: 400 }
      );
    }

    // ========================================================================
    // 2. KONTEXT AUFBAUEN
    // ========================================================================
    
    let contextSection = '';

    // 2.1 GSC Keywords - Intelligente Analyse MIT INTENT
    let keywordAnalysis = null;
    let mainKeyword = keywords[0] || topic;
    let intentGuidance = '';
    
    if (contextData?.gscKeywordsRaw && contextData.gscKeywordsRaw.length > 0) {
      // ✅ ERWEITERT: Domain für Intent-Erkennung übergeben
      keywordAnalysis = analyzeKeywords(
        contextData.gscKeywordsRaw, 
        topic,
        domain // ✅ NEU: Ermöglicht Brand-Keyword-Erkennung
      );
      
      mainKeyword = keywordAnalysis.mainKeyword || keywords[0] || topic;
      
      // ✅ Generiere erweiterten Keyword-Kontext (inkl. Intent-Infos)
      contextSection += generateKeywordPromptContext(keywordAnalysis);
      
      // ✅ NEU: Intent-basierte Struktur-Guidance
      const mainIntent = keywordAnalysis.intentAnalysis.mainKeywordIntent;
      intentGuidance = generateIntentGuidance(
        mainIntent.primaryIntent, 
        mainIntent.confidence
      );
      
      // Debug-Output (optional)
      console.log('🎯 Intent-Analyse:', generateIntentReport(mainIntent));
      
    } else if (contextData?.gscKeywords && contextData.gscKeywords.length > 0) {
      // Fallback: Nur Keyword-Namen ohne Metriken
      contextSection += `
### GSC KEYWORDS (aus Google Search Console)
Diese Keywords sind relevant für das Thema:
${contextData.gscKeywords.map(k => `- "${k}"`).join('\n')}
`;
    }

    // 2.2 News Insights
    if (contextData?.newsInsights) {
      const takeawaysMatch = contextData.newsInsights.match(/Key Takeaways[\s\S]*?(?=<h3|$)/i);
      const relevantNews = takeawaysMatch ? takeawaysMatch[0] : contextData.newsInsights.slice(0, 1500);
      
      contextSection += `
### AKTUELLE BRANCHEN-NEWS (Kontext für Aktualität)
Nutze diese Informationen um den Content aktuell und relevant zu machen:
${relevantNews.replace(/<[^>]*>/g, '').slice(0, 1000)}
`;
    }

    // 2.3 Gap Analysis
    if (contextData?.gapAnalysis) {
      const gapText = contextData.gapAnalysis.replace(/<[^>]*>/g, '').slice(0, 800);
      
      contextSection += `
### CONTENT-GAPS (Fehlende Themen, die abgedeckt werden sollten)
${gapText}
`;
    }

    // 2.4 BRAND VOICE CLONE & SPY
    let toneInstructions = TONE_INSTRUCTIONS[toneOfVoice] || TONE_INSTRUCTIONS.professional;

    if (contextData?.competitorAnalysis) {
      const spyText = contextData.competitorAnalysis.slice(0, 4000); 

      toneInstructions = `
### ⚠️ WICHTIG: STIL- UND WORDING-ADAPTION (PRIORITÄT 1)
Wir haben eine Analyse eines Referenz-Textes vorliegen. Deine wichtigste Aufgabe ist es, den **Schreibstil (Brand Voice) dieses Textes zu adaptieren**.

Analysiere den folgenden Referenz-Text auf:
1. **Wortwahl & Vokabular:** Welche spezifischen Begriffe oder Adjektive werden genutzt?
2. **Satzstruktur:** Sind die Sätze kurz und knackig oder lang und erklärend?
3. **Ansprache:** Wird der Leser geduzt oder gesiezt? Ist es direkt oder distanziert?
4. **Stimmung:** Ist der Text euphorisch, nüchtern, witzig oder autoritär?

👉 **WENDE DIESEN ANALYSIERTEN STIL EXAKT AUF DEN NEUEN TEXT AN!**
Schreibe so, als ob der Autor des Referenz-Textes diesen neuen Text verfasst hätte.

REFERENZ-TEXT (Quelle für den Stil):
"""
${spyText}
"""
      `;
    }

    // 2.5 FAQ-Vorschläge aus Fragen-Keywords
    const suggestedFaqs = keywordAnalysis?.questionKeywords || [];
    const faqInstruction = suggestedFaqs.length > 0 
      ? `\n**VORGESCHLAGENE FAQ-FRAGEN (aus echten Suchanfragen):**\n${suggestedFaqs.map(q => `- "${q}"`).join('\n')}\n→ Integriere diese Fragen in die FAQ-Section!`
      : '';

    // ========================================================================
    // ✅ NEU: 3. FAKTEN-BLOCK KONSTRUIEREN
    // ========================================================================

    const productFacts = productContext ? `
═══════════════════════════════════════════════════════════════════════════════
✅ ECHTE FAKTEN & USPs (NUTZE DIESE DATEN!)
═══════════════════════════════════════════════════════════════════════════════
Integriere diese Informationen zwingend in den Text:
"${productContext}"
` : '';

    // ========================================================================
    // 4. PROMPT GENERIERUNG
    // ========================================================================

    let prompt = '';

    if (contentType === 'blog') {
      // ----------------------------------------------------------------------
      // BLOG PROMPT
      // ----------------------------------------------------------------------
      prompt = `
Du bist ein erfahrener Fachredakteur und SEO-Experte mit 10+ Jahren Erfahrung.
Erstelle einen detaillierten, hochwertigen Blogartikel (Ratgeber-Content).

═══════════════════════════════════════════════════════════════════════════════
AUFTRAG
═══════════════════════════════════════════════════════════════════════════════

THEMA: "${topic}"
HAUPTKEYWORD: "${mainKeyword}"
DOMAIN: ${domain || 'Nicht angegeben'}
ZIELGRUPPE: ${targetAudience || 'Allgemein'}
ALLE KEYWORDS: ${keywords.join(', ')}

${toneInstructions}

${intentGuidance}

${productFacts}

${contextSection ? `
═══════════════════════════════════════════════════════════════════════════════
ZUSÄTZLICHER KONTEXT (aus Datenquellen)
═══════════════════════════════════════════════════════════════════════════════
${contextSection}
${faqInstruction}
` : ''}

═══════════════════════════════════════════════════════════════════════════════
QUALITÄTS-REGELN (STRIKT!)
═══════════════════════════════════════════════════════════════════════════════

### 1. WAHRHEIT & FAKTEN
- ⚠️ ERFINDE KEINE FAKTEN! Wenn du keine Infos zu Preisen oder Mitarbeiterzahlen hast, nutze Platzhalter wie "[PREIS HIER]" oder "[ANZAHL PROJEKTE]".
- Nutze die bereitgestellten "ECHTEN FAKTEN" aus dem Kontext oben.
- Schreibe spezifisch, nicht generisch. Statt "Wir bieten tolle Qualität" schreibe "Wir bieten [USP aus Kontext]".

### 2. STRUKTUR & LESBARKEIT
- H1 muss knallig sein und zum Klicken anregen.
- Kurze Absätze (max 3-4 Zeilen).
- Viele Zwischenüberschriften (H2, H3).
- Nutze Listen, Fettungen und Infoboxen.

### 3. SEO & KEYWORDS
- Hauptkeyword "${mainKeyword}" in H1, Einleitung und Fazit.
- Nebenkeywords natürlich im Text verteilen.

═══════════════════════════════════════════════════════════════════════════════
OUTPUT ANFORDERUNGEN
═══════════════════════════════════════════════════════════════════════════════

Generiere NUR den HTML-Code (Tailwind CSS).
Struktur:

1. <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
     [Titel mit "${mainKeyword}"]
   </h1>

2. <div class="bg-indigo-50 p-6 rounded-xl mb-8 border border-indigo-100">
     <h3 class="font-bold text-indigo-900 mb-3">Das Wichtigste in Kürze:</h3>
     <ul class="space-y-2">
       <li class="flex gap-2 text-indigo-900"><span class="text-indigo-600">✓</span> [Key Takeaway 1]</li>
       <li class="flex gap-2 text-indigo-900"><span class="text-indigo-600">✓</span> [Key Takeaway 2]</li>
       <li class="flex gap-2 text-indigo-900"><span class="text-indigo-600">✓</span> [Key Takeaway 3]</li>
     </ul>
   </div>

3. <p class="text-xl text-gray-600 mb-8 leading-relaxed">
     [Starke Einleitung: Problemaufriss und Versprechen]
   </p>

4. <section class="mb-10">
     <h2 class="${STYLES.h3} mb-4">[H2: Grundlagen / Definition]</h2>
     <p class="${STYLES.p}">[Erklärender Text...]</p>
   </section>

5. <section class="mb-10">
     <h2 class="${STYLES.h3} mb-4">[H2: Deep Dive - Hauptteil]</h2>
     <p class="${STYLES.p}">[Detaillierter Content...]</p>
     <div class="my-6 p-5 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
       <strong class="text-yellow-800 block mb-1">💡 Experten-Tipp:</strong>
       <p class="text-yellow-700 m-0 text-sm">[Ein wertvoller Tipp aus der Praxis]</p>
     </div>
   </section>

6. <section class="mb-10">
     <h2 class="${STYLES.h3} mb-4">[H2: Anleitung / Schritt-für-Schritt]</h2>
     <ul class="${STYLES.list}">
       <li class="${STYLES.listItem}"><strong class="text-gray-900">1. [Schritt]:</strong> [Erklärung]</li>
       <li class="${STYLES.listItem}"><strong class="text-gray-900">2. [Schritt]:</strong> [Erklärung]</li>
       <li class="${STYLES.listItem}"><strong class="text-gray-900">3. [Schritt]:</strong> [Erklärung]</li>
     </ul>
   </section>

7. <section class="mb-10">
     <h2 class="${STYLES.h3} mb-4">Häufige Fehler (und wie man sie vermeidet)</h2>
     <div class="grid md:grid-cols-2 gap-4">
       <div class="bg-red-50 p-4 rounded-lg border border-red-100">
         <strong class="text-red-700 block mb-1">❌ Falsch:</strong>
         <span class="text-sm text-red-600">[Typischer Fehler]</span>
       </div>
       <div class="bg-green-50 p-4 rounded-lg border border-green-100">
         <strong class="text-green-700 block mb-1">✅ Richtig:</strong>
         <span class="text-sm text-green-600">[Lösung/Best Practice]</span>
       </div>
     </div>
   </section>

8. <section class="mb-10 bg-gray-50 p-8 rounded-xl">
     <h2 class="${STYLES.h3} mb-4">Fazit</h2>
     <p class="${STYLES.p}">[Zusammenfassung und Ausblick]</p>
   </section>

9. <div class="mt-8 pt-8 border-t border-gray-100 text-center">
      <p class="font-medium text-gray-900 mb-4">Fanden Sie diesen Artikel hilfreich?</p>
      [Passender CTA für einen Blog, z.B. Newsletter oder Kontakt]
   </div>

WICHTIG: Generiere NUR den HTML-Code. Mindestens 1200 Wörter für den Blogpost.
      `;

    } else {
      // ----------------------------------------------------------------------
      // LANDINGPAGE PROMPT (MIT INTENT-INTEGRATION)
      // ----------------------------------------------------------------------
      prompt = `
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

${intentGuidance}

${productFacts}

${contextSection ? `
═══════════════════════════════════════════════════════════════════════════════
ZUSÄTZLICHER KONTEXT (aus Datenquellen)
═══════════════════════════════════════════════════════════════════════════════
${contextSection}
${faqInstruction}
` : ''}

═══════════════════════════════════════════════════════════════════════════════
QUALITÄTS-REGELN (STRIKT!)
═══════════════════════════════════════════════════════════════════════════════

### 1. WAHRHEIT & FAKTEN (WICHTIGSTE REGEL!)
- ⚠️ ERFINDE KEINE FAKTEN! Wenn du keine Infos zu Preisen oder Mitarbeiterzahlen hast, nutze Platzhalter wie "[PREIS HIER]" oder "[ANZAHL PROJEKTE]".
- Nutze die bereitgestellten "ECHTEN FAKTEN" aus dem Kontext oben.
- Schreibe spezifisch, nicht generisch. Statt "Wir bieten tolle Qualität" schreibe "Wir bieten [USP aus Kontext]".

### 2. MODERNES SEO (KEIN SPAM!)
- KEIN "Keyword-Stuffing"! Die Lesbarkeit geht vor.
- Platziere das Hauptkeyword "${mainKeyword}" in H1 und Einleitung.
- Verwende danach Synonyme und natürliche Sprache.
- Schreibe für MENSCHEN, nicht für Google-Bots.

### 3. CONVERSION-OPTIMIERUNG & TRUST
- E-E-A-T: Zeige Expertise durch präzise Fachsprache, nicht durch erfundene Behauptungen.
- TRUST: Nutze die echten Fakten aus dem Input, um Vertrauen aufzubauen.
- KLARE CTAs: Jede Section endet mit einer Handlungsaufforderung.
- **KONSISTENTE PERSPEKTIVE:** Entscheide dich für EINE Perspektive und bleibe dabei!
  → Bei Unternehmen/Agenturen: Immer "Wir"
  → Bei Einzelpersonen/Freelancern: Immer "Ich"

### 4. FORMATIERUNG & STRUKTUR
- Nutze viele <h3 class="${STYLES.h3}"> Zwischenüberschriften.
- Halte Absätze extrem kurz (max. 3 Zeilen).
- Nutze Fettungen (<b>...</b>) für Schlüsselsätze, damit man den Text scannen kann.

═══════════════════════════════════════════════════════════════════════════════
OUTPUT ANFORDERUNGEN
═══════════════════════════════════════════════════════════════════════════════

REGELN:
1. KEIN MARKDOWN - nur HTML mit Tailwind-Klassen
2. Integriere ALLE angegebenen Keywords natürlich in den Text
3. Der Content muss SOFORT verwendbar sein (Copy & Paste)
4. Fokus auf TEXTBLÖCKE - wenig Design-Elemente
5. MINDESTENS 900 Wörter für ausreichende Content-Tiefe
6. ✅ BEFOLGE DIE INTENT-BASIERTE STRUKTUR OBEN!

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
     <p class="${STYLES.p}">[Authority-Building: Nutze die FAKTEN aus dem Kontext]</p>
     <p class="${STYLES.p}">[Experience: Ein konkretes Beispiel oder Erfolgsgeschichte]</p>
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
Prüfe vor Ausgabe:
✅ Ist "${mainKeyword}" in H1 und erstem Absatz?
✅ Mindestens 900 Wörter?
✅ Wurde die Intent-basierte Struktur befolgt?
✅ Wurden die FAKTEN aus dem Kontext genutzt (keine Lügen)?
      `;
    }

    // ========================================================================
    // 5. STREAMING MIT FALLBACK
    // ========================================================================
    
    try {
      console.log('🤖 Landingpage Generator: Versuche Gemini 3 Pro Preview...');
      
      const result = streamText({
        model: google('gemini-3-pro-preview'),
        prompt: prompt,
        temperature: 0.7,
      });

      return result.toTextStreamResponse({
        headers: {
          'X-AI-Model': 'gemini-3-pro-preview',
          'X-AI-Status': 'primary',
          // ✅ NEU: Intent-Info im Header
          'X-Intent-Detected': keywordAnalysis?.intentAnalysis.dominantIntent || 'unknown',
          'X-Intent-Confidence': keywordAnalysis?.intentAnalysis.mainKeywordIntent.confidence || 'unknown'
        },
      });
      
    } catch (error) {
      console.warn('⚠️ Gemini 3 Pro failed, falling back to Flash:', error);

      const result = streamText({
        model: google('gemini-2.5-flash'),
        prompt: prompt,
        temperature: 0.7,
      });

      return result.toTextStreamResponse({
        headers: {
          'X-AI-Model': 'gemini-2.5-flash',
          'X-AI-Status': 'fallback',
          'X-Intent-Detected': keywordAnalysis?.intentAnalysis.dominantIntent || 'unknown',
          'X-Intent-Confidence': keywordAnalysis?.intentAnalysis.mainKeywordIntent.confidence || 'unknown'
        },
      });
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ Landingpage Generator Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
