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

function analyzeTrend(timeline: any[]): { status: string; color: string; icon: string; recommendation: string } {
  if (!timeline || timeline.length < 5) return { status: 'Wenig Daten', color: 'gray', icon: '📊', recommendation: 'neutral' };
  const last3 = timeline.slice(-3).reduce((a: number, c: any) => a + (c.values[0]?.extracted_value || 0), 0) / 3;
  const prev3 = timeline.slice(-6, -3).reduce((a: number, c: any) => a + (c.values[0]?.extracted_value || 0), 0) / 3;
  if (last3 > prev3 * 1.5) return { status: 'Viral', color: 'rose', icon: '🔥', recommendation: 'positive' };
  if (last3 > prev3 * 1.1) return { status: 'Steigend', color: 'emerald', icon: '📈', recommendation: 'positive' };
  if (last3 < prev3 * 0.9) return { status: 'Fallend', color: 'amber', icon: '📉', recommendation: 'caution' };
  return { status: 'Stabil', color: 'blue', icon: '➡️', recommendation: 'neutral' };
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
    let analysis = { status: 'Keine Daten', color: 'gray', icon: '❓', recommendation: 'neutral' };
    let metrics = { avg: 0, peak: 0, current: 0, change: 0 };
    
    try {
      trendData = await fetchGoogleTrends(topic, geoCode);
      analysis = analyzeTrend(trendData.timeline);
      metrics = calcMetrics(trendData.timeline);
    } catch (e) { console.error("Trend Error", e); }

    interface RQ { query: string; value: string }
    const rising: RQ[] = trendData.rising.slice(0, 5).map((r: any) => ({ query: r.query, value: r.extracted_value || 'N/A' }));
    const top: RQ[] = trendData.top.slice(0, 5).map((r: any) => ({ query: r.query, value: r.extracted_value || 'N/A' }));

    // Status Badge Farben
    const badgeColors: Record<string, string> = {
      'rose': 'bg-rose-500',
      'emerald': 'bg-emerald-500', 
      'amber': 'bg-amber-500',
      'blue': 'bg-blue-500',
      'gray': 'bg-gray-400'
    };
    const badgeColor = badgeColors[analysis.color] || 'bg-gray-400';

    // Trend Farbe
    const trendColor = metrics.change >= 0 ? 'text-emerald-600' : 'text-rose-600';
    const trendPrefix = metrics.change >= 0 ? '+' : '';

    // Rising Keywords HTML
    const risingHTML = rising.length > 0 
      ? rising.map((r: RQ) => `<div class="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0"><span class="text-gray-700">${r.query}</span><span class="text-emerald-600 font-semibold">${r.value}</span></div>`).join('')
      : '<p class="text-xs text-gray-400 italic">Keine Daten für dieses Keyword</p>';

    // Top Keywords HTML  
    const topHTML = top.length > 0
      ? top.map((r: RQ) => `<div class="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0"><span class="text-gray-700">${r.query}</span><span class="text-blue-600 font-semibold">${r.value}</span></div>`).join('')
      : '<p class="text-xs text-gray-400 italic">Keine Daten für dieses Keyword</p>';

    // Fazit Box basierend auf Recommendation
    const fazitBoxes: Record<string, string> = {
      'positive': `<div class="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r-lg"><div class="flex items-center gap-2"><span class="text-lg">✅</span><div><p class="text-emerald-800 font-bold text-sm">Content erstellen!</p><p class="text-emerald-700 text-xs">`,
      'caution': `<div class="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg"><div class="flex items-center gap-2"><span class="text-lg">⚠️</span><div><p class="text-amber-800 font-bold text-sm">Mit Vorsicht</p><p class="text-amber-700 text-xs">`,
      'neutral': `<div class="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg"><div class="flex items-center gap-2"><span class="text-lg">ℹ️</span><div><p class="text-blue-800 font-bold text-sm">Evergreen-Thema</p><p class="text-blue-700 text-xs">`
    };
    const fazitStart = fazitBoxes[analysis.recommendation] || fazitBoxes['neutral'];

    // KI generiert NUR den dynamischen Content
    const prompt = `Generiere NUR die folgenden Texte für "${topic}" (${countryName}, Domain: ${domain}). 
KEIN HTML, KEIN Markdown, NUR reiner Text in diesem exakten Format:

ALTERNATIVEN: keyword1, keyword2, keyword3, keyword4, keyword5, keyword6
CONTENT1: Erster Blogpost-Titel
CONTENT2: Zweiter Blogpost-Titel  
CONTENT3: Dritter Blogpost-Titel
STEP1: Erste Aktion (kurz)
STEP2: Zweite Aktion (kurz)
STEP3: Dritte Aktion (kurz)
FAZIT: Ein kurzer Satz warum Content zu diesem Thema ${analysis.recommendation === 'positive' ? 'jetzt wichtig' : analysis.recommendation === 'caution' ? 'gut überlegt sein sollte' : 'sinnvoll'} ist.

Kontext:
- Trend-Status: ${analysis.status} (${analysis.icon})
- Aktuell: ${metrics.current}/100, Durchschnitt: ${metrics.avg}/100
- Aufsteigende Keywords: ${rising.map((r: RQ) => r.query).join(', ') || 'keine'}

Antworte NUR im obigen Format, nichts anderes!`;

    const result = streamText({
      model: google('gemini-2.5-flash'),
      prompt: prompt,
      temperature: 0.3,
    });

    // Wir bauen das HTML-Template und streamen die KI-Antwort
    // Die KI-Antwort wird dann im Frontend geparst
    
    // Stattdessen: Wir generieren das komplette HTML serverseitig und lassen die KI nur Texte liefern
    // Aber da wir streamen müssen, machen wir es anders:
    
    // Neuer Ansatz: Komplettes HTML mit Platzhaltern, KI füllt diese
    const htmlTemplate = `<div class="space-y-3">
<div class="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-3 text-white flex items-center justify-between">
<div><p class="text-indigo-200 text-[10px] uppercase tracking-wider font-medium">Trend-Analyse · ${countryName}</p><h2 class="text-base font-bold mt-0.5">${topic}</h2></div>
<div class="text-right"><span class="inline-block px-2 py-1 rounded text-[10px] font-bold ${badgeColor} text-white">${analysis.icon} ${analysis.status.toUpperCase()}</span></div>
</div>

<div class="grid grid-cols-4 gap-2">
<div class="bg-white border border-gray-200 rounded-lg p-2 text-center"><div class="text-xl font-bold text-gray-900">${metrics.current}</div><div class="text-[9px] text-gray-500 uppercase font-medium">Aktuell</div></div>
<div class="bg-white border border-gray-200 rounded-lg p-2 text-center"><div class="text-xl font-bold text-gray-900">${metrics.avg}</div><div class="text-[9px] text-gray-500 uppercase font-medium">Durchschnitt</div></div>
<div class="bg-white border border-gray-200 rounded-lg p-2 text-center"><div class="text-xl font-bold text-gray-900">${metrics.peak}</div><div class="text-[9px] text-gray-500 uppercase font-medium">Peak</div></div>
<div class="bg-white border border-gray-200 rounded-lg p-2 text-center"><div class="text-xl font-bold ${trendColor}">${trendPrefix}${metrics.change}%</div><div class="text-[9px] text-gray-500 uppercase font-medium">Trend</div></div>
</div>

<div class="grid grid-cols-2 gap-2">
<div class="bg-white border border-gray-200 rounded-lg p-3"><h4 class="text-[10px] font-bold text-gray-500 uppercase mb-2">🚀 Aufsteigende Keywords</h4>${risingHTML}</div>
<div class="bg-white border border-gray-200 rounded-lg p-3"><h4 class="text-[10px] font-bold text-gray-500 uppercase mb-2">🔝 Top Keywords</h4>${topHTML}</div>
</div>

<div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
<h4 class="text-[10px] font-bold text-amber-700 uppercase mb-2">💡 Alternative Keywords testen</h4>
<div class="flex flex-wrap gap-1" id="alternatives">`;

    // Zweiter Teil des Templates (nach KI-Content)
    const htmlTemplate2 = `</div>
</div>

<div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
<h4 class="text-[10px] font-bold text-indigo-700 uppercase mb-2">📝 Content-Ideen für ${domain}</h4>
<ul class="space-y-1 text-xs text-indigo-900" id="content-ideas">`;

    const htmlTemplate3 = `</ul>
</div>

<div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
<h4 class="text-[10px] font-bold text-gray-600 uppercase mb-2">🎯 Nächste Schritte</h4>
<div class="space-y-2" id="steps">`;

    const htmlTemplate4 = `</div>
</div>

${fazitStart}`;

    const htmlTemplate5 = `</p></div></div></div>

<p class="text-[10px] text-gray-400 text-center">📊 Daten: Google Trends · ${countryName} · ${new Date().toLocaleDateString('de-DE')}</p>
</div>`;

    // Wir müssen einen anderen Ansatz wählen - die KI soll direkt nutzbares HTML ausgeben
    // Neuer Prompt der HTML-Fragmente generiert

    const htmlPrompt = `Du bist ein HTML-Generator. Generiere NUR die HTML-Fragmente für einen Trend-Report.

WICHTIG: 
- Beginne SOFORT mit dem ersten HTML-Tag
- KEIN Markdown, KEINE Backticks, KEINE Codeblöcke
- NUR valides HTML mit Tailwind-Klassen

DATEN:
- Keyword: "${topic}"
- Region: ${countryName}
- Domain: ${domain}
- Status: ${analysis.icon} ${analysis.status}
- Metriken: Aktuell ${metrics.current}, Ø ${metrics.avg}, Peak ${metrics.peak}, Trend ${trendPrefix}${metrics.change}%
- Aufsteigende: ${rising.map((r: RQ) => r.query).join(', ') || 'keine'}
- Top: ${top.map((r: RQ) => r.query).join(', ') || 'keine'}

GENERIERE DIESES HTML (beginne direkt mit <div>):

<div class="space-y-3">

<div class="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-3 text-white flex items-center justify-between">
<div><p class="text-indigo-200 text-[10px] uppercase tracking-wider font-medium">Trend-Analyse · ${countryName}</p><h2 class="text-base font-bold mt-0.5">${topic}</h2></div>
<span class="px-2 py-1 rounded text-[10px] font-bold ${badgeColor} text-white">${analysis.icon} ${analysis.status.toUpperCase()}</span>
</div>

<div class="grid grid-cols-4 gap-2">
<div class="bg-white border border-gray-200 rounded-lg p-2 text-center"><div class="text-xl font-bold text-gray-900">${metrics.current}</div><div class="text-[9px] text-gray-500 uppercase">Aktuell</div></div>
<div class="bg-white border border-gray-200 rounded-lg p-2 text-center"><div class="text-xl font-bold text-gray-900">${metrics.avg}</div><div class="text-[9px] text-gray-500 uppercase">Ø</div></div>
<div class="bg-white border border-gray-200 rounded-lg p-2 text-center"><div class="text-xl font-bold text-gray-900">${metrics.peak}</div><div class="text-[9px] text-gray-500 uppercase">Peak</div></div>
<div class="bg-white border border-gray-200 rounded-lg p-2 text-center"><div class="text-xl font-bold ${trendColor}">${trendPrefix}${metrics.change}%</div><div class="text-[9px] text-gray-500 uppercase">Trend</div></div>
</div>

<div class="grid grid-cols-2 gap-2">
<div class="bg-white border border-gray-200 rounded-lg p-3">
<h4 class="text-[10px] font-bold text-gray-500 uppercase mb-2">🚀 Aufsteigend</h4>
${risingHTML}
</div>
<div class="bg-white border border-gray-200 rounded-lg p-3">
<h4 class="text-[10px] font-bold text-gray-500 uppercase mb-2">🔝 Top</h4>
${topHTML}
</div>
</div>

<div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
<h4 class="text-[10px] font-bold text-amber-700 uppercase mb-2">💡 Alternative Keywords</h4>
<div class="flex flex-wrap gap-1">
[GENERIERE 6 alternative Long-Tail Keywords als: <span class="bg-white text-amber-800 px-2 py-0.5 rounded text-[10px] border border-amber-200">Keyword</span>]
</div>
</div>

<div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
<h4 class="text-[10px] font-bold text-indigo-700 uppercase mb-2">📝 Content-Ideen</h4>
<ul class="space-y-1">
[GENERIERE 3 konkrete Blogpost-Titel als: <li class="text-xs text-indigo-900">• Titel</li>]
</ul>
</div>

<div class="bg-gray-50 border border-gray-200 rounded-lg p-3">
<h4 class="text-[10px] font-bold text-gray-600 uppercase mb-2">🎯 Nächste Schritte</h4>
<div class="space-y-1">
[GENERIERE 3 Aktionen als: <div class="flex gap-2 items-center"><span class="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">1</span><span class="text-xs text-gray-700">Aktion</span></div>]
</div>
</div>

${fazitStart}[GENERIERE kurzen Fazit-Text basierend auf ${analysis.status}]</p></div></div></div>

<p class="text-[10px] text-gray-400 text-center mt-2">📊 Google Trends · ${countryName}</p>

</div>

Ersetze alle [GENERIERE...] Platzhalter mit echtem Content. Beginne JETZT mit <div class="space-y-3">:`;

    const finalResult = streamText({
      model: google('gemini-2.5-flash'),
      prompt: htmlPrompt,
      temperature: 0.3,
    });

    return finalResult.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Fehler';
    console.error('❌ Trend Radar Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
