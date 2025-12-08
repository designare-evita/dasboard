// src/app/api/ai/trend-radar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

// 1. Config & Keys
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Du brauchst diesen Key in deiner .env Datei!
const SERPAPI_KEY = process.env.SERPAPI_KEY || ''; 

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Timeout erhöhen

// 2. Ländermapping (Frontend Code -> Google Geo Code)
const COUNTRY_MAP: Record<string, string> = {
  'AT': 'AT', // Österreich
  'DE': 'DE', // Deutschland
  'CH': 'CH', // Schweiz
  'US': 'US', // USA
};

const COUNTRY_LABELS: Record<string, string> = {
  'AT': 'Österreich',
  'DE': 'Deutschland', 
  'CH': 'Schweiz',
  'US': 'USA',
};

// 3. Typen für die Trend-Daten
interface TrendPoint {
  date: string;
  value: number; // 0-100
}

interface RelatedTopic {
  query: string;
  value: string; // z.B. "+350%" oder "Breakout"
}

// 4. Daten von SerpApi holen
async function fetchGoogleTrends(keyword: string, geo: string) {
  if (!SERPAPI_KEY) throw new Error('SERPAPI_KEY fehlt in .env');

  const params = new URLSearchParams({
    engine: 'google_trends',
    q: keyword,
    geo: geo,
    data_type: 'TIMESERIES',
    api_key: SERPAPI_KEY
  });

  console.log(`[Trend Radar] Fetching: ${keyword} in ${geo}`);
  
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`SerpApi Error: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Wir extrahieren zwei Dinge: 
  // A) Die Zeitverlaufskurve (Interest over Time)
  // B) Verwandte Suchanfragen (Rising Queries), falls vorhanden
  
  const timeline = data.interest_over_time?.timeline_data || [];
  const related = data.related_queries?.rising || [];

  return { timeline, related };
}

// 5. Analyse-Funktion: Ist der Trend steigend?
function analyzeTrendCurve(timeline: any[]): string {
  if (!timeline || timeline.length < 5) return 'Zu wenig Daten';

  // Wir vergleichen den Durchschnitt der letzten 3 Punkte mit den 3 Punkten davor
  const last3 = timeline.slice(-3).reduce((acc, curr) => acc + (curr.values[0]?.extracted_value || 0), 0) / 3;
  const prev3 = timeline.slice(-6, -3).reduce((acc, curr) => acc + (curr.values[0]?.extracted_value || 0), 0) / 3;

  if (last3 > prev3 * 1.5) return '🔥 STARK STEIGEND (Viral)';
  if (last3 > prev3 * 1.1) return '📈 LEICHT STEIGEND';
  if (last3 < prev3 * 0.9) return '📉 FALLEND';
  return '➡️ STABIL';
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(req: NextRequest) {
  try {
    // Auth Check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await req.json();
    const { domain, topic, country = 'AT' } = body;

    // Mapping des Ländercodes (Frontend 'AT' -> API 'AT')
    const geoCode = COUNTRY_MAP[country] || 'AT';
    const countryName = COUNTRY_LABELS[country] || country;

    if (!topic) return NextResponse.json({ message: 'Thema fehlt' }, { status: 400 });

    // --- DATEN HOLEN ---
    let trendData;
    let analysisResult = 'Keine Daten';
    
    try {
        trendData = await fetchGoogleTrends(topic, geoCode);
        analysisResult = analyzeTrendCurve(trendData.timeline);
    } catch (e) {
        console.error("Trend Fetch Error", e);
        // Fallback, falls API failt (damit KI trotzdem antwortet)
        trendData = { timeline: [], related: [] };
    }

    // --- DATEN AUFBEREITEN FÜR KI ---
    // Wir bauen einen String, der die Kurve beschreibt
    const curveDescription = trendData.timeline.map((p: any) => 
        `${p.date}: ${p.values[0]?.extracted_value}`
    ).slice(-12).join(' | '); // Nur die letzten 12 Datenpunkte (z.B. letzte 12 Wochen/Tage)

    const relatedQueriesString = trendData.related.length > 0 
        ? trendData.related.map((r: any) => `- ${r.query} (${r.extracted_value})`).join('\n')
        : 'Keine "Ausreißer"-Keywords gefunden.';


    // --- PROMPT BAUEN ---
    const promptData = `
ANALYSE FÜR THEMA: "${topic}"
REGION: ${countryName}
DOMAIN: ${domain}

📊 TREND-VERLAUF (Letzte Datenpunkte, Skala 0-100):
${curveDescription || 'Keine Verlaufsdaten verfügbar'}

ALGORITHMUS-BEWERTUNG: ${analysisResult}

🔥 AUFSTEIGENDE SUCHBEGRIFFE (Related Rising Queries):
${relatedQueriesString}
`;

    // --- SYSTEM PROMPT (HTML FORMAT) ---
    const systemPrompt = `
Du bist ein Trend-Analyst für Content Marketing.
Deine Aufgabe: Interpretiere die echten Google Trends Daten und gib Handlungsempfehlungen.

FORMATIERUNG: Nutze ausschließlich HTML mit Tailwind-CSS Klassen. Keine Markdown-Codeblöcke!

STYLING VORGABEN:
- H3: <h3 class="font-bold text-indigo-900 mt-6 mb-3 text-lg flex items-center gap-2">
- P: <p class="mb-3 leading-relaxed text-gray-600 text-sm">
- Boxen: <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
- Trend-Badge: 
  Wenn steigend: <span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">🔥 HYPE</span>
  Wenn stabil: <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">➡️ STABIL</span>

DEINE AUFGABE:

1. <h3>📊 Trend Status</h3>
   - Gib eine klare Einschätzung: Ist das Thema gerade heiß?
   - Interpretiere die Zahlen (0-100). 100 bedeutet maximales Interesse.
   - Zeige den Algorithmus-Status (${analysisResult}) als Badge an.

2. <h3>🔥 Verwandte Breakout-Themen</h3>
   - Analysiere die "Aufsteigenden Suchbegriffe". 
   - Das sind Themen, die Nutzer *zusätzlich* zu "${topic}" suchen.
   - Wenn dort "+Breakout" oder hohe Prozentzahlen stehen, sind das Goldgruben für Content!
   - Erstelle für die besten 3 eine kleine Liste.

3. <h3>💡 Content-Idee für ${domain}</h3>
   - Erstelle EINEN konkreten Titel für einen Blogpost oder ein Video, der diesen Trend aufgreift.
   - Erkläre kurz, warum dieser Titel jetzt funktionieren würde (Newsjacking).

4. <h3>⚠️ Fazit</h3>
   - Lohnt es sich, *jetzt* darüber zu schreiben? (Ja/Nein/Vielleicht)

Antworte direkt mit dem HTML-Code.
`;

    // --- STREAM STARTEN ---
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: promptData,
      temperature: 0.7,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ Trend Radar Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
