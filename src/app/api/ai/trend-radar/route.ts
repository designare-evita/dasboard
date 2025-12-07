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

// Länder-Labels für den Prompt
const COUNTRY_LABELS: Record<string, string> = {
  'AT': 'Österreich',
  'DE': 'Deutschland', 
  'CH': 'Schweiz',
  'US': 'USA',
};

// Typen
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

// Trend berechnen
function analyzeTrend(trendArray: number[] | undefined | null): { direction: string; percentage: number } {
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

// Raw Data normalisieren
function normalizeKeyword(raw: Record<string, unknown>): KeywordData {
  const keywordValue = 
    raw.keyword || raw.text || raw.term || raw.query || raw.key || raw.name || raw.phrase || 'Unbekannt';

  const volumeValue = raw.search_volume || raw.searchVolume || raw.volume || raw.avg_monthly_searches || 0;

  return {
    keyword: String(keywordValue),
    search_volume: Number(volumeValue) || 0,
    competition: String(raw.competition || raw.comp || 'unknown'),
    competition_index: Number(raw.competition_index || raw.competitionIndex || 0),
    low_bid: Number(raw.low_bid || raw.lowBid || raw.cpc_low || 0),
    high_bid: Number(raw.high_bid || raw.highBid || raw.cpc_high || raw.cpc || 0),
    trend: Array.isArray(raw.trend) ? raw.trend : [],
    intent: raw.intent ? String(raw.intent) : undefined,
  };
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
      return typeof data === 'string' ? JSON.parse(data) : data;
    }
    return null;
  } catch {
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
  } catch {
    // Ignore cache errors
  }
}

// ============================================
// API FUNKTIONEN
// ============================================

