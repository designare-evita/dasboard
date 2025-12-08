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

async function fetchGoogleTrends(keyword: string, geo: string) {
  if (!SERPAPI_KEY) throw new Error('SERPAPI_KEY fehlt');
  const params = new URLSearchParams({
    engine: 'google_trends', q: keyword, geo: geo, data_type: 'TIMESERIES', api_key: SERPAPI_KEY
  });
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) throw new Error(`SerpApi Error`);
  const data = await response.json();
  return {
    timeline: data.interest_over_time?.timeline_data || [],
    rising: data.related_queries?.rising || [],
    top: data.related_queries?.top || []
  };
}

function analyzeTrend(timeline: any[]): { status: string; color: string; icon: string } {
  if (!timeline || timeline.length < 5) return { status: 'Wenig Daten', color: 'gray', icon: '📊' };
  const last3 = timeline.slice(-3).reduce((a: number, c: any) => a + (c.values[0]?.extracted_value || 0), 0) / 3;
  const prev3 = timeline.slice(-6, -3).reduce((a: number, c: any) => a + (c.values[0]?.extracted_value || 0), 0) / 3;
  if (last3 > prev3 * 1.5) return { status: 'Viral', color: 'rose', icon: '🔥' };
  if (last3 > prev3 * 1.1) return { status: 'Steigend', color: 'emerald', icon: '📈' };
  if (last3 < prev3 * 0.9) return { status: 'Fallend', color: 'amber', icon: '📉' };
  return { status: 'Stabil', color: 'blue', icon: '➡️' };
}

