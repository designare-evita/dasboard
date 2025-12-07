// src/app/api/ai/trend-radar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import googleTrends from 'google-trends-api';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 60;

// Hilfsfunktion: Trends abrufen
async function fetchTrendingSearches(geo: string = 'DE') {
  try {
    const results = await googleTrends.dailyTrends({
      geo: geo,
    });
    
    const parsed = JSON.parse(results);
    const trends = parsed.default.trendingSearchesDays[0]?.trendingSearches || [];
    
    return trends.slice(0, 20).map((t: any) => ({
      title: t.title.query,
      traffic: t.formattedTraffic,
      articles: t.articles?.slice(0, 2).map((a: any) => a.title) || [],
    }));
  } catch (error) {
    console.error('Google Trends Error:', error);
    return null;
  }
}

// Hilfsfunktion: Related Queries für Branche
async function fetchRelatedQueries(keyword: string, geo: string = 'DE') {
  try {
    const results = await googleTrends.relatedQueries({
      keyword: keyword,
      geo: geo,
      hl: 'de',
    });
    
    const parsed = JSON.parse(results);
    const rising = parsed.default.rankedList[0]?.rankedKeyword || [];
    
    return rising.slice(0, 10).map((k: any) => ({
      query: k.query,
      value: k.formattedValue, // z.B. "+2,400%"
    }));
  } catch (error) {
    console.error('Related Queries Error:', error);
    return [];
  }
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

    // 1. Aktuelle Trends abrufen
    const dailyTrends = await fetchTrendingSearches('DE');
    
    // 2. Falls Keywords vorhanden, branchenspezifische Trends holen
    let industryTrends: any[] = [];
    if (keywords && keywords.length > 0) {
      // Nimm das stärkste Keyword für Related Queries
      const topKeyword = keywords[0];
      industryTrends = await fetchRelatedQueries(topKeyword, 'DE');
    }

    // 3. Daten für Prompt aufbereiten
    const trendsData = `
AKTUELLE DAILY TRENDS (Deutschland):
${dailyTrends ? dailyTrends.map((t: any, i: number) => 
  `${i + 1}. "${t.title}" (${t.traffic} Suchanfragen)
     - News: ${t.articles.join(' | ') || 'Keine'}`
).join('\n') : 'Keine Trends verfügbar'}

STEIGENDE SUCHANFRAGEN IN DER BRANCHE:
${industryTrends.length > 0 
  ? industryTrends.map((k: any) => `- "${k.query}" (${k.value})`).join('\n')
  : 'Keine branchenspezifischen Daten'}

PROJEKT-KONTEXT:
- Domain: ${domain}
- Bestehende Keywords: ${keywords?.join(', ') || 'Keine'}
    `;

    // 4. Gemini Prompt
    const systemPrompt = `
Du bist ein SEO-Stratege und Trend-Analyst. Analysiere die aktuellen Google Trends und identifiziere Content-Chancen.

REGELN FÜR FORMATIERUNG (STRIKT BEFOLGEN):
1. VERWENDE KEIN MARKDOWN.
2. Nutze AUSSCHLIESSLICH HTML-Tags mit Tailwind-Klassen.

STYLING VORGABEN:
- Überschriften: <h3 class="font-bold text-indigo-900 mt-6 mb-3 text-lg flex items-center gap-2">TITEL</h3>
- Fließtext: <p class="mb-3 leading-relaxed text-gray-600 text-sm">TEXT</p>
- Trend-Karte: 
  <div class="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 mb-3 hover:shadow-md transition-shadow">
    <div class="flex items-center justify-between mb-2">
      <span class="font-bold text-gray-900">TREND_NAME</span>
      <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">+TRAFFIC%</span>
    </div>
    <p class="text-sm text-gray-600">BESCHREIBUNG</p>
    <div class="mt-2 flex gap-2">
      <span class="bg-white px-2 py-1 rounded text-xs text-indigo-600 border border-indigo-100">Content-Idee</span>
    </div>
  </div>
- Relevanz-Badge (Hoch): <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">Hohe Relevanz</span>
- Relevanz-Badge (Mittel): <span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold">Mittel</span>
- Relevanz-Badge (Niedrig): <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">Gering</span>
- Empfehlungs-Box: <div class="bg-indigo-600 text-white p-4 rounded-xl my-4 shadow-lg">

AUFGABE:
1. <h3...>📡 Branchen-Erkennung</h3>
   Erkenne die Branche aus Domain + Keywords. Erkläre kurz (1 Satz).

2. <h3...>🔥 Top 5 Relevante Trends</h3>
   Filtere aus den Trends die 5 RELEVANTESTEN für diese Branche.
   Nutze die Trend-Karte für jeden. Bewerte Relevanz (Hoch/Mittel/Gering).
   Gib eine konkrete Content-Idee pro Trend.

3. <h3...>🚀 Steigende Nischen-Keywords</h3>
   Falls branchenspezifische Daten vorhanden, zeige die Top 5 steigenden Keywords.
   Erkläre, warum sie relevant sind.

4. <h3...>💡 Sofort-Empfehlung</h3>
   Nutze die Empfehlungs-Box. Gib EINE klare Handlungsempfehlung:
   "Schreiben Sie JETZT einen Artikel über [X], weil [Y]."

Antworte direkt mit HTML. Keine Einleitung.
    `;

    // 5. Stream starten
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: trendsData,
      temperature: 0.5,
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('❌ Trend Radar Error:', error);
    return NextResponse.json(
      { message: error.message || 'Fehler bei der Trend-Analyse' },
      { status: 500 }
    );
  }
}
