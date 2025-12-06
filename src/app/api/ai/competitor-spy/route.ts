// src/app/api/ai/competitor-spy/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 60;

// Hilfsfunktion zum Scrapen
async function scrapeUrl(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  
  if (!res.ok) throw new Error(`Status ${res.status}`);
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  $('script, style, nav, footer, iframe, svg, noscript, head').remove();
  
  const title = $('title').text().trim();
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000); 
  
  return { url, title, text };
}

export async function POST(req: NextRequest) {
  try {
    const { myUrl, competitorUrl } = await req.json();

    if (!myUrl || !competitorUrl) {
      return NextResponse.json({ message: 'Beide URLs sind erforderlich.' }, { status: 400 });
    }

    // 1. Scraping
    const [myData, competitorData] = await Promise.all([
      scrapeUrl(myUrl).catch(e => ({ error: true, msg: e.message, url: myUrl, title: 'Fehler', text: '' })),
      scrapeUrl(competitorUrl).catch(e => ({ error: true, msg: e.message, url: competitorUrl, title: 'Fehler', text: '' }))
    ]);

    // 2. Prompt (HTML & TAILWIND STRIKT)
    const prompt = `
      Du bist ein knallharter SEO-Stratege. Vergleiche zwei Webseiten.

      SEITE A (Meine Seite):
      - Titel: ${myData.title}
      - Text-Auszug: """${myData.text}"""
      
      SEITE B (Konkurrenz / Gewinner):
      - Titel: ${competitorData.title}
      - Text-Auszug: """${competitorData.text}"""

      REGELN FÜR FORMATIERUNG (STRIKT BEFOLGEN):
      1. VERWENDE KEIN MARKDOWN! (Keine **, keine ##, keine * Listen).
      2. Nutze IMMER den HTML-Tag für Fettschrift: <strong class="font-bold text-gray-900">Dein Text</strong>
      3. Nutze AUSSCHLIESSLICH HTML-Tags mit Tailwind-Klassen.

      STYLING VORGABEN:
      - Überschriften: <h3 class="font-bold text-indigo-900 mt-8 mb-4 text-lg flex items-center gap-2">TITEL</h3>
      - Fließtext: <p class="mb-4 leading-relaxed text-gray-600 text-sm">TEXT</p>
      - Listen: <ul class="space-y-3 mb-6 list-none pl-0">
      - Listen-Items: <li class="flex items-start gap-3 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100"><span class="text-rose-500 font-bold mt-0.5 text-lg">vs</span> <span>Inhalt...</span></li>
      - Empfehlungs-Box: <div class="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 my-6 shadow-sm">
      - Badges: <span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Besser bei B</span>

      AUFGABE (Erstelle diesen HTML Report):
      
      1. <h3...>🏆 Warum rankt Seite B besser?</h3>
         Fasse kurz zusammen, was der "Unique Selling Point" oder der inhaltliche Vorteil von Seite B ist.
      
      2. <h3...>🥊 Der direkte Vergleich (Inhalt & Struktur)</h3>
         Erstelle eine Liste der Unterschiede.
         Nutze für jeden Punkt die Listen-Item Struktur. Beginne jeden Punkt mit <strong class="font-bold text-gray-900">Thema:</strong>.
         Analysiere: Fehlende Themen bei A, bessere Lesbarkeit bei B, emotionalere Ansprache bei B.

      3. <h3...>🚀 Masterplan: So schlagen wir Seite B (3 Schritte)</h3>
         Nutze die "Empfehlungs-Box" für diesen gesamten Abschnitt.
         Gib 3 nummerierte, knallharte Handlungsempfehlungen (HTML Liste innerhalb der Box).
         Was muss Seite A konkret tun (Text erweitern, Tabelle einfügen, Title ändern)?

      Antworte direkt mit dem HTML-Code.
    `;

    // 3. Stream starten
    const result = streamText({
      model: google('gemini-2.5-flash'),
      prompt: prompt,
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('❌ Competitor Spy Error:', error);
    return NextResponse.json(
      { message: error.message || 'Fehler beim Vergleich' },
      { status: 500 }
    );
  }
}
