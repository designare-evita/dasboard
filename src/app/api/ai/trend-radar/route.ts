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

// RapidAPI Config
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'google-keyword-insight1.p.rapidapi.com';
const BASE_URL = 'https://google-keyword-insight1.p.rapidapi.com';

// Typen für RapidAPI Response
interface KeywordData {
  keyword: string;
  search_volume: number;
  competition: string;
  competition_index: number;
  low_bid: number;
  high_bid: number;
  trend: number[];
  intent?: string;
}

// Hilfsfunktion: Trend aus Array berechnen (steigend/fallend/stabil)
function analyzeTrend(trendArray: number[]): { direction: string; percentage: number } {
  if (!trendArray || trendArray.length < 2) {
    return { direction: 'stabil', percentage: 0 };
  }
  
  // Vergleiche letzte 3 Monate mit vorherigen 3 Monaten
  const recentMonths = trendArray.slice(-3);
  const previousMonths = trendArray.slice(-6, -3);
  
  const recentAvg = recentMonths.reduce((a, b) => a + b, 0) / recentMonths.length;
  const previousAvg = previousMonths.length > 0 
    ? previousMonths.reduce((a, b) => a + b, 0) / previousMonths.length 
    : recentAvg;
  
  if (previousAvg === 0) return { direction: 'neu', percentage: 100 };
  
  const change = ((recentAvg - previousAvg) / previousAvg) * 100;
  
  if (change > 20) return { direction: 'steigend', percentage: Math.round(change) };
  if (change < -20) return { direction: 'fallend', percentage: Math.round(change) };
  return { direction: 'stabil', percentage: Math.round(change) };
}

