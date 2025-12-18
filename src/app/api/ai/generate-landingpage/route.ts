// src/app/api/ai/generate-landingpage/route.ts
import { streamText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES } from '@/lib/ai-styles';
import { google, AI_CONFIG } from '@/lib/ai-config';
import { 
  analyzeKeywords, 
  generateKeywordPromptContext,
  generateIntentReport,
  type Keyword,
  type SearchIntent
} from '@/lib/keyword-analyzer';

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
  // ✅ Optionaler Kontext für Produkte/Fakten
  productContext?: string; 
  // NEU: Sektions-Auswahl (Landingpage: full/intro/benefits/trust/faq, Blog: full/intro/main/faq/conclusion)
  section?: 'full' | 'intro' | 'benefits' | 'trust' | 'faq' | 'main' | 'conclusion';
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
   - Starker CTA (Call-to-Action) Link/Button
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
        productContext, // ✅ NEU
        section = 'full' // NEU: Sektions-Auswahl (default: full)
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
    // NEU: SEKTIONS-SPEZIFISCHE INSTRUKTION
    // ========================================================================

    let sectionInstruction = "";
    let sectionStructure = "";

    // LANDINGPAGE SEKTIONEN
    if (contentType === 'landingpage') {
      switch (section) {
        case 'intro':
          sectionInstruction = `
⚠️ SEKTIONS-AUFTRAG: NUR HERO & EINLEITUNG
Generiere AUSSCHLIESSLICH den Hero-Bereich (H1) und die Einleitung (Problem & Lösung). 
Fokus auf starke Hooks und emotionale Ansprache.
STOPPE DANACH! KEIN FAQ, KEINE Benefits-Liste, KEIN Social Proof, KEINE weiteren Sektionen!
`;
          sectionStructure = `
STRUKTUR (NUR DIESE ELEMENTE!):

# [Aufmerksamkeitsstarke H1 - MUSS "${mainKeyword}" enthalten!]

[Einleitender Absatz mit HAUPTKEYWORD - Hook, UVP & Benefit in 2-3 Sätzen]

## [Problem-Aufriss H2]
[Ausführlicher Absatz - Problem der Zielgruppe ansprechen, emotional, min. 150 Wörter]

## [Lösungs-Versprechen H2]
[Zweiter Absatz - Lösung präsentieren mit konkreten Vorteilen, min. 150 Wörter]

> **CTA:** [Mini-CTA: "Erfahren Sie mehr..." oder "Kontaktieren Sie uns..."]

WICHTIG: STOPPE HIER! Generiere KEINE weiteren Sektionen!
`;
          break;
        case 'benefits':
          sectionInstruction = `
⚠️ SEKTIONS-AUFTRAG: NUR VORTEILE & FEATURES
Generiere AUSSCHLIESSLICH die Nutzen-Argumentation, Features und USPs.
Sei extrem detailliert und spezifisch. Mindestens 6-8 Vorteile mit ausführlicher Erklärung.
STOPPE DANACH! KEINE Einleitung, KEIN FAQ, KEIN Social Proof!
`;
          sectionStructure = `
STRUKTUR (NUR DIESE ELEMENTE!):

## Ihre Vorteile auf einen Blick

### [Vorteil 1 - mit Keyword-Bezug]
[Ausführliche Erklärung des Nutzens, min. 50 Wörter, konkret und spezifisch]

### [Vorteil 2]
[Ausführliche Erklärung, mit Zahlen oder Zeitangaben wenn möglich]

### [Vorteil 3]
[Emotionaler Nutzen, was verändert sich für den Kunden?]

### [Vorteil 4]
[Trust-Element: Garantie, Support, Sicherheit]

### [Vorteil 5]
[Weiterer relevanter Vorteil]

### [Vorteil 6]
[Weiterer relevanter Vorteil]

## Features im Detail

* **[Feature 1]:** [Technische/praktische Erklärung]
* **[Feature 2]:** [Was macht es besonders?]
* **[Feature 3]:** [Alleinstellungsmerkmal]
* **[Feature 4]:** [Praktischer Nutzen]

WICHTIG: STOPPE HIER! Generiere KEINE Einleitung, KEIN FAQ, KEINEN Social Proof!
`;
          break;
        case 'trust':
          sectionInstruction = `
⚠️ SEKTIONS-AUFTRAG: NUR SOCIAL PROOF & TRUST
Generiere AUSSCHLIESSLICH Trust-Elemente: Testimonials, Referenzen, Zahlen, Auszeichnungen, Expertise.
Fokus auf Glaubwürdigkeit und Vertrauensaufbau.
STOPPE DANACH! KEINE Einleitung, KEINE Benefits-Liste, KEIN FAQ!
`;
          sectionStructure = `
STRUKTUR (NUR DIESE ELEMENTE!):

## Unsere Expertise

[Authority-Building: Erfahrung, Qualifikationen, Hintergrund - min. 100 Wörter]

## Das sagen unsere Kunden

> _"[Testimonial 1 - authentisch klingend, mit konkretem Ergebnis]"_
> — [Name], [Position/Unternehmen]

> _"[Testimonial 2 - anderer Aspekt hervorheben]"_
> — [Name], [Position/Unternehmen]

> _"[Testimonial 3 - emotionaler Fokus]"_
> — [Name], [Position/Unternehmen]

## Zahlen & Fakten

* **[Zahl 1]** [Kunden/Projekte/Jahre Erfahrung]
* **[Zahl 2]** [Erfolgsquote/Zufriedenheit]
* **[Zahl 3]** [Relevante Metrik]

## Auszeichnungen & Zertifizierungen

[Falls relevant: Siegel, Zertifikate, Partnerschaften, Medienerwähnungen]

WICHTIG: STOPPE HIER! Generiere KEINE Einleitung, KEINE Benefits, KEIN FAQ!
`;
          break;
        case 'faq':
          sectionInstruction = `
⚠️ SEKTIONS-AUFTRAG: NUR FAQ & ABSCHLUSS
Generiere AUSSCHLIESSLICH eine umfangreiche FAQ-Sektion (mind. 6 Fragen) und das Fazit mit starkem CTA.
Fokus auf Einwandbehandlung und Handlungsaufforderung.
STOPPE DANACH! KEINE Einleitung, KEINE Benefits, KEIN Social Proof davor!
`;
          sectionStructure = `
STRUKTUR (NUR DIESE ELEMENTE!):

## Häufig gestellte Fragen

### [Frage 1 - MUSS Hauptkeyword "${mainKeyword}" enthalten]
[Ausführliche Antwort mit LSI-Keywords, 3-4 Sätze]

### [Frage 2 - Keyword-Variante]
[Antwort mit konkreten Zahlen/Fakten]

### [Frage 3 - Kosten/Preis-Frage]
[Transparente Antwort, Wert hervorheben]

### [Frage 4 - Zeitrahmen/Ablauf]
[Klare Schritte, Transparenz schaffen]

### [Frage 5 - Einwand/Bedenken]
[Bedenken ausräumen, Sicherheit geben]

### [Frage 6 - Vergleich/Alternative]
[Warum diese Lösung die beste ist]

---

## [Starker CTA-Titel mit Urgency]

[Zusammenfassung des Hauptnutzens + emotionale Handlungsaufforderung, min. 50 Wörter]

**[Konkreter nächster Schritt: "Jetzt unverbindlich anfragen" / "Kostenlose Erstberatung sichern"]**

WICHTIG: STOPPE HIER! Generiere KEINE Einleitung, KEINE Benefits, KEINEN Social Proof!
`;
          break;
        default:
          sectionInstruction = "";
          sectionStructure = "";
      }
    }
    // BLOG SEKTIONEN
    else if (contentType === 'blog') {
      switch (section) {
        case 'intro':
          sectionInstruction = `
⚠️ SEKTIONS-AUFTRAG: NUR EINLEITUNG & HOOK
Generiere AUSSCHLIESSLICH die Headline (H1) und eine packende Einleitung.
Fokus auf: Aufmerksamkeit gewinnen, Problem aufzeigen, Neugier wecken.
STOPPE DANACH! KEIN Hauptteil, KEIN FAQ, KEIN Fazit!
`;
          sectionStructure = `
STRUKTUR (NUR DIESE ELEMENTE!):

# [Packende H1 mit "${mainKeyword}" - Neugier wecken!]

> **Das Wichtigste in Kürze:**
> * [Key Takeaway 1 - Was lernt der Leser?]
> * [Key Takeaway 2 - Welches Problem wird gelöst?]
> * [Key Takeaway 3 - Warum ist das relevant?]

[Einleitender Absatz: Hook mit überraschender Statistik, Frage oder Aussage - min. 80 Wörter]

[Zweiter Absatz: Problem vertiefen, Relevanz für den Leser herstellen - min. 80 Wörter]

[Dritter Absatz: Vorschau auf den Artikel, was wird der Leser erfahren? - min. 60 Wörter]

WICHTIG: STOPPE HIER! Generiere KEINEN Hauptteil, KEIN FAQ, KEIN Fazit!
`;
          break;
        case 'main':
          sectionInstruction = `
⚠️ SEKTIONS-AUFTRAG: NUR HAUPTTEIL (DEEP DIVE)
Generiere AUSSCHLIESSLICH den informativen Hauptteil des Artikels.
Detaillierte Erklärungen, Anleitungen, Beispiele, Tipps.
STOPPE DANACH! KEINE Einleitung, KEIN FAQ, KEIN Fazit!
`;
          sectionStructure = `
STRUKTUR (NUR DIESE ELEMENTE!):

## [H2: Grundlagen / Definition von "${mainKeyword}"]
[Ausführliche Erklärung des Konzepts, min. 150 Wörter]

## [H2: Warum ist das wichtig? / Die Vorteile]
[Relevanz und Nutzen erklären, min. 150 Wörter]

## [H2: Schritt-für-Schritt Anleitung / So funktioniert es]

### Schritt 1: [Erster Schritt]
[Detaillierte Erklärung mit praktischen Tipps]

### Schritt 2: [Zweiter Schritt]
[Detaillierte Erklärung mit praktischen Tipps]

### Schritt 3: [Dritter Schritt]
[Detaillierte Erklärung mit praktischen Tipps]

### Schritt 4: [Vierter Schritt]
[Detaillierte Erklärung mit praktischen Tipps]

> 💡 **Experten-Tipp:**
> [Ein wertvoller Insider-Tipp aus der Praxis]

## [H2: Häufige Fehler vermeiden]

* ❌ **Falsch:** [Typischer Fehler 1]
* ✅ **Richtig:** [Bessere Vorgehensweise]

* ❌ **Falsch:** [Typischer Fehler 2]
* ✅ **Richtig:** [Bessere Vorgehensweise]

* ❌ **Falsch:** [Typischer Fehler 3]
* ✅ **Richtig:** [Bessere Vorgehensweise]

## [H2: Fortgeschrittene Tipps / Best Practices]
[Weiterführende Informationen für erfahrene Leser, min. 150 Wörter]

WICHTIG: STOPPE HIER! Generiere KEINE Einleitung, KEIN FAQ, KEIN Fazit!
`;
          break;
        case 'faq':
          sectionInstruction = `
⚠️ SEKTIONS-AUFTRAG: NUR FAQ-SEKTION
Generiere AUSSCHLIESSLICH eine umfangreiche FAQ-Sektion zum Thema.
Fokus auf häufige Leserfragen, Featured-Snippet-Optimierung.
STOPPE DANACH! KEINE Einleitung, KEIN Hauptteil, KEIN Fazit!
`;
          sectionStructure = `
STRUKTUR (NUR DIESE ELEMENTE!):

## Häufig gestellte Fragen zu ${mainKeyword}

### Was ist ${mainKeyword}?
[Klare, prägnante Definition in 2-3 Sätzen - Featured Snippet optimiert]

### Wie funktioniert ${mainKeyword}?
[Prozess oder Mechanismus erklären, 3-4 Sätze]

### Was kostet ${mainKeyword}? / Lohnt sich ${mainKeyword}?
[Kosten-Nutzen-Betrachtung, realistische Einschätzung]

### Für wen eignet sich ${mainKeyword}?
[Zielgruppen definieren, Anwendungsfälle nennen]

### Welche Alternativen gibt es zu ${mainKeyword}?
[2-3 Alternativen kurz vorstellen, Vor-/Nachteile]

### Wie lange dauert ${mainKeyword}? / Wann sehe ich Ergebnisse?
[Realistische Zeitrahmen nennen]

### Was sind die häufigsten Fehler bei ${mainKeyword}?
[Top 3 Fehler und wie man sie vermeidet]

### Wo finde ich mehr Informationen zu ${mainKeyword}?
[Weiterführende Ressourcen, nächste Schritte]

WICHTIG: STOPPE HIER! Generiere KEINE Einleitung, KEINEN Hauptteil, KEIN Fazit!
`;
          break;
        case 'conclusion':
          sectionInstruction = `
⚠️ SEKTIONS-AUFTRAG: NUR FAZIT & CTA
Generiere AUSSCHLIESSLICH das Fazit mit Zusammenfassung und Call-to-Action.
Fokus auf Key Takeaways und nächste Schritte für den Leser.
STOPPE DANACH! KEINE Einleitung, KEIN Hauptteil, KEIN FAQ davor!
`;
          sectionStructure = `
STRUKTUR (NUR DIESE ELEMENTE!):

## Fazit: [Zusammenfassender Titel mit "${mainKeyword}"]

[Zusammenfassung der wichtigsten Erkenntnisse in 2-3 Sätzen]

### Die wichtigsten Punkte auf einen Blick:

* ✅ [Key Takeaway 1 - Wichtigste Erkenntnis]
* ✅ [Key Takeaway 2 - Praktischer Nutzen]
* ✅ [Key Takeaway 3 - Handlungsempfehlung]
* ✅ [Key Takeaway 4 - Ausblick/Nächster Schritt]

[Abschließender Absatz: Motivation und Ermutigung zum Handeln, min. 80 Wörter]

---

**Fanden Sie diesen Artikel hilfreich?**

[Call-to-Action: Newsletter, Kontakt, weiterführende Artikel, Social Sharing - je nach Kontext]

**[Konkreter nächster Schritt für den Leser]**

WICHTIG: STOPPE HIER! Generiere KEINE Einleitung, KEINEN Hauptteil, KEIN FAQ!
`;
          break;
        default:
          sectionInstruction = "";
          sectionStructure = "";
      }
    }

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

