// src/app/api/ai/trend-radar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 60;

// Typen
interface ParsedTrend {
  title: string;
  traffic: string;
  articles: string[];
}

interface ParsedRelatedQuery {
  query: string;
  value: string;
}

// Dynamischer Import für google-trends-api (nur wenn verfügbar)
async function tryFetchDailyTrends(geo: string = 'DE'): Promise<ParsedTrend[] | null> {
  try {
    // Dynamischer Import um Build-Fehler zu vermeiden
    const googleTrends = await import('google-trends-api');
    
    const results = await googleTrends.dailyTrends({
      geo: geo,
    });
    
    // Prüfe ob Antwort HTML ist (Google Block)
    if (typeof results === 'string' && results.trim().startsWith('<!')) {
      console.warn('[Trend Radar] Google Trends returned HTML - blocked or rate-limited');
      return null;
    }
    
    const parsed = JSON.parse(results);
    const trends = parsed.default?.trendingSearchesDays?.[0]?.trendingSearches || [];
    
    return trends.slice(0, 20).map((t: any) => ({
      title: t.title?.query || 'Unbekannt',
      traffic: t.formattedTraffic || 'N/A',
      articles: t.articles?.slice(0, 2).map((a: any) => a.title) || [],
    }));
  } catch (error) {
    console.error('[Trend Radar] Google Trends API Error:', error);
    return null;
  }
}

async function tryFetchRelatedQueries(keyword: string, geo: string = 'DE'): Promise<ParsedRelatedQuery[]> {
  try {
    const googleTrends = await import('google-trends-api');
    
    const results = await googleTrends.relatedQueries({
      keyword: keyword,
      geo: geo,
      hl: 'de',
    });
    
    // Prüfe ob Antwort HTML ist
    if (typeof results === 'string' && results.trim().startsWith('<!')) {
      console.warn('[Trend Radar] Related Queries returned HTML - blocked');
      return [];
    }
    
    const parsed = JSON.parse(results);
    const rising = parsed.default?.rankedList?.[0]?.rankedKeyword || [];
    
    return rising.slice(0, 10).map((k: any) => ({
      query: k.query || 'Unbekannt',
      value: k.formattedValue || 'N/A',
    }));
  } catch (error) {
    console.error('[Trend Radar] Related Queries Error:', error);
    return [];
  }
}

