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
    const { url, keywords } = await req.json();

    if (!url || !keywords || keywords.length === 0) {
      return NextResponse.json(
        { message: 'URL und Keywords sind erforderlich.' },
        { status: 400 }
      );
    }

    // Webseite scrapen
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

    $('script, style, nav, footer, iframe, svg, noscript, head').remove();
    
    const title = $('title').text().trim();
    const h1 = $('h1').text().trim();
    
    const bodyText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); 

    // Prompt mit zentralen Styles
    const prompt = `
      Du bist ein Senior SEO-Experte. Führe eine "Content Gap Analyse" durch.

      DATEN:
      - URL: ${url}
      - Title/H1: ${title} / ${h1}
      - Top Keywords (aus GSC): ${keywords.join(', ')}

      WEBSITEN-TEXT (Auszug):
      """
      ${bodyText}
      """

      REGELN FÜR FORMATIERUNG (STRIKT BEFOLGEN):
      1. VERWENDE KEIN MARKDOWN!
      2. Nutze AUSSCHLIESSLICH HTML-Tags mit Tailwind-Klassen.
      3. Nutze Bootstrap Icons: <i class="bi bi-icon-name"></i>
      
      STYLING VORGABEN:
      - Überschriften: <h3 class="${STYLES.h3}"><i class="bi bi-icon"></i> TITEL</h3>
      - Fließtext: <p class="${STYLES.p}">TEXT</p>
      - Listen-Container: <ul class="${STYLES.list}">
      - Listen-Items: <li class="${STYLES.listItem} bg-gray-50 p-2.5 rounded-lg border border-gray-100"><i class="bi bi-dot ${STYLES.iconIndigo}"></i><span><strong class="font-bold text-gray-900">Thema:</strong> Inhalt...</span></li>
      - Keywords hervorheben: <span class="${STYLES.badgeIndigo}">KEYWORD</span>
      - Optimierungs-Box: <div class="${STYLES.indigoBox} my-2">
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

  } catch (error: any) {
    console.error('❌ Content Gap Error:', error);
    return NextResponse.json(
      { message: error.message || 'Fehler bei der Analyse' },
      { status: 500 }
    );
  }
}