function calcMetrics(timeline: any[]) {
  if (!timeline?.length) return { avg: 0, peak: 0, current: 0, change: 0 };
  const vals = timeline.map((p: any) => p.values[0]?.extracted_value || 0);
  const avg = Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length);
  const peak = Math.max(...vals);
  const current = vals[vals.length - 1] || 0;
  const prev = vals[Math.max(0, vals.length - 4)] || current;
  const change = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0;
  return { avg, peak, current, change };
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });

    const { domain, topic, country = 'AT' } = await req.json();
    const geoCode = COUNTRY_MAP[country] || 'AT';
    const countryName = COUNTRY_LABELS[country] || country;
    if (!topic) return NextResponse.json({ message: 'Thema fehlt' }, { status: 400 });

    let trendData = { timeline: [], rising: [], top: [] };
    let analysis = { status: 'Keine Daten', color: 'gray', icon: '❓' };
    let metrics = { avg: 0, peak: 0, current: 0, change: 0 };
    
    try {
      trendData = await fetchGoogleTrends(topic, geoCode);
      analysis = analyzeTrend(trendData.timeline);
      metrics = calcMetrics(trendData.timeline);
    } catch (e) { console.error("Trend Error", e); }

    interface RQ { query: string; value: string }
    const rising: RQ[] = trendData.rising.slice(0, 5).map((r: any) => ({ query: r.query, value: r.extracted_value || 'N/A' }));
    const top: RQ[] = trendData.top.slice(0, 5).map((r: any) => ({ query: r.query, value: r.extracted_value || 'N/A' }));

    const prompt = `Du bist SEO-Analyst. Erstelle einen KOMPAKTEN Trend-Report. NUR HTML, KEIN Markdown!

DATEN:
- Keyword: "${topic}" | Region: ${countryName} | Domain: ${domain}
- Aktuell: ${metrics.current} | Durchschnitt: ${metrics.avg} | Peak: ${metrics.peak} | Trend: ${metrics.change > 0 ? '+' : ''}${metrics.change}%
- Status: ${analysis.icon} ${analysis.status}
- Aufsteigende: ${rising.length > 0 ? rising.map((r: RQ) => r.query + ' (' + r.value + ')').join(', ') : 'keine'}
- Top: ${top.length > 0 ? top.map((r: RQ) => r.query + ' (' + r.value + ')').join(', ') : 'keine'}

DESIGN-REGELN - STRIKT BEFOLGEN:
1. KEINE großen Abstände! Nutze: mt-2, mb-1, p-2, gap-2
2. KEINE leeren Zeilen zwischen Elementen
3. KOMPAKT wie ein Dashboard
4. Schriftgröße: text-xs und text-sm

HTML-KOMPONENTEN (exakt so verwenden):

HEADER (kompakt):
<div class="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-3 text-white mb-2 flex items-center justify-between">
<div><span class="text-indigo-200 text-[10px] uppercase tracking-wider">Trend</span><h2 class="text-sm font-bold">"${topic}"</h2></div>
<span class="px-2 py-1 rounded text-[10px] font-bold bg-white/20">${analysis.icon} ${analysis.status.toUpperCase()}</span>
</div>

METRIKEN (inline):
<div class="flex gap-2 mb-2">
<div class="flex-1 bg-gray-50 rounded p-2 text-center"><div class="text-lg font-bold">${metrics.current}</div><div class="text-[9px] text-gray-500 uppercase">Aktuell</div></div>
<div class="flex-1 bg-gray-50 rounded p-2 text-center"><div class="text-lg font-bold">${metrics.avg}</div><div class="text-[9px] text-gray-500 uppercase">Ø</div></div>
<div class="flex-1 bg-gray-50 rounded p-2 text-center"><div class="text-lg font-bold">${metrics.peak}</div><div class="text-[9px] text-gray-500 uppercase">Peak</div></div>
<div class="flex-1 bg-gray-50 rounded p-2 text-center"><div class="text-lg font-bold ${metrics.change >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${metrics.change >= 0 ? '+' : ''}${metrics.change}%</div><div class="text-[9px] text-gray-500 uppercase">Trend</div></div>
</div>

SECTION-TITEL:
<h3 class="text-xs font-bold text-gray-700 uppercase tracking-wide mt-3 mb-1 flex items-center gap-1"><span>EMOJI</span>Titel</h3>

KEYWORD-GRID (2 Spalten, kompakt):
<div class="grid grid-cols-2 gap-2 mb-2">
<div class="bg-white border border-gray-200 rounded p-2">
<div class="text-[10px] font-bold text-gray-500 uppercase mb-1">Aufsteigend</div>
<div class="space-y-0.5">ITEMS</div>
</div>
<div class="bg-white border border-gray-200 rounded p-2">
<div class="text-[10px] font-bold text-gray-500 uppercase mb-1">Top Keywords</div>
<div class="space-y-0.5">ITEMS</div>
</div>
</div>

KEYWORD-ITEM:
<div class="flex justify-between text-xs py-0.5"><span class="text-gray-700">KEYWORD</span><span class="text-emerald-600 font-medium">+WERT</span></div>

ALTERNATIVE-BOX:
<div class="bg-amber-50 border border-amber-200 rounded p-2 mb-2">
<div class="text-[10px] font-bold text-amber-700 uppercase mb-1">💡 Alternativen testen</div>
<div class="flex flex-wrap gap-1">
<span class="bg-white text-amber-800 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">KEYWORD</span>
</div>
</div>

CONTENT-IDEEN (Liste):
<div class="bg-indigo-50 border border-indigo-200 rounded p-2 mb-2">
<div class="text-[10px] font-bold text-indigo-700 uppercase mb-1">📝 Content-Ideen</div>
<ul class="text-xs text-indigo-900 space-y-0.5 list-disc list-inside">
<li>Titel 1</li>
<li>Titel 2</li>
</ul>
</div>

ACTIONS (nummeriert, kompakt):
<div class="bg-gray-50 rounded p-2 mb-2 space-y-1">
<div class="flex gap-2 text-xs"><span class="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span><span class="text-gray-700">Action text</span></div>
<div class="flex gap-2 text-xs"><span class="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span><span class="text-gray-700">Action text</span></div>
<div class="flex gap-2 text-xs"><span class="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</span><span class="text-gray-700">Action text</span></div>
</div>

FAZIT (je nach Status):
Positiv: <div class="bg-emerald-100 border-l-2 border-emerald-500 rounded-r p-2 flex gap-2 items-start"><span class="text-emerald-600">✅</span><div><span class="text-emerald-800 font-bold text-xs">Go!</span><span class="text-emerald-700 text-xs ml-1">Kurzer Grund</span></div></div>
Neutral: <div class="bg-blue-100 border-l-2 border-blue-500 rounded-r p-2 flex gap-2 items-start"><span class="text-blue-600">ℹ️</span><div><span class="text-blue-800 font-bold text-xs">Okay</span><span class="text-blue-700 text-xs ml-1">Kurzer Grund</span></div></div>
Negativ: <div class="bg-amber-100 border-l-2 border-amber-500 rounded-r p-2 flex gap-2 items-start"><span class="text-amber-600">⚠️</span><div><span class="text-amber-800 font-bold text-xs">Vorsicht</span><span class="text-amber-700 text-xs ml-1">Kurzer Grund</span></div></div>

FOOTER:
<p class="text-[10px] text-gray-400 mt-2">📊 Google Trends · ${countryName}</p>

REPORT ERSTELLEN:
1. HEADER mit Status
2. METRIKEN-ROW
3. KEYWORD-GRID (Aufsteigend + Top) - wenn keine: "Keine Daten für Nischen-Keyword"
4. ALTERNATIVE-BOX mit 5-6 Long-Tail Varianten von "${topic}"
5. CONTENT-IDEEN mit 3 konkreten Blogpost-Titeln
6. ACTIONS mit 3 Schritten
7. FAZIT basierend auf ${analysis.status}
8. FOOTER

Alles KOMPAKT, KEINE großen Abstände, professionelles Dashboard-Design!`;

    const result = streamText({
      model: google('gemini-2.5-flash'),
      prompt: prompt,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Fehler';
    console.error('❌ Trend Radar Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
