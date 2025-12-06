// src/app/api/ai/content-gap/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';

// 1. Initialisierung
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Wichtig für Cheerio (Scraping funktioniert nicht im Edge-Modus)
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

    // 2. Webseite scrapen
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

    // Unnötigen Ballast entfernen
    $('script, style, nav, footer, iframe, svg, noscript, head').remove();
    
    // Relevanten Content extrahieren
    const title = $('title').text().trim();
    const h1 = $('h1').text().trim();
    
    // Text bereinigen
    const bodyText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); 

    // 3. Prompt erstellen (MIT STRIKTER HTML-BOLD REGEL)
    // ✅ ÄNDERUNG: Margins und Paddings in den STYLING VORGABEN stark reduziert
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
      1. VERWENDE KEIN MARKDOWN! Das bedeutet:
         - KEINE Sternchen für Fettschrift (**Fett** -> VERBOTEN).
         - KEINE Rauten für Überschriften (## Titel -> VERBOTEN).
         - KEINE Markdown-Listen (* Punkt -> VERBOTEN).
      
      2. WENN DU ETWAS HERVORHEBEN WILLST:
         - Nutze IMMER den HTML-Tag: <strong class="font-bold text-gray-900">Dein Text</strong>
      
      3. Nutze AUSSCHLIESSLICH HTML-Tags mit Tailwind-Klassen.
      
      STYLING VORGABEN (Nutze genau diese Klassen):
      - Überschriften: <h3 class="font-bold text-indigo-900 mt-4 mb-2 text-lg flex items-center gap-2">TITEL</h3>
      - Fließtext: <p class="mb-2 leading-relaxed text-gray-600 text-sm">TEXT</p>
      - Listen-Container: <ul class="space-y-2 mb-4 list-none pl-0">
      - Listen-Items: <li class="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100"><span class="text-indigo-500 font-bold mt-0.5 text-lg leading-none">•</span> <span><strong class="font-bold text-gray-900">Thema:</strong> Inhalt...</span></li>
      - Keywords hervorheben: <span class="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-xs uppercase tracking-wide">KEYWORD</span>
      - Optimierungs-Box: <div class="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 my-3 space-y-1.5">
      - Label (z.B. Original/Besser): <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">LABEL</span>

      AUFGABE:
      Analysiere, wie gut der Text die Keywords abdeckt. Erstelle folgenden HTML-Report:

      1. <h3...>🔍 Fehlende Keywords & Signale</h3>
         Welche Top-Keywords fehlen oder kommen zu selten vor? Liste sie auf und erkläre kurz, warum sie wichtig sind.

      2. <h3...>🧠 Inhaltliche Lücken (User Intent)</h3>
         Welche Fragen (User Intent) hinter den Keywords werden nicht beantwortet? Was erwartet der Nutzer, findet es aber nicht?

      3. <h3...>✨ Konkrete Optimierung (3 Vorschläge)</h3>
         Gib 3 konkrete Beispiele. Nutze für jedes Beispiel die "Optimierungs-Box".
         Struktur in der Box:
         - Label "ORIGINAL (SCHWACH)": Zitiere einen schwachen Satz aus dem Text.
         - Label "BESSER (OPTIMIERT)": Zeige eine bessere Version, die das Keyword natürlich enthält (Keyword hervorheben).

      4. <h3...>🏗 Struktur & Technik Check</h3>
         Fehlt eine Zwischenüberschrift (H2/H3)? Ist der Title optimal? 
         Nutze für die Punkte in der Liste zwingend <strong class="font-bold text-gray-900">Bezeichnung:</strong> am Anfang jedes Listenpunkts, anstatt Sternchen (**).

      Antworte direkt mit dem HTML-Code. Keine Einleitung.
    `;

    // 4. KI Stream starten
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
