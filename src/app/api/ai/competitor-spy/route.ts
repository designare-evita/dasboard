// src/app/api/ai/competitor-spy/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';

// Initialisierung (wie gehabt)
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 60;

// Hilfsfunktion zum Scrapen einer einzelnen URL
async function scrapeUrl(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  
  if (!res.ok) throw new Error(`Status ${res.status}`);
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Cleanup
  $('script, style, nav, footer, iframe, svg, noscript, head').remove();
  
  const title = $('title').text().trim();
  const h1 = $('h1').text().trim();
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000); // Etwas kürzer fassen pro Seite
  
  return { url, title, h1, text };
}

export async function POST(req: NextRequest) {
  try {
    const { myUrl, competitorUrl } = await req.json();

    if (!myUrl || !competitorUrl) {
      return NextResponse.json({ message: 'Beide URLs sind erforderlich.' }, { status: 400 });
    }

    // 1. BEIDE Seiten parallel scrapen (schneller!)
    console.log('🕷️ Starte Vergleich:', myUrl, 'vs', competitorUrl);
    
    // Promise.all wartet, bis BEIDE fertig sind
    const [myData, competitorData] = await Promise.all([
      scrapeUrl(myUrl).catch(e => ({ error: true, msg: e.message, url: myUrl })),
      scrapeUrl(competitorUrl).catch(e => ({ error: true, msg: e.message, url: competitorUrl }))
    ]);

    // Fehlerprüfung
    if ('error' in myData) throw new Error(`Konnte DEINE URL nicht lesen: ${myData.msg}`);
    if ('error' in competitorData) throw new Error(`Konnte GEGNER URL nicht lesen: ${competitorData.msg}`);

    // 2. Prompt bauen
    const prompt = `
      Du bist ein knallharter SEO-Stratege. Vergleiche zwei Webseiten zum gleichen Thema.
      
      SEITE A (Meine Seite):
      - Titel: ${myData.title}
      - Text-Auszug: """${myData.text}"""
      
      SEITE B (Konkurrenz / Platz 1):
      - Titel: ${competitorData.title}
      - Text-Auszug: """${competitorData.text}"""
      
      AUFGABE:
      Warum ist Seite B besser? Finde die Unterschiede.
      
      1. **Inhaltliche Lücken (Content Gap):** Welche Themen/Unterpunkte behandelt B, die bei A fehlen?
      2. **Struktur & Lesbarkeit:** Nutzt B bessere Listen, Tabellen oder kürzere Absätze?
      3. **Tonalität & Ansprache:** Ist B emotionaler, direkter oder wissenschaftlicher?
      4. **Unique Selling Point:** Was macht B besonders gut?
      
      FAZIT & EMPFEHLUNG:
      Gib 3 konkrete Schritte, wie Seite A (Ich) den Inhalt verbessern kann, um Seite B zu schlagen.
      
      Antworte direkt, ehrlich und nutze Markdown.
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
