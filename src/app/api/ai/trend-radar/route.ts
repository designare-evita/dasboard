// src/app/api/ai/trend-radar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

const SERPAPI_KEY = process.env.SERPAPI_KEY || ''; 

export const runtime = 'nodejs';
export const maxDuration = 60;

// Ländermapping
const COUNTRY_MAP: Record<string, string> = {
  'AT': 'AT',
  'DE': 'DE',
  'CH': 'CH',
  'US': 'US',
};

const COUNTRY_LABELS: Record<string, string> = {
  'AT': 'Österreich',
  'DE': 'Deutschland', 
  'CH': 'Schweiz',
  'US': 'USA',
};

// Daten von SerpApi holen
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
  
  const timeline = data.interest_over_time?.timeline_data || [];
  const related = data.related_queries?.rising || [];

  return { timeline, related };
}

// Analyse: Ist der Trend steigend?
function analyzeTrendCurve(timeline: any[]): { status: string; badge: string; color: string } {
  if (!timeline || timeline.length < 5) {
    return { 
      status: 'Zu wenig Daten', 
      badge: '📊 WENIG DATEN',
      color: 'gray'
    };
  }

  const last3 = timeline.slice(-3).reduce((acc, curr) => acc + (curr.values[0]?.extracted_value || 0), 0) / 3;
  const prev3 = timeline.slice(-6, -3).reduce((acc, curr) => acc + (curr.values[0]?.extracted_value || 0), 0) / 3;

  if (last3 > prev3 * 1.5) return { status: 'Stark steigend', badge: '🔥 VIRAL', color: 'rose' };
  if (last3 > prev3 * 1.1) return { status: 'Leicht steigend', badge: '📈 STEIGEND', color: 'emerald' };
  if (last3 < prev3 * 0.9) return { status: 'Fallend', badge: '📉 FALLEND', color: 'amber' };
  return { status: 'Stabil', badge: '➡️ STABIL', color: 'blue' };
}

// Durchschnittswert berechnen
function getAverageInterest(timeline: any[]): number {
  if (!timeline || timeline.length === 0) return 0;
  const sum = timeline.reduce((acc, curr) => acc + (curr.values[0]?.extracted_value || 0), 0);
  return Math.round(sum / timeline.length);
}

