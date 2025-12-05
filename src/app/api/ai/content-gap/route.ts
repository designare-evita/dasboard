// src/app/api/ai/content-gap/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';

// 1. Initialisierung mit DEINEM Variablennamen (GEMINI_API_KEY)
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
    // Wir nutzen einen Fake-User-Agent, damit Google/Webseiten uns nicht blocken
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

    // Unnötigen Ballast entfernen, um Token zu sparen
    $('script, style, nav, footer, iframe, svg, noscript, head').remove();
    
    // Relevanten Content extrahieren
    const title = $('title').text().trim();
    const h1 = $('h1').text().trim();
    
    // Text bereinigen: Mehrfach-Leerzeichen entfernen und auf ca. 15.000 Zeichen kürzen
    const bodyText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); 

    // 3. Prompt erstellen
    const prompt = `
      Du bist ein Senior SEO-Experte. Führe eine "Content Gap Analyse" durch.

      ZIEL: Optimiere den Text der Webseite basierend auf Suchdaten.

      DATEN:
      - URL: ${url}
      - Title/H1: ${title} / ${h1}
      - Top Keywords (aus GSC): ${keywords.join(', ')}

      WEBSITEN-TEXT (Auszug):
      """
      ${bodyText}
      """

      AUFGABE:
      Analysiere, wie gut der Text die Keywords abdeckt.
      1. **Fehlende Keywords:** Welche Top-Keywords fehlen oder kommen zu selten vor?
      2. **Inhaltliche Lücken:** Welche Fragen (User Intent) hinter den Keywords werden nicht beantwortet?
      3. **Optimierung:** Gib 3 konkrete Vorschläge. Zitiere einen Satz aus dem Text und zeige eine bessere Version inkl. Keyword.
      4. **Struktur:** Fehlt eine Zwischenüberschrift (H2/H3)?

      Antworte direkt, hilfreich und formatiere mit Markdown (Fett, Listen).
    `;

    // 4. KI Stream starten (mit dem korrekt konfigurierten 'google' Objekt)
    const result = streamText({
      model: google('gemini-2.5-flash'), // 'flash' ist schneller, 'pro' ist schlauer für Analysen
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
