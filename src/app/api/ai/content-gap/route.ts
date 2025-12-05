import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // Erlaubt längere Laufzeit für Scraping + AI

export async function POST(req: NextRequest) {
  try {
    const { url, keywords, domain } = await req.json();

    if (!url || !keywords || keywords.length === 0) {
      return NextResponse.json(
        { message: 'URL und Keywords sind erforderlich.' },
        { status: 400 }
      );
    }

    // 1. Webseite scrapen
    console.log('🕷️ Scrape URL:', url);
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!pageRes.ok) {
      throw new Error(`Konnte URL nicht abrufen: ${pageRes.statusText}`);
    }

    const html = await pageRes.text();
    const $ = cheerio.load(html);

    // Unnötige Elemente entfernen
    $('script, style, nav, footer, iframe, svg').remove();
    
    // Haupttext extrahieren (versucht, den Main-Content zu finden)
    const title = $('title').text().trim();
    const h1 = $('h1').text().trim();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 15000); // Limitieren auf ca. 15k Zeichen für Token-Limit

    // 2. AI Prompt erstellen
    const prompt = `
      Du bist ein Senior SEO-Experte. Führe eine "Content Gap Analyse" für die folgende Webseite durch.

      ZIEL: Optimiere den bestehenden Text basierend auf echten Google-Suchdaten.

      DIE DATEN:
      - Webseite: ${url}
      - Titel (H1/Title): ${title} / ${h1}
      - Top Keywords aus Search Console (Nutzer suchen danach und finden diese Seite): ${keywords.join(', ')}

      DER WEBSITEN-TEXT (Auszug):
      """
      ${bodyText}
      """

      DEINE AUFGABE:
      Analysiere den Text im Vergleich zu den Keywords.
      1. **Fehlende Keywords:** Welche der Top-Keywords kommen im Text gar nicht oder zu selten vor?
      2. **Themen-Lücken:** Welche Aspekte der Suchintention (User Intent) werden im Text nicht abgedeckt?
      3. **Optimierungs-Vorschläge:** Gib 3-5 konkrete Handlungsempfehlungen. Zitiere den bestehenden Satz und zeige, wie man ihn umschreiben sollte, um das Keyword organisch einzubauen.
      4. **Struktur-Check:** Fehlt eine H2/H3 zu einem wichtigen Keyword?

      Formatierung: Nutze Markdown (Fettgedrucktes, Listen, Code-Blöcke für "Vorher/Nachher").
      Antworte direkt und hilfreich auf Deutsch.
    `;

    // 3. AI Stream starten
    const result = streamText({
      model: google('gemini-2.5-flash'), // Oder dein bevorzugtes Modell
      prompt: prompt,
    });

    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error('❌ Content Gap Error:', error);
    return NextResponse.json(
      { message: error.message || 'Fehler bei der Analyse' },
      { status: 500 }
    );
  }
}
