// src/app/api/ai/trend-radar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import crypto from 'node:crypto';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 60;

// RapidAPI Config
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'google-keyword-insight1.p.rapidapi.com';
const BASE_URL = 'https://google-keyword-insight1.p.rapidapi.com';

// Cache-Dauer: 24 Stunden
const CACHE_DURATION_HOURS = 24;

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

// Hash für Cache-Key
function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Trend aus Array berechnen
function analyzeTrend(trendArray: number[] | undefined | null): { direction: string; percentage: number } {
  // Sicherheitsprüfung
  if (!trendArray || !Array.isArray(trendArray) || trendArray.length < 2) {
    return { direction: 'stabil', percentage: 0 };
  }
  
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

// ============================================
// CACHE FUNKTIONEN
// ============================================

async function getCachedKeywords(cacheKey: string): Promise<KeywordData[] | null> {
  try {
    const { rows } = await sql`
      SELECT data 
      FROM trend_radar_cache
      WHERE cache_key = ${cacheKey}
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    
    if (rows.length > 0 && rows[0].data) {
      console.log(`[Trend Radar] ✅ Cache HIT`);
      const data = rows[0].data;
      // Falls data ein String ist, parsen
      return typeof data === 'string' ? JSON.parse(data) : data;
    }
    
    console.log(`[Trend Radar] ❌ Cache MISS`);
    return null;
  } catch (error) {
    console.log('[Trend Radar] Cache-Fehler (Tabelle existiert evtl. nicht):', error);
    return null;
  }
}

async function setCachedKeywords(cacheKey: string, data: KeywordData[]): Promise<void> {
  try {
    const jsonData = JSON.stringify(data);
    
    await sql`
      INSERT INTO trend_radar_cache (cache_key, data, created_at)
      VALUES (${cacheKey}, ${jsonData}::jsonb, NOW())
      ON CONFLICT (cache_key) 
      DO UPDATE SET data = ${jsonData}::jsonb, created_at = NOW()
    `;
    
    console.log(`[Trend Radar] 💾 Cache gespeichert`);
  } catch (error) {
    console.error('[Trend Radar] Cache speichern fehlgeschlagen:', error);
  }
}

// ============================================
// API FUNKTIONEN
// ============================================

async function fetchKeywordSuggestions(
  keyword: string, 
  location: string = 'AT', 
  lang: string = 'de'
): Promise<KeywordData[]> {
  const cacheKey = createHash(`suggestions:${keyword}:${location}:${lang}`);
  
  // 1. Cache prüfen
  const cached = await getCachedKeywords(cacheKey);
  if (cached && Array.isArray(cached)) return cached;

  // 2. API aufrufen
  try {
    const url = `${BASE_URL}/keysuggest/?keyword=${encodeURIComponent(keyword)}&location=${location}&lang=${lang}&return_intent=true`;
    
    console.log(`[Trend Radar] 🌐 API Call: keysuggest für "${keyword}"`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Trend Radar] RapidAPI Error: ${response.status}`, errorText);
      return [];
    }

    const data = await response.json();
    
    console.log(`[Trend Radar] Raw Response Type:`, typeof data, Array.isArray(data));
    
    // Verschiedene Response-Formate handhaben
    let keywords: KeywordData[] = [];
    
    if (Array.isArray(data)) {
      keywords = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.keywords)) {
        keywords = data.keywords;
      } else if (Array.isArray(data.data)) {
        keywords = data.data;
      } else if (Array.isArray(data.results)) {
        keywords = data.results;
      }
    }
    
    // Sicherstellen dass jedes Keyword die erwartete Struktur hat
    keywords = keywords.map(kw => ({
      keyword: kw.keyword || kw.term || kw.query || 'Unbekannt',
      search_volume: Number(kw.search_volume) || Number(kw.volume) || 0,
      competition: kw.competition || 'unknown',
      competition_index: Number(kw.competition_index) || 0,
      low_bid: Number(kw.low_bid) || 0,
      high_bid: Number(kw.high_bid) || 0,
      trend: Array.isArray(kw.trend) ? kw.trend : [],
      intent: kw.intent || undefined,
    }));
    
    console.log(`[Trend Radar] ✅ ${keywords.length} Keywords erhalten`);
    
    // 3. In Cache speichern
    if (keywords.length > 0) {
      await setCachedKeywords(cacheKey, keywords);
    }
    
    return keywords;
  } catch (error) {
    console.error('[Trend Radar] Fetch Error:', error);
    return [];
  }
}