async function fetchKeywordSuggestions(
  topic: string, 
  location: string,
  lang: string
): Promise<KeywordData[]> {
  const cacheKey = createHash(`suggestions:${topic}:${location}:${lang}:v3`);
  
  const cached = await getCachedKeywords(cacheKey);
  if (cached && cached.length > 0 && cached[0].keyword !== 'Unbekannt') {
    return cached;
  }

  try {
    const url = `${BASE_URL}/keysuggest/?keyword=${encodeURIComponent(topic)}&location=${location}&lang=${lang}&return_intent=true`;
    
    console.log(`[Trend Radar] 🌐 API: keysuggest "${topic}" (${location}/${lang})`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    if (!response.ok) {
      console.error(`[Trend Radar] API Error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    let rawKeywords: Record<string, unknown>[] = [];
    if (Array.isArray(data)) {
      rawKeywords = data;
    } else if (data && typeof data === 'object') {
      const keys = ['keywords', 'data', 'results', 'items', 'suggestions'];
      for (const key of keys) {
        if (Array.isArray(data[key])) {
          rawKeywords = data[key];
          break;
        }
      }
    }
    
    const keywords = rawKeywords
      .map(normalizeKeyword)
      .filter(kw => kw.keyword !== 'Unbekannt' && kw.keyword.length > 0);
    
    console.log(`[Trend Radar] ✅ ${keywords.length} Keywords`);
    
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
  topic: string,
  location: string,
  lang: string,
  num: number = 20
): Promise<KeywordData[]> {
  const cacheKey = createHash(`topkeys:${topic}:${location}:${lang}:${num}:v3`);
  
  const cached = await getCachedKeywords(cacheKey);
  if (cached && cached.length > 0 && cached[0].keyword !== 'Unbekannt') {
    return cached;
  }

  try {
    const url = `${BASE_URL}/topkeys/?keyword=${encodeURIComponent(topic)}&location=${location}&lang=${lang}&num=${num}`;
    
    console.log(`[Trend Radar] 🌐 API: topkeys "${topic}" (${location}/${lang})`);
    
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
    
    let rawKeywords: Record<string, unknown>[] = [];
    if (Array.isArray(data)) {
      rawKeywords = data;
    } else if (data && typeof data === 'object') {
      const keys = ['keywords', 'data', 'results', 'items', 'top_keywords'];
      for (const key of keys) {
        if (Array.isArray(data[key])) {
          rawKeywords = data[key];
          break;
        }
      }
    }
    
    const keywords = rawKeywords
      .map(normalizeKeyword)
      .filter(kw => kw.keyword !== 'Unbekannt' && kw.keyword.length > 0);
    
    console.log(`[Trend Radar] ✅ ${keywords.length} Top-Keywords`);
    
    if (keywords.length > 0) {
      await setCachedKeywords(cacheKey, keywords);
    }
    
    return keywords;
  } catch (error) {
    console.error('[Trend Radar] TopKeys Error:', error);
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
    const { domain, topic, country = 'AT', lang = 'de' } = body;

    if (!domain) {
      return NextResponse.json({ message: 'Domain fehlt' }, { status: 400 });
    }

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json({ message: 'Bitte geben Sie ein Thema ein' }, { status: 400 });
    }

    if (!RAPIDAPI_KEY) {
      return NextResponse.json({ message: 'API nicht konfiguriert' }, { status: 500 });
    }

    const searchTopic = topic.trim();
    const countryLabel = COUNTRY_LABELS[country] || country;
    
    console.log(`[Trend Radar] ========== START ==========`);
    console.log(`[Trend Radar] Domain: ${domain}`);
    console.log(`[Trend Radar] Thema: "${searchTopic}"`);
    console.log(`[Trend Radar] Region: ${country} (${lang})`);

    // Daten abrufen mit dynamischem Land/Sprache
    const suggestions = await fetchKeywordSuggestions(searchTopic, country, lang);
    const topKeywords = await fetchTopKeywords(searchTopic, country, lang, 20);
    
    const hasData = suggestions.length > 0 || topKeywords.length > 0;

    // Deduplizieren
    const allKeywords = [...suggestions, ...topKeywords];
    const uniqueKeywords = allKeywords.reduce((acc, kw) => {
      if (!acc.find(k => k.keyword.toLowerCase() === kw.keyword.toLowerCase())) {
        acc.push(kw);
      }
      return acc;
    }, [] as KeywordData[]);

    // Kategorisieren
    const risingKeywords = uniqueKeywords
      .filter(kw => {
        const trend = analyzeTrend(kw.trend);
        return trend.direction === 'steigend' || trend.direction === 'neu';
      })
      .sort((a, b) => b.search_volume - a.search_volume)
      .slice(0, 10);

    const highVolumeKeywords = [...uniqueKeywords]
      .sort((a, b) => b.search_volume - a.search_volume)
      .slice(0, 15);

    const lowCompetitionKeywords = uniqueKeywords
      .filter(kw => kw.competition_index < 50 && kw.search_volume > 10)
      .sort((a, b) => b.search_volume - a.search_volume)
      .slice(0, 10);

    // Prompt
    const trendsData = hasData ? `
KEYWORD RECHERCHE FÜR: "${searchTopic}"
Region: ${countryLabel}
Domain: ${domain}

📊 TOP KEYWORDS NACH SUCHVOLUMEN:
${highVolumeKeywords.length > 0
  ? highVolumeKeywords.map(kw => {
      const trend = analyzeTrend(kw.trend);
      return `- "${kw.keyword}" | ${kw.search_volume.toLocaleString('de-DE')}/Monat | Wettbewerb: ${kw.competition} (${kw.competition_index}/100) | Trend: ${trend.direction} | Intent: ${kw.intent || 'N/A'}`;
    }).join('\n')
  : 'Keine Daten.'}

🔥 STEIGENDE KEYWORDS:
${risingKeywords.length > 0 
  ? risingKeywords.map(kw => {
      const trend = analyzeTrend(kw.trend);
      return `- "${kw.keyword}" | ${kw.search_volume.toLocaleString('de-DE')}/Monat | Trend: ${trend.direction} (+${trend.percentage}%)`;
    }).join('\n')
  : 'Keine steigenden Keywords identifiziert.'}

🎯 LOW COMPETITION CHANCEN:
${lowCompetitionKeywords.length > 0
  ? lowCompetitionKeywords.map(kw => {
      return `- "${kw.keyword}" | ${kw.search_volume.toLocaleString('de-DE')}/Monat | Wettbewerb: NUR ${kw.competition_index}/100`;
    }).join('\n')
  : 'Keine Low-Competition Keywords gefunden.'}

GESAMT: ${uniqueKeywords.length} einzigartige Keywords analysiert
` : `
HINWEIS: Keine Keyword-Daten für "${searchTopic}" in ${countryLabel} gefunden.

Mögliche Gründe:
- Das Thema ist sehr speziell
- Andere Schreibweise probieren
- Andere Region testen

Domain: ${domain}
`;

    // System Prompt
    const systemPrompt = `
Du bist ein SEO-Stratege. Analysiere die Keyword-Daten und erstelle einen actionable Report.

WICHTIG: 
- Keywords stammen aus einer Recherche für "${searchTopic}" in ${countryLabel}
- Die Domain "${domain}" möchte für diese Keywords ranken

REGELN FÜR FORMATIERUNG:
1. KEIN MARKDOWN! Nur HTML mit Tailwind.

STYLING:
- Überschriften: <h3 class="font-bold text-indigo-900 mt-6 mb-3 text-lg flex items-center gap-2">TITEL</h3>
- Fließtext: <p class="mb-3 leading-relaxed text-gray-600 text-sm">TEXT</p>
- Erfolgs-Badge: <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">Live-Daten ✓</span>
- Region-Badge: <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">${countryLabel}</span>
- Statistik-Grid:
  <div class="grid grid-cols-3 gap-3 my-4">
    <div class="bg-white p-3 rounded-lg border border-gray-100 text-center">
      <div class="text-2xl font-bold text-indigo-600">ZAHL</div>
      <div class="text-xs text-gray-500">LABEL</div>
    </div>
  </div>
- Keyword-Karte: 
  <div class="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 mb-3">
    <div class="flex items-center justify-between mb-2">
      <span class="font-bold text-gray-900">KEYWORD</span>
      <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">VOLUME/Monat</span>
    </div>
    <p class="text-sm text-gray-600 mb-2">Warum relevant? Content-Empfehlung.</p>
    <div class="flex flex-wrap gap-2">
      <span class="bg-white px-2 py-1 rounded text-xs text-indigo-600 border border-indigo-100">Content-Idee</span>
    </div>
  </div>
- Quick-Win Karte:
  <div class="flex items-center justify-between bg-emerald-50 p-3 rounded-lg border border-emerald-100 mb-2">
    <div>
      <span class="font-medium text-gray-800">KEYWORD</span>
      <span class="text-xs text-emerald-600 ml-2">Wettbewerb: NUR X/100</span>
    </div>
    <span class="text-emerald-700 font-bold text-sm">VOLUME/Monat</span>
  </div>
- Empfehlungs-Box: <div class="bg-indigo-600 text-white p-4 rounded-xl my-4 shadow-lg">
- Listen: <ul class="space-y-2 mt-2 text-sm"><li class="flex items-start gap-2"><span>→</span><span>PUNKT</span></li></ul>

AUFGABE:

1. <h3>📡 Datenübersicht</h3>
   - Zeige Live-Daten ✓ und Region-Badge
   - Statistik-Grid: Anzahl Keywords | Ø Suchvolumen | Steigende Keywords
   - Kurze Einordnung

2. <h3>🔥 Top 5 Content-Chancen</h3>
   Die 5 BESTEN Keywords für neuen Content.
   Für jedes: Keyword-Karte mit konkreter Content-Idee.

3. <h3>🎯 Quick Wins (Niedrige Konkurrenz)</h3>
   3-5 Keywords mit niedrigem Wettbewerb. Quick-Win Karten.

4. <h3>📈 Trend-Einschätzung</h3>
   Welche Keywords steigen? Was bedeutet das?

5. <h3>💡 Sofort-Empfehlung</h3>
   Empfehlungs-Box mit:
   - EINE klare Haupt-Empfehlung
   - 3 konkrete Schritte

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
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
