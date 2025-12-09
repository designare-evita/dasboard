// src/app/api/ai/news-crawler/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { getCompactStyleGuide, STYLES } from '@/lib/ai-styles';

// Wichtig: Wir importieren das Google Search Tool explizit,
// um dynamisch nach Artikeln suchen zu können.

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Ruft die URL ab und gibt den bereinigten Haupttext des Artikels zurück.
 * @param url Die zu scrapende URL.
 * @returns { url: string, title: string, text: string }
 */
async function fetchAndCleanArticle(url: string): Promise<{ url: string, title: string, text: string }> {
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' // Guter Bot-User-Agent
      },
      signal: AbortSignal.timeout(8000)
    });
    
    if (!res.ok) throw new Error(`Status ${res.status}`);
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    
    // Versuch, den Hauptinhalt zu isolieren (häufige Selektoren für Artikel)
    $('script, style, nav, footer, aside, header, iframe, svg, noscript, head, .comments, .sidebar').remove();
    
    // Priorisiert nach Article-Tag, falls vorhanden
    const mainContent = $('article').length > 0 ? $('article') : $('body');
    
    // Text extrahieren, bereinigen und auf max. 8000 Zeichen begrenzen
    const text = mainContent.text().replace(/\s+/g, ' ').trim().slice(0, 8000);
    
    return { url, title, text };
  } catch(e) {
    return { url, title: 'Scraping Fehler', text: `Inhalt konnte nicht geladen werden: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}` };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  const { topic } = await req.json();

  if (!topic) {
    return NextResponse.json({ message: 'Suchbegriff (Topic) ist erforderlich.' }, { status: 400 });
  }

  // 1. Google Search aufrufen, um aktuelle Artikel zu finden
  let searchResults;
  try {
    const googleResponse = await fetch('https://www.googleapis.com/customsearch/v1', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // Hier müsste der tatsächliche API-Call mit Deinem Google Search Tool Key/ID stehen.
        // Da wir das Tool hier nicht direkt ausführen können, simulieren wir die Suche:
    });
    
    // Simulation des Google Search Tool Aufrufs (ersetze dies mit Deinem echten Tool-Call!)
    const searchQueries = [`${topic} News 2025`, `${topic} aktuell`];
    const googleSearchResults = await fetch('google_search.search', {
        queries: searchQueries
    });

    const results = await googleSearchResults.json();
    searchResults = results.result; 

  } catch (error) {
    console.error('❌ Google Search Error:', error);
    // Fallback falls der Google Search Tool Call fehlschlägt
    return NextResponse.json({ message: 'Fehler beim Abrufen der Suchergebnisse.' }, { status: 500 });
  }
  
  // Extrahiere bis zu 3 relevante URLs
  const articleUrls = searchResults?.web_results
                      ?.map((r: any) => r.url)
                      .slice(0, 3) || [];
  
  if (articleUrls.length === 0) {
    return NextResponse.json({ message: 'Keine relevanten Artikel gefunden.' }, { status: 404 });
  }

  // 2. Artikel crawlen und Inhalt extrahieren
  const articlePromises = articleUrls.map((url: string) => fetchAndCleanArticle(url));
  const fetchedArticles = await Promise.all(articlePromises);


  // 3. Prompt für die KI erstellen
  const articleContext = fetchedArticles.map((a, i) => `
══════════════════════════════════════════════════════════════════════════════
ARTIKEL ${i + 1}: ${a.title}
Quelle: ${a.url}
══════════════════════════════════════════════════════════════════════════════
TEXT-AUSZUG:
"${a.text.slice(0, 2000)}..."
`).join('\n');
  
  const newsCrawlerPrompt = `
Du bist ein erfahrener Content-Stratege, spezialisiert auf interne Weiterbildung.
Analysiere die folgenden Artikel zum Thema "${topic}". Dein Ziel ist es, die wichtigsten Informationen für die Agentur und deren Kundenprojekte zu filtern und kompakt aufzubereiten.

${getCompactStyleGuide()}

══════════════════════════════════════════════════════════════════════════════
ANALYSE BASIERT AUF: "${topic}"
${articleContext}
══════════════════════════════════════════════════════════════════════════════

ERSTELLE DIESEN REPORT:
(Achte auf das strikte HTML/Tailwind-Format)

1. <h3 class="${STYLES.h3}"><i class="bi bi-patch-question"></i> Worum geht es?</h3>
   <div class="${STYLES.infoBox}">
     <p class="${STYLES.p}">
       Kurze, neutrale Zusammenfassung der Top-Artikel (maximal 3 Sätze).
     </p>
   </div>

2. <h3 class="${STYLES.h3}"><i class="bi bi-lightbulb"></i> Die 3 wichtigsten Key Takeaways</h3>
   <div class="${STYLES.card}">
     <h4 class="${STYLES.h4}">Erkenntnisse für interne Weiterbildung</h4>
     <ol class="${STYLES.list}">
       <li>[Kompakte Kernaussage aus den Artikeln, 1 Satz]</li>
       <li>[Kompakte Kernaussage aus den Artikeln, 1 Satz]</li>
       <li>[Kompakte Kernaussage aus den Artikeln, 1 Satz]</li>
     </ol>
   </div>

3. <h3 class="${STYLES.h3}"><i class="bi bi-briefcase"></i> Bedeutung für unsere Projekte</h3>
   <div class="${STYLES.fazitPositive}">
     <div class="${STYLES.flexStart}">
       <i class="bi bi-star-fill ${STYLES.textPositive}"></i>
       <div>
         <p class="font-bold text-sm text-emerald-800">Interne Maßnahme</p>
         <p class="${STYLES.pSmall} text-emerald-700">Wie müssen wir unser Vorgehen anpassen oder unsere Kunden informieren? (2-3 Sätze)</p>
       </div>
     </div>
   </div>

4. <h3 class="${STYLES.h3}"><i class="bi bi-link-45deg"></i> Quellen</h3>
   <div class="${STYLES.cardHeaderSmall}">
     ${fetchedArticles.map(a => 
      `<div class="${STYLES.subpageItem} ${STYLES.flexStart}">
         <i class="bi bi-file-earmark-text-fill ${STYLES.iconIndigo}"></i> 
         <span>
           <strong>${a.title.slice(0, 70)}...</strong> 
           <span class="${STYLES.textMuted}">(${new URL(a.url).hostname})</span>
         </span>
       </div>`
    ).join('\n')}
   </div>
   
Antworte NUR mit HTML.
  `;

  // 4. Streamen des Ergebnisses
  try {
    const result = streamText({
      model: google('gemini-2.5-flash'),
      prompt: newsCrawlerPrompt,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();
  } catch (e) {
    console.error('❌ Gemini Streaming Error:', e);
    return NextResponse.json({ message: 'Fehler beim Generieren des KI-Reports.' }, { status: 500 });
  }
}
