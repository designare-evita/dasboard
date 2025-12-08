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

const COUNTRY_MAP: Record<string, string> = { 'AT': 'AT', 'DE': 'DE', 'CH': 'CH', 'US': 'US' };
const COUNTRY_LABELS: Record<string, string> = { 'AT': 'Österreich', 'DE': 'Deutschland', 'CH': 'Schweiz', 'US': 'USA' };

// Google Trends Daten holen
async function fetchGoogleTrends(keyword: string, geo: string) {
  if (!SERPAPI_KEY) throw new Error('SERPAPI_KEY fehlt');

  const params = new URLSearchParams({
    engine: 'google_trends',
    q: keyword,
    geo: geo,
    data_type: 'TIMESERIES',
    api_key: SERPAPI_KEY
  });

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) throw new Error(`SerpApi Error: ${response.statusText}`);

  const data = await response.json();
  return {
    timeline: data.interest_over_time?.timeline_data || [],
    rising: data.related_queries?.rising || [],
    top: data.related_queries?.top || []
  };
}

// Trend analysieren
function analyzeTrend(timeline: any[]): { status: string; badge: string; color: string; icon: string } {
  if (!timeline || timeline.length < 5) {
    return { status: 'Wenig Daten', badge: 'KEINE DATEN', color: 'gray', icon: '📊' };
  }

  const last3 = timeline.slice(-3).reduce((acc: number, curr: any) => acc + (curr.values[0]?.extracted_value || 0), 0) / 3;
  const prev3 = timeline.slice(-6, -3).reduce((acc: number, curr: any) => acc + (curr.values[0]?.extracted_value || 0), 0) / 3;

  if (last3 > prev3 * 1.5) return { status: 'Stark steigend', badge: 'VIRAL', color: 'rose', icon: '🔥' };
  if (last3 > prev3 * 1.1) return { status: 'Steigend', badge: 'WACHSTUM', color: 'emerald', icon: '📈' };
  if (last3 < prev3 * 0.9) return { status: 'Fallend', badge: 'RÜCKGANG', color: 'amber', icon: '📉' };
  return { status: 'Stabil', badge: 'STABIL', color: 'blue', icon: '➡️' };
}

// Metriken berechnen
function calculateMetrics(timeline: any[]) {
  if (!timeline || timeline.length === 0) return { avg: 0, peak: 0, peakDate: '-', current: 0, change: 0 };
  
  const values = timeline.map((p: any) => p.values[0]?.extracted_value || 0);
  const avg = Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length);
  const peak = Math.max(...values);
  const peakIndex = values.indexOf(peak);
  const peakDate = timeline[peakIndex]?.date || '-';
  const current = values[values.length - 1] || 0;
  const previous = values[values.length - 4] || current;
  const change = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
  
  return { avg, peak, peakDate, current, change };
}

