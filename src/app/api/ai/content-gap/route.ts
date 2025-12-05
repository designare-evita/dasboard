import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // Längere Laufzeit für Scraping + AI erlauben

export async function POST(req: NextRequest) {
  try {
    const { url, keywords } = await req.json(); // 'domain' wird hier nicht zwingend gebraucht

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
        // User-Agent, um nicht sofort geblockt zu werden
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    });

    if (!pageRes.ok) {
      throw new Error(`Konnte URL nicht abrufen: ${pageRes.statusText}`);
    }

    const html = await pageRes.text();
    const $ = cheerio.load(html);

    // Unnötige Elemente entfernen
    $('script, style, nav, footer, iframe, svg, noscript').remove();
    
    // Haupttext extrahieren
    const title = $('title').text().trim();
    const h1 = $('h1').text().trim();
    // Text bereinigen und limitieren (Token sparen)
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 15000); 

    // 2. AI Prompt erstellen
    const prompt = `
      Du bist ein Senior SEO-Experte. Führe eine "Content Gap Analyse" für die folgende Webseite durch.

      ZIEL: Optimiere den bestehenden Text basierend auf echten Google-Suchdaten.

      DIE DATEN:
      - Webseite: ${url}
      - Titel (H1/Title): ${title} / ${h1}
      - Top Keywords aus Search Console: ${keywords.join(', ')}

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
      model: google('gemini-2.5-flash'), // 'gemini-1.5-pro' ist meist die sicherere ID als 'latest'
      prompt: prompt,
    });

    // FIX: Verwende toTextStreamResponse() statt toDataStreamResponse()
    // Das behebt den TypeScript Fehler und passt zu deinem Frontend-Code.
    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('❌ Content Gap Error:', error);
    return NextResponse.json(
      { message: error.message || 'Fehler bei der Analyse' },
      { status: 500 }
    );
  }
}