// Höchstwert finden
function getPeakInterest(timeline: any[]): { value: number; date: string } {
  if (!timeline || timeline.length === 0) return { value: 0, date: '-' };
  let max = { value: 0, date: '' };
  timeline.forEach((p: any) => {
    const val = p.values[0]?.extracted_value || 0;
    if (val > max.value) {
      max = { value: val, date: p.date };
    }
  });
  return max;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await req.json();
    const { domain, topic, country = 'AT' } = body;

    const geoCode = COUNTRY_MAP[country] || 'AT';
    const countryName = COUNTRY_LABELS[country] || country;

    if (!topic) return NextResponse.json({ message: 'Thema fehlt' }, { status: 400 });

    // Daten holen
    let trendData;
    let analysis = { status: 'Keine Daten', badge: '❓ UNBEKANNT', color: 'gray' };
    let avgInterest = 0;
    let peak = { value: 0, date: '-' };
    
    try {
      trendData = await fetchGoogleTrends(topic, geoCode);
      analysis = analyzeTrendCurve(trendData.timeline);
      avgInterest = getAverageInterest(trendData.timeline);
      peak = getPeakInterest(trendData.timeline);
    } catch (e) {
      console.error("Trend Fetch Error", e);
      trendData = { timeline: [], related: [] };
    }

    // Kurve als Mini-Sparkline beschreiben
    const lastPoints = trendData.timeline.slice(-8).map((p: any) => p.values[0]?.extracted_value || 0);
    const sparklineText = lastPoints.length > 0 ? lastPoints.join(' → ') : 'Keine Daten';

    // Related Queries aufbereiten
    interface RelatedQuery {
      query: string;
      growth: string;
    }
    const relatedQueries: RelatedQuery[] = trendData.related.slice(0, 8).map((r: any) => ({
      query: r.query,
      growth: r.extracted_value || r.value || 'N/A'
    }));

    // Badge-Farben Map
    const badgeColors: Record<string, string> = {
      'rose': 'bg-rose-100 text-rose-700 border-rose-200',
      'emerald': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'amber': 'bg-amber-100 text-amber-700 border-amber-200',
      'blue': 'bg-blue-100 text-blue-700 border-blue-200',
      'gray': 'bg-gray-100 text-gray-600 border-gray-200',
    };
    const badgeClass = badgeColors[analysis.color] || badgeColors['gray'];

    // Prompt
    const promptData = `
TREND-ANALYSE FÜR: "${topic}"
REGION: ${countryName}
DOMAIN: ${domain}

📊 METRIKEN:
• Trend-Status: ${analysis.status}
• Durchschnittliches Interesse: ${avgInterest}/100
• Peak: ${peak.value}/100 (${peak.date})
• Letzte Werte: ${sparklineText}
• Datenpunkte: ${trendData.timeline.length}

🔥 AUFSTEIGENDE SUCHANFRAGEN (${relatedQueries.length}):
${relatedQueries.length > 0 
  ? relatedQueries.map((r: RelatedQuery) => `• "${r.query}" → ${r.growth}`).join('\n')
  : '• Keine aufsteigenden Suchanfragen gefunden'}

BADGE-KLASSE: ${badgeClass}
BADGE-TEXT: ${analysis.badge}
`;

    const systemPrompt = `
Du bist ein Trend-Analyst für Content Marketing.
Interpretiere die Google Trends Daten und gib Handlungsempfehlungen.

WICHTIG: Antworte NUR mit sauberem HTML. KEIN Markdown! Keine Codeblöcke!

══════════════════════════════════════════════════════════════════════════════
STYLING-KOMPONENTEN (nutze genau diese Klassen):
══════════════════════════════════════════════════════════════════════════════

ÜBERSCHRIFT:
<h3 class="font-bold text-gray-900 text-base flex items-center gap-2 mt-4 mb-2">EMOJI TITEL</h3>

FLIESSTEXT:
<p class="text-gray-600 text-sm leading-relaxed mb-2">Text hier</p>

STATUS-BADGE:
<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${badgeClass}">${analysis.badge}</span>

STATISTIK-GRID (für Zahlen):
<div class="grid grid-cols-3 gap-2 my-3">
  <div class="bg-white border border-gray-200 rounded-lg p-3 text-center shadow-sm">
    <div class="text-2xl font-bold text-indigo-600">ZAHL</div>
    <div class="text-[10px] text-gray-500 uppercase tracking-wide mt-1">LABEL</div>
  </div>
</div>

INFO-BOX (blau):
<div class="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
  <p class="text-sm text-blue-800">ℹ️ Informationstext</p>
</div>

WARNUNG-BOX (gelb, bei wenig Daten):
<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
  <p class="text-sm text-amber-800">⚠️ Warnungstext</p>
</div>

KEYWORD-KARTE (für Related Queries):
<div class="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2 mb-1.5 hover:border-indigo-200 transition-colors">
  <span class="text-sm text-gray-800 font-medium">Keyword</span>
  <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">+WERT%</span>
</div>

EMPFEHLUNGS-BOX (indigo):
<div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl p-4 mt-3 shadow-lg">
  <h4 class="font-bold text-sm mb-2 flex items-center gap-2">💡 Titel</h4>
  <p class="text-sm text-indigo-100 leading-relaxed">Empfehlungstext</p>
</div>

FAZIT-BOX (grün für JA, rot für NEIN):
JA: <div class="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-3 mt-3">
      <p class="text-emerald-800 font-medium text-sm">✅ FAZIT TEXT</p>
    </div>
NEIN: <div class="bg-rose-50 border-2 border-rose-200 rounded-lg p-3 mt-3">
        <p class="text-rose-800 font-medium text-sm">❌ FAZIT TEXT</p>
      </div>

══════════════════════════════════════════════════════════════════════════════
ERSTELLE DIESEN REPORT:
══════════════════════════════════════════════════════════════════════════════

1. <h3>📊 Trend-Status: "${topic}"</h3>
   - Zeige den STATUS-BADGE groß und prominent
   - STATISTIK-GRID mit 3 Werten: Interesse (Ø ${avgInterest}), Peak (${peak.value}), Datenpunkte
   - Kurze Interpretation (1-2 Sätze): Was bedeuten diese Zahlen?
   - Bei wenig/keine Daten (${avgInterest === 0 ? 'JA' : 'NEIN'}): WARNUNG-BOX erklären warum (Nische, lokal, etc.)

2. <h3>🔥 Aufsteigende Keywords</h3>
   ${relatedQueries.length > 0 
     ? `- Zeige KEYWORD-KARTEN für die Top ${Math.min(5, relatedQueries.length)} Keywords
   - Erkläre: Diese Begriffe werden ZUSÄTZLICH gesucht
   - "Breakout" = explosive Nachfrage = Content-Goldgrube!`
     : `- INFO-BOX: Keine aufsteigenden Keywords gefunden
   - Erkläre: Das Thema ist entweder sehr spezifisch/lokal oder stabil`}

3. <h3>💡 Content-Empfehlung für ${domain}</h3>
   EMPFEHLUNGS-BOX mit:
   - EINEM konkreten Blogpost-Titel der den Trend aufgreift
   - Warum JETZT der richtige Zeitpunkt ist
   - Zielgruppe (wer sucht danach?)

4. <h3>✅ Fazit</h3>
   FAZIT-BOX (grün oder rot):
   - Klare JA/NEIN Aussage: Lohnt sich Content zu "${topic}"?
   - Begründung in 1-2 Sätzen
   - Bei NEIN: Alternative vorschlagen

Antworte DIREKT mit HTML. Kein Markdown, keine Codeblöcke!
`;

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: promptData,
      temperature: 0.5,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ Trend Radar Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