// Fallback: KI generiert Trends basierend auf aktuellem Wissen
function createFallbackPrompt(domain: string, keywords: string[]): string {
  const currentDate = new Date().toLocaleDateString('de-DE', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return `
HINWEIS: Die Google Trends API ist aktuell nicht erreichbar. 
Nutze dein aktuelles Wissen über Trends und saisonale Muster.

AKTUELLES DATUM: ${currentDate}

PROJEKT-KONTEXT:
- Domain: ${domain}
- Bestehende Top-Keywords: ${keywords?.join(', ') || 'Keine Keywords verfügbar'}

AUFGABE:
Da keine Live-Daten verfügbar sind, analysiere basierend auf:
1. Saisonale Trends (was ist typisch für diese Jahreszeit?)
2. Branchenspezifische Entwicklungen
3. Allgemeine digitale Trends
4. Evergreen-Themen mit aktuellem Bezug
  `;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { domain, keywords } = await req.json();

    if (!domain) {
      return NextResponse.json({ message: 'Domain fehlt' }, { status: 400 });
    }

    console.log(`[Trend Radar] Start für Domain: ${domain}`);

    // 1. Versuche Daily Trends abzurufen
    const dailyTrends = await tryFetchDailyTrends('DE');
    const trendsAvailable = dailyTrends && dailyTrends.length > 0;
    
    // 2. Falls Keywords vorhanden und Trends funktionieren, hole Related Queries
    let industryTrends: ParsedRelatedQuery[] = [];
    if (trendsAvailable && keywords && keywords.length > 0) {
      industryTrends = await tryFetchRelatedQueries(keywords[0], 'DE');
      
      if (industryTrends.length === 0 && keywords.length > 1) {
        industryTrends = await tryFetchRelatedQueries(keywords[1], 'DE');
      }
    }

    console.log(`[Trend Radar] Trends verfügbar: ${trendsAvailable}, Industry Trends: ${industryTrends.length}`);

    // 3. Prompt erstellen (mit oder ohne Live-Daten)
    let trendsData: string;
    
    if (trendsAvailable) {
      // Mit echten Daten
      trendsData = `
AKTUELLE DAILY TRENDS (Deutschland, Live-Daten):
${dailyTrends!.map((t, i) => 
  `${i + 1}. "${t.title}" (${t.traffic} Suchanfragen)
     - Aktuelle News: ${t.articles.length > 0 ? t.articles.join(' | ') : 'Keine'}`
).join('\n')}

STEIGENDE SUCHANFRAGEN IN DER BRANCHE:
${industryTrends.length > 0 
  ? industryTrends.map((k) => `- "${k.query}" (${k.value})`).join('\n')
  : 'Keine branchenspezifischen Daten verfügbar.'}

PROJEKT-KONTEXT:
- Domain: ${domain}
- Bestehende Top-Keywords: ${keywords?.join(', ') || 'Keine Keywords übergeben'}
      `;
    } else {
      // Fallback ohne Live-Daten
      trendsData = createFallbackPrompt(domain, keywords || []);
    }

    // 4. System Prompt
    const systemPrompt = `
Du bist ein SEO-Stratege und Trend-Analyst. Deine Aufgabe ist es, Trends zu analysieren und Content-Chancen für eine spezifische Domain zu identifizieren.

${!trendsAvailable ? `
⚠️ WICHTIG: Es sind KEINE Live-Daten von Google Trends verfügbar.
Generiere stattdessen realistische Trend-Empfehlungen basierend auf:
- Deinem Wissen über aktuelle Entwicklungen
- Saisonale Muster für die aktuelle Jahreszeit
- Branchenspezifische Evergreen-Themen
- Allgemeine digitale Trends

Kennzeichne am Anfang kurz, dass dies KI-generierte Schätzungen sind.
` : ''}

REGELN FÜR FORMATIERUNG (STRIKT BEFOLGEN):
1. VERWENDE KEIN MARKDOWN! (Keine **, keine ##, keine * Listen).
2. Nutze IMMER HTML-Tags für Formatierung.
3. Nutze AUSSCHLIESSLICH HTML-Tags mit Tailwind-Klassen.

STYLING VORGABEN:
- Überschriften: <h3 class="font-bold text-indigo-900 mt-6 mb-3 text-lg flex items-center gap-2">TITEL</h3>
- Fließtext: <p class="mb-3 leading-relaxed text-gray-600 text-sm">TEXT</p>
- Hinweis-Box (für Fallback): <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">⚠️ TEXT</div>
- Trend-Karte: 
  <div class="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 mb-3 hover:shadow-md transition-shadow">
    <div class="flex items-center justify-between mb-2">
      <span class="font-bold text-gray-900">TREND_NAME</span>
      <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">TRAFFIC</span>
    </div>
    <p class="text-sm text-gray-600 mb-2">WARUM RELEVANT</p>
    <div class="flex flex-wrap gap-2">
      <span class="bg-white px-2 py-1 rounded text-xs text-indigo-600 border border-indigo-100">Content-Idee 1</span>
      <span class="bg-white px-2 py-1 rounded text-xs text-indigo-600 border border-indigo-100">Content-Idee 2</span>
    </div>
  </div>
- Relevanz-Badge (Hoch): <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">Hohe Relevanz</span>
- Relevanz-Badge (Mittel): <span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold">Mittel</span>
- Empfehlungs-Box: <div class="bg-indigo-600 text-white p-4 rounded-xl my-4 shadow-lg">
- Listen in der Box: <ul class="space-y-2 mt-2 text-sm"><li class="flex items-start gap-2"><span>→</span><span>PUNKT</span></li></ul>
- Nischen-Keyword Karte:
  <div class="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 mb-2">
    <span class="font-medium text-gray-800">KEYWORD</span>
    <span class="text-emerald-600 font-bold text-sm">+WACHSTUM%</span>
  </div>

AUFGABE:
Analysiere die Daten und erstelle einen strukturierten Report.

${!trendsAvailable ? `
0. Zeige zuerst eine Hinweis-Box: "Live-Daten von Google Trends sind aktuell nicht verfügbar. Die folgenden Empfehlungen basieren auf KI-Analysen und saisonalen Mustern."
` : ''}

1. <h3...>📡 Branchen-Erkennung</h3>
   Erkenne die Branche aus der Domain und den Keywords. Erkläre in 1-2 Sätzen.

2. <h3...>🔥 Top 5 Relevante Trends für diese Branche</h3>
   ${trendsAvailable 
     ? 'Filtere aus den Daily Trends die 5 RELEVANTESTEN für diese Branche.' 
     : 'Generiere 5 realistische Trends basierend auf saisonalen Mustern und Branchenwissen.'}
   - Nutze für jeden Trend eine Trend-Karte
   - Bewerte die Relevanz (Hoch/Mittel)
   - Gib 2 konkrete Content-Ideen pro Trend
   - Erkläre WARUM dieser Trend für die Branche relevant ist

3. <h3...>🚀 Steigende Nischen-Keywords</h3>
   ${industryTrends.length > 0 
     ? 'Zeige die Top 5 steigenden Keywords mit der Nischen-Keyword Karte.' 
     : 'Generiere 5 Keywords die in dieser Branche typischerweise steigen, basierend auf saisonalen Mustern.'}

4. <h3...>💡 Sofort-Empfehlung</h3>
   Nutze die Empfehlungs-Box (weißer Text auf indigo Hintergrund).
   Gib EINE klare Handlungsempfehlung:
   "Schreiben Sie JETZT einen Artikel über [X], weil [Y]."
   
   Füge 3 konkrete Schritte hinzu.

Antworte direkt mit HTML. Keine Einleitung, kein Markdown.
    `;

    // 5. Stream starten
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: trendsData,
      temperature: 0.6,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ Trend Radar Error:', error);
    return NextResponse.json(
      { message: errorMessage || 'Fehler bei der Trend-Analyse' },
      { status: 500 }
    );
  }
}
