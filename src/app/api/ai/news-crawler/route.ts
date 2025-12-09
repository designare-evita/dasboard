// src/app/api/ai/news-crawler/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { getCompactStyleGuide, STYLES } from '@/lib/ai-styles';

// --- Environment Variablen (Für Google Custom Search API) ---
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_CX_ID = process.env.GOOGLE_SEARCH_CX_ID;
// -----------------------------------------------------------

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
        // Verwendung eines User-Agents, der das Crawling klar identifiziert
        'User-Agent': 'Mozilla/5.0 (compatible; DesignareEvitaNewsCrawler/1.0; +https://yourdomain.com)' 
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
  try {
    const { topic } = await req.json();

    if (!topic) {
      return NextResponse.json({ message: 'Suchbegriff (Topic) ist erforderlich.' }, { status: 400 });
    }
    
    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX_ID) {
      console.error("GOOGLE_SEARCH_API_KEY oder CX_ID fehlt!");
      return NextResponse.json({ 
        message: 'Fehler: API-Schlüssel für Google Search (GOOGLE_SEARCH_API_KEY oder CX_ID) fehlen in den Environment-Variablen.' 
      }, { status: 500 });
    }

    // 1. Google Search API Call, um aktuelle Artikel zu finden
    let searchResults: { items?: { link: string, title: string }[] } = {};
    const searchQuery = `${topic} News`; 
    
    // API-URL zusammenbauen (Standardformat für Google Custom Search JSON API)
    const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX_ID}&q=${encodeURIComponent(searchQuery)}`;

    try {
      const googleResponse = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!googleResponse.ok) {
        throw new Error(`Google API Status ${googleResponse.status}`);
      }

      searchResults = await googleResponse.json();
      
    } catch (error) {
      console.error('❌ Google Search API Fetch Error:', error);
      return NextResponse.json({ message: `Fehler beim Abrufen der Suchergebnisse: ${error instanceof Error ? error.message : 'API-Problem'}` }, { status: 500 });
    }
    
    // Extrahiere bis zu 3 relevante URLs (aus dem 'items' Array der GCS API Antwort)
    const articleUrls = searchResults.items
                        ?.map((item: any) => item.link) 
                        .slice(0, 3) || [];
    
    if (articleUrls.length === 0) {
      return NextResponse.json({ message: `Keine relevanten Artikel zu "${topic}" gefunden.` }, { status: 404 });
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ News Crawler Server Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