// Sparkline generieren (einfache ASCII-Darstellung für den Prompt)
function generateSparklineData(timeline: any[]): string {
  if (!timeline || timeline.length < 3) return 'Keine Daten';
  const last12 = timeline.slice(-12).map((p: any) => p.values[0]?.extracted_value || 0);
  return last12.join(',');
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
    let trendData = { timeline: [], rising: [], top: [] };
    let analysis = { status: 'Keine Daten', badge: 'FEHLER', color: 'gray', icon: '❓' };
    let metrics = { avg: 0, peak: 0, peakDate: '-', current: 0, change: 0 };
    
    try {
      trendData = await fetchGoogleTrends(topic, geoCode);
      analysis = analyzeTrend(trendData.timeline);
      metrics = calculateMetrics(trendData.timeline);
    } catch (e) {
      console.error("Trend Fetch Error", e);
    }

    const sparklineData = generateSparklineData(trendData.timeline);

    // Related Queries aufbereiten
    interface RelatedQuery { query: string; value: string; type: 'rising' | 'top' }
    
    const risingQueries: RelatedQuery[] = trendData.rising.slice(0, 5).map((r: any) => ({
      query: r.query,
      value: r.extracted_value || r.value || 'N/A',
      type: 'rising' as const
    }));
    
    const topQueries: RelatedQuery[] = trendData.top.slice(0, 5).map((r: any) => ({
      query: r.query,
      value: r.extracted_value || r.value || 'N/A',
      type: 'top' as const
    }));

    // Farb-Klassen
    const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
      'rose': { bg: 'bg-rose-500', text: 'text-rose-700', border: 'border-rose-200' },
      'emerald': { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200' },
      'amber': { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-200' },
      'blue': { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-200' },
      'gray': { bg: 'bg-gray-400', text: 'text-gray-600', border: 'border-gray-200' },
    };
    const colors = colorClasses[analysis.color] || colorClasses['gray'];

    // Prompt
    const systemPrompt = `
Du bist ein SEO-Trend-Analyst. Erstelle einen professionellen, visuell ansprechenden Report.

WICHTIG: NUR HTML ausgeben. KEIN Markdown. Kompakt, professionell, actionable.

═══════════════════════════════════════════════════════════════════════════════
KOMPONENTEN-BIBLIOTHEK (nutze exakt diese Klassen):
═══════════════════════════════════════════════════════════════════════════════

HEADER-CARD (ganz oben, zeigt Status):
<div class="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 text-white mb-4">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-indigo-200 text-xs uppercase tracking-wider mb-1">Trend-Analyse</p>
      <h2 class="text-xl font-bold">"${topic}" in ${countryName}</h2>
    </div>
    <div class="text-right">
      <span class="inline-block px-3 py-1 rounded-full text-xs font-bold ${colors.bg} text-white">${analysis.icon} ${analysis.badge}</span>
      <p class="text-indigo-200 text-xs mt-1">${analysis.status}</p>
    </div>
  </div>
</div>

METRIKEN-GRID (4 Spalten):
<div class="grid grid-cols-4 gap-2 mb-4">
  <div class="bg-white border border-gray-200 rounded-lg p-3 text-center">
    <div class="text-2xl font-bold text-gray-900">ZAHL</div>
    <div class="text-[10px] text-gray-500 uppercase">Label</div>
  </div>
</div>

SECTION-HEADER:
<h3 class="font-bold text-gray-900 text-sm flex items-center gap-2 mt-4 mb-2 pb-1 border-b border-gray-100">
  <span>EMOJI</span> Titel
</h3>

2-SPALTEN-GRID (für Keywords):
<div class="grid grid-cols-2 gap-3 mb-3">
  <div class="bg-white border border-gray-200 rounded-lg p-3">
    <h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Titel</h4>
    <!-- Inhalt -->
  </div>
</div>

KEYWORD-ITEM (steigend, grün):
<div class="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
  <span class="text-sm text-gray-800">Keyword</span>
  <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">+WERT</span>
</div>

KEYWORD-ITEM (top/stabil, blau):
<div class="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
  <span class="text-sm text-gray-800">Keyword</span>
  <span class="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">WERT</span>
</div>

ALTERNATIVE-KEYWORD-CARD:
<div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 mb-3">
  <h4 class="text-xs font-bold text-amber-700 uppercase mb-2">💡 Alternative Keywords</h4>
  <div class="flex flex-wrap gap-1.5">
    <span class="bg-white border border-amber-200 text-amber-800 px-2 py-1 rounded text-xs font-medium">Keyword</span>
  </div>
</div>

CONTENT-IDEE-CARD:
<div class="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3 mb-3">
  <h4 class="text-xs font-bold text-indigo-700 uppercase mb-1">📝 Content-Idee</h4>
  <p class="text-indigo-900 font-semibold text-sm mb-2">"Titel hier"</p>
  <p class="text-indigo-700 text-xs">Kurze Begründung</p>
</div>

ACTION-ITEM:
<div class="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
  <span class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">1</span>
  <div>
    <p class="text-sm text-gray-800 font-medium">Aktion</p>
    <p class="text-xs text-gray-500">Details</p>
  </div>
</div>

FAZIT-BOX (positiv):
<div class="bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg p-3 mt-3">
  <div class="flex items-center gap-2">
    <span class="text-emerald-600 text-lg">✅</span>
    <div>
      <p class="text-emerald-800 font-bold text-sm">Empfehlung: Content erstellen</p>
      <p class="text-emerald-700 text-xs">Begründung</p>
    </div>
  </div>
</div>

FAZIT-BOX (neutral):
<div class="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-3 mt-3">
  <div class="flex items-center gap-2">
    <span class="text-amber-600 text-lg">⚠️</span>
    <div>
      <p class="text-amber-800 font-bold text-sm">Empfehlung: Mit Vorsicht</p>
      <p class="text-amber-700 text-xs">Begründung</p>
    </div>
  </div>
</div>

FAZIT-BOX (negativ):
<div class="bg-rose-50 border-l-4 border-rose-500 rounded-r-lg p-3 mt-3">
  <div class="flex items-center gap-2">
    <span class="text-rose-600 text-lg">❌</span>
    <div>
      <p class="text-rose-800 font-bold text-sm">Empfehlung: Nicht priorisieren</p>
      <p class="text-rose-700 text-xs">Begründung</p>
    </div>
  </div>
</div>

INFO-HINWEIS (klein):
<p class="text-[11px] text-gray-400 mt-2">ℹ️ Hinweistext</p>

═══════════════════════════════════════════════════════════════════════════════
REPORT-STRUKTUR:
═══════════════════════════════════════════════════════════════════════════════

1. HEADER-CARD mit Status-Badge

2. METRIKEN-GRID mit 4 Werten:
   - Aktuell: ${metrics.current}/100
   - Durchschnitt: ${metrics.avg}/100
   - Peak: ${metrics.peak}/100
   - Trend: ${metrics.change > 0 ? '+' : ''}${metrics.change}%

3. <h3>🔍 Keyword-Analyse</h3>
   2-SPALTEN-GRID:
   - Links: "Aufsteigende Keywords" (${risingQueries.length} Items) - mit grünen Badges
   - Rechts: "Top Keywords" (${topQueries.length} Items) - mit blauen Badges
   Wenn keine Keywords: Hinweis dass Thema sehr spezifisch ist

4. <h3>💡 Alternativen & Variationen</h3>
   ALTERNATIVE-KEYWORD-CARD mit 6-8 Keyword-Vorschlägen die:
   - Verwandt zu "${topic}" sind
   - Long-Tail Varianten (z.B. "${topic} Kosten", "${topic} Anbieter")
   - Lokale Varianten (z.B. "${topic} ${countryName}")
   - Fragen (z.B. "Was kostet ${topic}?")
   Diese soll der User als Alternative recherchieren können!

5. <h3>📝 Content-Empfehlungen</h3>
   2-3 CONTENT-IDEE-CARDs mit:
   - Konkretem Blogpost-Titel
   - Warum dieser Titel funktioniert (1 Satz)

6. <h3>🎯 Nächste Schritte</h3>
   3 ACTION-ITEMs (nummeriert) mit konkreten Aufgaben für ${domain}

7. FAZIT-BOX basierend auf Trend:
   - ${analysis.color === 'emerald' || analysis.color === 'rose' ? 'POSITIV (grün)' : ''}
   - ${analysis.color === 'blue' ? 'NEUTRAL (gelb)' : ''}
   - ${analysis.color === 'amber' || analysis.color === 'gray' ? 'VORSICHTIG (gelb/rot)' : ''}

8. INFO-HINWEIS: "Daten basieren auf Google Trends für ${countryName}"

Antworte NUR mit HTML!
`;

    const promptData = `
DATEN FÜR ANALYSE:

Keyword: "${topic}"
Region: ${countryName}
Domain: ${domain}

METRIKEN:
- Aktueller Wert: ${metrics.current}/100
- Durchschnitt: ${metrics.avg}/100  
- Peak: ${metrics.peak}/100 (${metrics.peakDate})
- Veränderung: ${metrics.change}%
- Status: ${analysis.status}
- Sparkline: ${sparklineData}

AUFSTEIGENDE KEYWORDS (${risingQueries.length}):
${risingQueries.length > 0 
  ? risingQueries.map((r: RelatedQuery) => `- "${r.query}" → ${r.value}`).join('\n')
  : '- Keine gefunden (Thema ist etabliert/stabil)'}

TOP KEYWORDS (${topQueries.length}):
${topQueries.length > 0 
  ? topQueries.map((r: RelatedQuery) => `- "${r.query}" → ${r.value}`).join('\n')
  : '- Keine gefunden'}

Erstelle den Report basierend auf diesen echten Daten!
`;

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: promptData,
      temperature: 0.4,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ Trend Radar Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