async function fetchTopKeywords(
  keyword: string,
  location: string = 'AT',
  lang: string = 'de',
  num: number = 15
): Promise<KeywordData[]> {
  const cacheKey = createHash(`topkeys:${keyword}:${location}:${lang}:${num}`);
  
  // 1. Cache prüfen
  const cached = await getCachedKeywords(cacheKey);
  if (cached && Array.isArray(cached)) return cached;

  // 2. API aufrufen
  try {
    const url = `${BASE_URL}/topkeys/?keyword=${encodeURIComponent(keyword)}&location=${location}&lang=${lang}&num=${num}`;
    
    console.log(`[Trend Radar] 🌐 API Call: topkeys für "${keyword}"`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Trend Radar] TopKeys Error: ${response.status}`, errorText);
      return [];
    }

    const data = await response.json();
    
    // Verschiedene Response-Formate handhaben
    let keywords: KeywordData[] = [];
    
    if (Array.isArray(data)) {
      keywords = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.keywords)) {
        keywords = data.keywords;
      } else if (Array.isArray(data.data)) {
        keywords = data.data;
      } else if (Array.isArray(data.results)) {
        keywords = data.results;
      }
    }
    
    // Struktur normalisieren
    keywords = keywords.map(kw => ({
      keyword: kw.keyword || kw.term || kw.query || 'Unbekannt',
      search_volume: Number(kw.search_volume) || Number(kw.volume) || 0,
      competition: kw.competition || 'unknown',
      competition_index: Number(kw.competition_index) || 0,
      low_bid: Number(kw.low_bid) || 0,
      high_bid: Number(kw.high_bid) || 0,
      trend: Array.isArray(kw.trend) ? kw.trend : [],
      intent: kw.intent || undefined,
    }));
    
    console.log(`[Trend Radar] ✅ ${keywords.length} Top-Keywords erhalten`);
    
    // 3. In Cache speichern
    if (keywords.length > 0) {
      await setCachedKeywords(cacheKey, keywords);
    }
    
    return keywords;
  } catch (error) {
    console.error('[Trend Radar] TopKeys Fetch Error:', error);
    return [];
  }
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await req.json();
    const { domain, keywords: inputKeywords } = body;

    if (!domain) {
      return NextResponse.json({ message: 'Domain fehlt' }, { status: 400 });
    }

    if (!RAPIDAPI_KEY) {
      console.error('[Trend Radar] RAPIDAPI_KEY nicht konfiguriert!');
      return NextResponse.json({ message: 'API nicht konfiguriert' }, { status: 500 });
    }

    console.log(`[Trend Radar] Start für Domain: ${domain}`);
    console.log(`[Trend Radar] Input Keywords:`, inputKeywords);

    // Sicherstellen dass keywords ein Array ist
    const keywords = Array.isArray(inputKeywords) ? inputKeywords : [];

    // Suchbegriff bestimmen
    let searchTerm = '';
    if (keywords.length > 0 && typeof keywords[0] === 'string') {
      searchTerm = keywords[0];
    } else {
      // Extrahiere aus Domain
      const domainClean = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('.')[0];
      searchTerm = domainClean;
    }

    console.log(`[Trend Radar] Suchbegriff: ${searchTerm}`);

    // Daten abrufen
    const suggestions = await fetchKeywordSuggestions(searchTerm, 'AT', 'de');
    const topKeywords = await fetchTopKeywords(searchTerm, 'AT', 'de', 10);
    
    const hasData = suggestions.length > 0 || topKeywords.length > 0;

    console.log(`[Trend Radar] Suggestions: ${suggestions.length}, TopKeys: ${topKeywords.length}`);

    // Steigende Keywords (mit Sicherheitsprüfung)
    const risingKeywords = suggestions
      .filter(kw => {
        if (!kw || !kw.trend) return false;
        const trend = analyzeTrend(kw.trend);
        return trend.direction === 'steigend' || trend.direction === 'neu';
      })
      .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
      .slice(0, 10);

    // High-Volume Keywords
    const highVolumeKeywords = [...suggestions]
      .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
      .slice(0, 10);

    // Prompt-Daten
    const trendsData = hasData ? `
KEYWORD RECHERCHE ERGEBNISSE (Live-Daten via RapidAPI):

🔥 STEIGENDE KEYWORDS (Trend nach oben):
${risingKeywords.length > 0 
  ? risingKeywords.map(kw => {
      const trend = analyzeTrend(kw.trend);
      return `- "${kw.keyword}" | Suchvolumen: ${(kw.search_volume || 0).toLocaleString('de-DE')}/Monat | Trend: ${trend.direction} (${trend.percentage > 0 ? '+' : ''}${trend.percentage}%) | Wettbewerb: ${kw.competition || 'N/A'} | Intent: ${kw.intent || 'N/A'}`;
    }).join('\n')
  : 'Keine steigenden Keywords identifiziert.'}

📊 TOP KEYWORDS NACH SUCHVOLUMEN:
${highVolumeKeywords.length > 0
  ? highVolumeKeywords.map(kw => {
      return `- "${kw.keyword}" | ${(kw.search_volume || 0).toLocaleString('de-DE')}/Monat | Wettbewerb: ${kw.competition || 'N/A'} (${kw.competition_index || 0}/100) | CPC: €${(kw.low_bid || 0).toFixed(2)}-${(kw.high_bid || 0).toFixed(2)}`;
    }).join('\n')
  : 'Keine Daten.'}

🎯 OPPORTUNITY KEYWORDS (Hohes Potenzial):
${topKeywords.length > 0
  ? topKeywords.map(kw => {
      return `- "${kw.keyword}" | Suchvolumen: ${(kw.search_volume || 0).toLocaleString('de-DE')}/Monat | Wettbewerb: ${kw.competition || 'N/A'}`;
    }).join('\n')
  : 'Keine Opportunity Keywords gefunden.'}

PROJEKT-KONTEXT:
- Domain: ${domain}
- Analysierter Suchbegriff: ${searchTerm}
- Weitere Keywords: ${keywords.slice(1).join(', ') || 'Keine'}
` : `
HINWEIS: Keine Daten von der Keyword API erhalten.

PROJEKT-KONTEXT:
- Domain: ${domain}
- Suchbegriff: ${searchTerm}
- Keywords: ${keywords.join(', ') || 'Keine'}

Bitte generiere Empfehlungen basierend auf der Domain und allgemeinem SEO-Wissen.
`;

    // System Prompt
    const systemPrompt = `
Du bist ein SEO-Stratege und Trend-Analyst. Analysiere Keyword-Daten und identifiziere Content-Chancen.

REGELN FÜR FORMATIERUNG (STRIKT BEFOLGEN):
1. VERWENDE KEIN MARKDOWN! (Keine **, keine ##, keine * Listen).
2. Nutze AUSSCHLIESSLICH HTML-Tags mit Tailwind-Klassen.

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
- Opportunity-Karte:
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

${hasData ? `
1. <h3...>📡 Datenübersicht</h3>
   Statistik-Grid mit: Anzahl Keywords, Durchschnittliches Suchvolumen, Steigende Keywords.
   Füge "Live-Daten ✓" Badge hinzu.
` : `
1. <h3...>📡 Analyse</h3>
   Erkläre kurz die Situation und gib allgemeine Empfehlungen für die Domain.
`}

2. <h3...>🔥 Top 5 Content-Chancen</h3>
   Wähle die 5 besten Keywords. Nutze Trend-Karten.
   - Suchvolumen als Badge
   - Warum hat es Potenzial?
   - Konkrete Content-Idee

3. <h3...>🎯 Quick Wins (Low Competition)</h3>
   3-5 Keywords mit niedrigem Wettbewerb. Nutze Opportunity-Karten.

4. <h3...>📈 Trend-Analyse</h3>
   Welche Themen steigen? Was bedeutet das für die Strategie?

5. <h3...>💡 Sofort-Empfehlung</h3>
   Empfehlungs-Box mit:
   - "Erstellen Sie JETZT Content für [X], weil [Y]."
   - 3 konkrete nächste Schritte

Antworte direkt mit HTML.
`;

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