${sectionInstruction}

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

Generiere NUR sauberes **Markdown** (.md). KEIN HTML.
${sectionStructure ? `${sectionStructure}` : `
Struktur:

# [Titel mit "${mainKeyword}"]

> **Das Wichtigste in Kürze:**
> * [Key Takeaway 1]
> * [Key Takeaway 2]
> * [Key Takeaway 3]

[Starke Einleitung: Problemaufriss und Versprechen]

## [H2: Grundlagen / Definition]
[Erklärender Text...]

## [H2: Deep Dive - Hauptteil]
[Detaillierter Content...]

> 💡 **Experten-Tipp:**
> [Ein wertvoller Tipp aus der Praxis]

## [H2: Anleitung / Schritt-für-Schritt]
1. **[Schritt 1]:** [Erklärung]
2. **[Schritt 2]:** [Erklärung]
3. **[Schritt 3]:** [Erklärung]

## Häufige Fehler (und wie man sie vermeidet)
* ❌ **Falsch:** [Typischer Fehler]
* ✅ **Richtig:** [Lösung/Best Practice]

## Fazit
[Zusammenfassung und Ausblick]

---
**Fanden Sie diesen Artikel hilfreich?**
[Passender CTA für einen Blog, z.B. Newsletter oder Kontakt]

WICHTIG: Generiere NUR den Markdown-Code. Mindestens 1200 Wörter.`}
${sectionStructure ? `\n⚠️ KRITISCH: Generiere NUR die oben angegebene Sektion! KEINE anderen Teile!` : ''}
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

