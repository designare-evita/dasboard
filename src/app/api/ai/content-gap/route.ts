// src/app/api/ai/content-gap/route.ts
import { streamTextSafe } from '@/lib/ai-config'; // <--- Zentraler Import
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES } from '@/lib/ai-styles';

export const runtime = 'nodejs'; 
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // ========================================================================
    // FALL 1: Generator-Modus (Brainstorming anhand von Thema)
    // Wird vom LandingpageGenerator genutzt
    // ========================================================================
    if (body.topic) {
      const { topic, domain } = body;
      
      const prompt = `
Du bist ein SEO-Stratege. Führe eine kurze, prägnante Content-Gap-Analyse durch.

THEMA: "${topic}"
ZIEL-DOMAIN: "${domain || 'Nicht angegeben'}"

AUFGABE:
Identifiziere 3-5 wichtige Unterthemen oder Aspekte, die bei diesem Thema oft vergessen werden, aber für ein Top-Ranking bei Google entscheidend sind (semantische Vollständigkeit).

FORMAT:
Gib das Ergebnis als einfache HTML-Liste (<ul><li>...</li></ul>) zurück. 
Jeder Punkt soll:
1. Den fehlenden Aspekt benennen (fett).
2. Kurz erklären, warum er wichtig ist.

STYLING:
Nutze diese Tailwind-Klassen:
- Liste: <ul class="${STYLES.list}">
- Item: <li class="mb-2 text-indigo-950">
- Highlight: <strong class="text-indigo-600 font-medium">

Antworte NUR mit dem HTML-Code der Liste. Keine Einleitung.
      `;

      // NEU: Zentraler Aufruf mit Fallback
      const result = await streamTextSafe({
        prompt: prompt,
        temperature: 0.7, // Etwas kreativer für Brainstorming
      });

      return result.toTextStreamResponse();
    }

    // ========================================================================
    // FALL 2: Analyse-Modus (URL vs. Keywords)
    // Wird im "Content Gap" Tool genutzt
    // ========================================================================
    const { url, keywords } = body;

    if (!url || !keywords) {
      return NextResponse.json({ message: 'URL und Keywords erforderlich' }, { status: 400 });
    }

    // 1. Content scrapen
    const response = await fetch(url, { headers: { 'User-Agent': 'Googlebot-Simulator' } });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Nur relevanten Text extrahieren
    $('script, style, nav, footer, iframe, svg').remove();
    const content = $('body').text().replace(/\s+/g, ' ').substring(0, 6000);
    const title = $('title').text();
    const h1 = $('h1').first().text();

    // 2. Prompt bauen
    const prompt = `
      Du bist ein knallharter Content-Auditor.
      
      ZIEL-URL: ${url}
      TITEL: ${title}
      H1: ${h1}
      
      ZIEL-KEYWORDS: ${keywords}
      
      IST-INHALT (Auszug):
      ${content}...
      
      FORMATIERUNG:
      Nutze NUR HTML (kein Markdown). Nutze Tailwind Klassen.
      Icons: Bootstrap Icons (bi-...).
      
      Styling Konstanten:
      - Boxen: ${STYLES.card}
      - Headlines: ${STYLES.h3}
      - Listen: ${STYLES.list}
      - Labels: <span class="${STYLES.label}">LABEL</span>

      AUFGABE:
      Analysiere, wie gut der Text die Keywords abdeckt. Erstelle folgenden HTML-Report:

      1. <h3 class="${STYLES.h3}"><i class="bi bi-search"></i> Fehlende Keywords & Signale</h3>
         Welche Top-Keywords fehlen oder kommen zu selten vor?

      2. <h3 class="${STYLES.h3}"><i class="bi bi-person-raised-hand"></i> Inhaltliche Lücken (User Intent)</h3>
         Welche Fragen werden nicht beantwortet?

      3. <h3 class="${STYLES.h3}"><i class="bi bi-magic"></i> Konkrete Optimierung (3 Vorschläge)</h3>
         Gib 3 konkrete Beispiele. Nutze für jedes Beispiel die Optimierungs-Box:
         - <span class="${STYLES.label}">ORIGINAL</span>: Zitiere schwachen Satz.
         - <span class="${STYLES.label}">BESSER</span>: Bessere Version mit Keyword.

      4. <h3 class="${STYLES.h3}"><i class="bi bi-diagram-3"></i> Struktur & Technik Check</h3>
         Fehlt H2/H3? Ist der Title optimal?
         Nutze <strong class="font-bold text-gray-900">Bezeichnung:</strong> am Anfang jedes Listenpunkts.

      Antworte direkt mit dem HTML-Code. Keine Einleitung.
    `;

    // NEU: Zentraler Aufruf mit Fallback
    const result = await streamTextSafe({
      prompt: prompt,
      // Standard-Temperature (0.7) aus Config wird genutzt, wenn nicht überschrieben
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    console.error('Content Gap Error:', error);
    return NextResponse.json({ message: 'Analyse fehlgeschlagen' }, { status: 500 });
  }
}