// Keyword Suggestions für ein Hauptkeyword abrufen
async function fetchKeywordSuggestions(
  keyword: string, 
  location: string = 'AT', 
  lang: string = 'de'
): Promise<KeywordData[]> {
  try {
    const url = `${BASE_URL}/keysuggest/?keyword=${encodeURIComponent(keyword)}&location=${location}&lang=${lang}&return_intent=true`;
    
    console.log(`[Trend Radar] Fetching: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    if (!response.ok) {
      console.error(`[Trend Radar] RapidAPI Error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    // API gibt Array direkt zurück oder als { keywords: [...] }
    const keywords = Array.isArray(data) ? data : (data.keywords || []);
    
    console.log(`[Trend Radar] Received ${keywords.length} keywords for "${keyword}"`);
    
    return keywords;
  } catch (error) {
    console.error('[Trend Radar] Fetch Error:', error);
    return [];
  }
}

// Top Keywords (Opportunity Keywords) abrufen
async function fetchTopKeywords(
  keyword: string,
  location: string = 'AT',
  lang: string = 'de',
  num: number = 15
): Promise<KeywordData[]> {
  try {
    const url = `${BASE_URL}/topkeys/?keyword=${encodeURIComponent(keyword)}&location=${location}&lang=${lang}&num=${num}`;
    
    console.log(`[Trend Radar] Fetching Top Keywords: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    if (!response.ok) {
      console.error(`[Trend Radar] TopKeys Error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const keywords = Array.isArray(data) ? data : (data.keywords || []);
    
    console.log(`[Trend Radar] Received ${keywords.length} top keywords`);
    
    return keywords;
  } catch (error) {
    console.error('[Trend Radar] TopKeys Fetch Error:', error);
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

    // Prüfe ob API Key vorhanden
    if (!RAPIDAPI_KEY) {
      console.error('[Trend Radar] RAPIDAPI_KEY nicht konfiguriert!');
      return NextResponse.json({ message: 'API nicht konfiguriert' }, { status: 500 });
    }

    console.log(`[Trend Radar] Start für Domain: ${domain}`);

    // Bestimme Suchbegriff aus Domain oder Keywords
    let searchTerm = '';
    if (keywords && keywords.length > 0) {
      // Nutze erstes Keyword
      searchTerm = keywords[0];
    } else {
      // Extrahiere Branche aus Domain
      const domainParts = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('.')[0];
      searchTerm = domainParts;
    }

    console.log(`[Trend Radar] Suchbegriff: ${searchTerm}`);

    // 1. Keyword Suggestions abrufen
    const suggestions = await fetchKeywordSuggestions(searchTerm, 'AT', 'de');
    
    // 2. Top/Opportunity Keywords abrufen
    const topKeywords = await fetchTopKeywords(searchTerm, 'AT', 'de', 10);
    
    // 3. Daten aufbereiten
    const hasData = suggestions.length > 0 || topKeywords.length > 0;

    // Steigende Keywords identifizieren (basierend auf Trend-Array)
    const risingKeywords = suggestions
      .filter(kw => {
        const trend = analyzeTrend(kw.trend);
        return trend.direction === 'steigend' || trend.direction === 'neu';
      })
      .sort((a, b) => b.search_volume - a.search_volume)
      .slice(0, 10);

    // High-Volume Keywords
    const highVolumeKeywords = [...suggestions]
      .sort((a, b) => b.search_volume - a.search_volume)
      .slice(0, 10);

    // Prompt-Daten erstellen
    const trendsData = hasData ? `
KEYWORD RECHERCHE ERGEBNISSE (Live-Daten via RapidAPI):

🔥 STEIGENDE KEYWORDS (Trend nach oben):
${risingKeywords.length > 0 
  ? risingKeywords.map(kw => {
      const trend = analyzeTrend(kw.trend);
      return `- "${kw.keyword}" | Suchvolumen: ${kw.search_volume.toLocaleString('de-DE')}/Monat | Trend: ${trend.direction} (${trend.percentage > 0 ? '+' : ''}${trend.percentage}%) | Wettbewerb: ${kw.competition} | Intent: ${kw.intent || 'N/A'}`;
    }).join('\n')
  : 'Keine steigenden Keywords identifiziert.'}

📊 TOP KEYWORDS NACH SUCHVOLUMEN:
${highVolumeKeywords.length > 0
  ? highVolumeKeywords.map(kw => {
      const trend = analyzeTrend(kw.trend);
      return `- "${kw.keyword}" | ${kw.search_volume.toLocaleString('de-DE')}/Monat | Wettbewerb: ${kw.competition} (${kw.competition_index}/100) | CPC: €${kw.low_bid.toFixed(2)}-${kw.high_bid.toFixed(2)}`;
    }).join('\n')
  : 'Keine Daten.'}

🎯 OPPORTUNITY KEYWORDS (Hohes Potenzial):
${topKeywords.length > 0
  ? topKeywords.map(kw => {
      return `- "${kw.keyword}" | Suchvolumen: ${kw.search_volume.toLocaleString('de-DE')}/Monat | Wettbewerb: ${kw.competition}`;
    }).join('\n')
  : 'Keine Opportunity Keywords gefunden.'}

PROJEKT-KONTEXT:
- Domain: ${domain}
- Analysierter Suchbegriff: ${searchTerm}
- Weitere Keywords: ${keywords?.slice(1).join(', ') || 'Keine'}
` : `
HINWEIS: Keine Daten von der Keyword API erhalten.
Analysiere basierend auf Domain und verfügbarem Kontext.

PROJEKT-KONTEXT:
- Domain: ${domain}
- Keywords: ${keywords?.join(', ') || 'Keine'}
`;

    // System Prompt
    const systemPrompt = `
Du bist ein SEO-Stratege und Trend-Analyst. Deine Aufgabe ist es, Keyword-Daten zu analysieren und Content-Chancen zu identifizieren.

REGELN FÜR FORMATIERUNG (STRIKT BEFOLGEN):
1. VERWENDE KEIN MARKDOWN! (Keine **, keine ##, keine * Listen).
2. Nutze IMMER HTML-Tags für Formatierung.
3. Nutze AUSSCHLIESSLICH HTML-Tags mit Tailwind-Klassen.

STYLING VORGABEN:
- Überschriften: <h3 class="font-bold text-indigo-900 mt-6 mb-3 text-lg flex items-center gap-2">TITEL</h3>
- Fließtext: <p class="mb-3 leading-relaxed text-gray-600 text-sm">TEXT</p>
- Erfolgs-Badge: <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">Live-Daten ✓</span>
- Trend-Karte: 
  <div class="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 mb-3 hover:shadow-md transition-shadow">
    <div class="flex items-center justify-between mb-2">
      <span class="font-bold text-gray-900">KEYWORD</span>
      <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">SUCHVOLUMEN</span>
    </div>
    <p class="text-sm text-gray-600 mb-2">WARUM RELEVANT + CONTENT EMPFEHLUNG</p>
    <div class="flex flex-wrap gap-2">
      <span class="bg-white px-2 py-1 rounded text-xs text-indigo-600 border border-indigo-100">Content-Idee</span>
    </div>
  </div>
- Opportunity-Karte (für Low Competition):
  <div class="flex items-center justify-between bg-emerald-50 p-3 rounded-lg border border-emerald-100 mb-2">
    <div>
      <span class="font-medium text-gray-800">KEYWORD</span>
      <span class="text-xs text-gray-500 ml-2">Wettbewerb: NIEDRIG</span>
    </div>
    <span class="text-emerald-600 font-bold text-sm">VOLUMEN/Monat</span>
  </div>
- Empfehlungs-Box: <div class="bg-indigo-600 text-white p-4 rounded-xl my-4 shadow-lg">
- Listen in der Box: <ul class="space-y-2 mt-2 text-sm"><li class="flex items-start gap-2"><span>→</span><span>PUNKT</span></li></ul>
- Statistik-Grid:
  <div class="grid grid-cols-3 gap-3 my-4">
    <div class="bg-white p-3 rounded-lg border border-gray-100 text-center">
      <div class="text-2xl font-bold text-indigo-600">ZAHL</div>
      <div class="text-xs text-gray-500">LABEL</div>
    </div>
  </div>

AUFGABE:
Analysiere die Keyword-Daten und erstelle einen actionable Report.

${hasData ? `
1. <h3...>📡 Datenübersicht</h3>
   Zeige ein Statistik-Grid mit:
   - Anzahl analysierter Keywords
   - Durchschnittliches Suchvolumen
   - Keywords mit steigendem Trend
   Füge das Erfolgs-Badge "Live-Daten ✓" hinzu.
` : `
1. <h3...>📡 Branchen-Analyse</h3>
   Erkenne die Branche aus Domain und Keywords. Gib allgemeine Empfehlungen.
`}

2. <h3...>🔥 Top 5 Content-Chancen</h3>
   Wähle die 5 besten Keywords für neuen Content.
   Kriterien: Hohes Suchvolumen + steigender Trend + machbarer Wettbewerb
   Nutze die Trend-Karte für jedes Keyword.
   - Zeige Suchvolumen als Badge
   - Erkläre WARUM dieses Keyword Potenzial hat
   - Gib eine konkrete Content-Idee (Blogpost-Titel, Landingpage, FAQ...)

3. <h3...>🎯 Quick Wins (Low Competition)</h3>
   Identifiziere 3-5 Keywords mit niedrigem Wettbewerb aber gutem Volumen.
   Nutze die Opportunity-Karte.
   Das sind Keywords, für die schnell gerankt werden kann.

4. <h3...>📈 Trend-Analyse</h3>
   Welche Themen/Keywords steigen gerade?
   Erkläre die Muster und was sie für die Content-Strategie bedeuten.

5. <h3...>💡 Sofort-Empfehlung</h3>
   Nutze die Empfehlungs-Box (weißer Text auf indigo Hintergrund).
   
   Struktur:
   - Haupt-Empfehlung: "Erstellen Sie JETZT Content für [Keyword], weil [Grund]."
   - 3 konkrete nächste Schritte
   - Priorisierung: Was zuerst?

Antworte direkt mit HTML. Keine Einleitung, kein Markdown.
`;

    // Stream starten
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: trendsData,
      temperature: 0.5,
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