${sectionInstruction}

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
- Nutze Markdown für die Struktur (#, ##, ###).
- Halte Absätze extrem kurz (max. 3 Zeilen).
- Nutze Fettungen (**...**) für Schlüsselsätze, damit man den Text scannen kann.

═══════════════════════════════════════════════════════════════════════════════
OUTPUT ANFORDERUNGEN
═══════════════════════════════════════════════════════════════════════════════

REGELN:
1. ✅ GENERIERE NUR SAUBERES MARKDOWN (.md) - KEIN HTML!
2. Integriere ALLE angegebenen Keywords natürlich in den Text
3. Der Content muss SOFORT verwendbar sein (Copy & Paste)
${sectionStructure ? '4. ✅ BEFOLGE EXAKT DIE SEKTIONS-STRUKTUR UNTEN - NICHTS ANDERES!' : '4. MINDESTENS 900 Wörter für ausreichende Content-Tiefe\n5. ✅ BEFOLGE DIE INTENT-BASIERTE STRUKTUR OBEN!'}

${sectionStructure || `STRUKTUR (in dieser Reihenfolge):

# [Aufmerksamkeitsstarke H1 - MUSS "${mainKeyword}" enthalten!]

[Einleitender Absatz mit HAUPTKEYWORD - Hook, UVP & Benefit in 2-3 Sätzen]

## [Nutzen-orientierte H2 mit Keyword-Variante]
[Ausführlicher Absatz - Problem der Zielgruppe ansprechen, min. 100 Wörter]

[Zweiter Absatz - Lösung präsentieren mit konkreten Vorteilen]

> **CTA:** [Mini-CTA: "Erfahren Sie mehr..." oder "Kontaktieren Sie uns..."]

## [E-E-A-T H2: "Unsere Expertise" / "Warum wir"]
[Authority-Building: Nutze die FAKTEN aus dem Kontext]

[Experience: Ein konkretes Beispiel oder Erfolgsgeschichte]

## Ihre Vorteile auf einen Blick
* **[Benefit 1]:** [Konkreter Nutzen, nicht Feature]
* **[Benefit 2]:** [Mit Zahl oder Zeitangabe wenn möglich]
* **[Benefit 3]:** [Emotionaler Nutzen]
* **[Benefit 4]:** [Trust-Element: Garantie/Support]

## [Social Proof H2: "Das sagen unsere Kunden" / "Erfolge"]
[Referenz-Absatz: Branche, Anzahl Kunden, durchschnittliche Ergebnisse]

> _"[Optional: Kurzes Zitat-Beispiel eines fiktiven zufriedenen Kunden]"_

## Häufig gestellte Fragen

### [Frage 1 - MUSS Hauptkeyword enthalten]
[Ausführliche Antwort mit LSI-Keywords, 2-3 Sätze]

### [Frage 2 - Keyword-Variante]
[Antwort mit konkreten Zahlen/Fakten]

### [Frage 3 - Einwandbehandlung: Kosten/Zeit/Aufwand]
[Antwort die Bedenken ausräumt]

### [Frage 4 - "Wie läuft der Prozess ab?" o.ä.]
[Klare Schritte, Transparenz schaffen]

---

## [Starker CTA-Titel mit Urgency]
[Zusammenfassung des Hauptnutzens + Handlungsaufforderung]

**[Konkreter nächster Schritt: "Jetzt unverbindlich anfragen" / "Kostenlose Erstberatung sichern"]**`}

═══════════════════════════════════════════════════════════════════════════════

WICHTIG: Generiere NUR Markdown. Keine Einleitung, keine Erklärungen.
${sectionStructure ? `⚠️ KRITISCH: Generiere NUR die oben angegebene Sektion! KEINE anderen Teile!` : `Prüfe vor Ausgabe:
✅ Ist "${mainKeyword}" in H1 und erstem Absatz?
✅ Mindestens 900 Wörter?
✅ Wurde die Intent-basierte Struktur befolgt?
✅ Wurden die FAKTEN aus dem Kontext genutzt (keine Lügen)?`}
      `;
    }

    // ========================================================================
    // 5. STREAMING MIT FALLBACK (ZENTRALE CONFIG)
    // ========================================================================
    
    try {
      console.log(`🤖 Landingpage Generator: Versuche ${AI_CONFIG.primaryModel}...`);
      
      const result = streamText({
        model: google(AI_CONFIG.primaryModel),
        prompt: prompt,
        temperature: 0.7,
      });

      return result.toTextStreamResponse({
        headers: {
          'X-AI-Model': AI_CONFIG.primaryModel,
          'X-AI-Status': 'primary',
          // ✅ NEU: Intent-Info im Header
          'X-Intent-Detected': keywordAnalysis?.intentAnalysis.dominantIntent || 'unknown',
          'X-Intent-Confidence': keywordAnalysis?.intentAnalysis.mainKeywordIntent.confidence || 'unknown'
        },
      });
      
    } catch (error) {
      console.warn(`⚠️ ${AI_CONFIG.primaryModel} failed, falling back to ${AI_CONFIG.fallbackModel}:`, error);

      const result = streamText({
        model: google(AI_CONFIG.fallbackModel),
        prompt: prompt,
        temperature: 0.7,
      });

      return result.toTextStreamResponse({
        headers: {
          'X-AI-Model': AI_CONFIG.fallbackModel,
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
