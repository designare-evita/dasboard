// src/app/api/ai/content-gap/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES } from '@/lib/ai-styles';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

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
Keine Einleitung, kein Markdown, nur das HTML.
      `;

      const result = streamText({
        model: google('gemini-2.5-flash'),
        prompt: prompt,
        temperature: 0.6,
      });

      return result.toTextStreamResponse();
    }

    // ========================================================================
    // FALL 2: Analyzer-Modus (Prüfung einer URL)
    // Deine existierende Logik für CtrBooster / URL-Checks
    // ========================================================================
    const { url, keywords } = body;

    if (!url || !keywords || keywords.length === 0) {
      return NextResponse.json(
        { message: 'Entweder "topic" ODER "url" + "keywords" sind erforderlich.' },
        { status: 400 }
      );
    }

    // Webseite scrapen (Existierende Logik)
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!pageRes.ok) {
      throw new Error(`Konnte URL nicht abrufen: ${pageRes.statusText} (${pageRes.status})`);
    }

    const html = await pageRes.text();
    const $ = cheerio.load(html);

    $('script, style, nav, footer, svg, button').remove();
    const pageText = $('body').text().replace(/\s+/g, ' ').slice(0, 15000); 

    // Prompt für URL-Analyse (Existierende Logik)
    const prompt = `
      Du bist ein knallharter Content-Auditor.
      
      ZIEL: Finde Lücken im Content der URL im Vergleich zu den Target-Keywords.
      
      URL CONTENT (Auszug):
      "${pageText.slice(0, 4000)}..."

      TARGET KEYWORDS:
      ${keywords.map((k: any) => `- ${k.term || k}`).join('\n')}

      STYLES TO USE:
      - H3: <h3 class="${STYLES.h3}">...</h3>
      - Label: <span class="${STYLES.label}">LABEL</span>

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

    const result = streamText({
      model: google('gemini-2.5-flash'), 
      prompt: prompt,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    console.error('Content Gap Error:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Analyse fehlgeschlagen' }, 
      { status: 500 }
    );
  }
}
