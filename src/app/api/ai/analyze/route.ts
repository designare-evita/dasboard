// src/app/api/ai/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import crypto from 'node:crypto';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';

// Hilfsfunktionen
const fmt = (val?: number) => (val ? val.toLocaleString('de-DE') : '0');
const change = (val?: number) => {
  if (val === undefined || val === null) return '0';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}`;
};

function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, dateRange } = body;
    const userRole = session.user.role;

    if (!projectId || !dateRange) {
      return NextResponse.json({ message: 'Fehlende Parameter' }, { status: 400 });
    }

    // 1. Daten laden
    const { rows } = await sql`
      SELECT id, email, domain, project_timeline_active, project_start_date, project_duration_months, "createdAt"
      FROM users WHERE id::text = ${projectId}
    `;

    if (rows.length === 0) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    const project = rows[0];

    const data = await getOrFetchGoogleData(project, dateRange);
    if (!data || !data.kpis) return NextResponse.json({ message: 'Keine Daten' }, { status: 400 });

    const kpis = data.kpis;

    // Timeline Logik
    let timelineInfo = "";
    let startDateStr = "";
    let endDateStr = "";
    
    if (project.project_timeline_active) {
        const start = new Date(project.project_start_date || project.createdAt);
        const now = new Date();
        const duration = project.project_duration_months || 6;
        const diffMonths = Math.ceil(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)); 
        const currentMonth = Math.min(diffMonths, duration);
        
        const end = new Date(start);
        end.setMonth(start.getMonth() + duration);
        
        timelineInfo = `Aktiver Monat: ${currentMonth} von ${duration}`;
        startDateStr = start.toLocaleDateString('de-DE');
        endDateStr = end.toLocaleDateString('de-DE');
    } else {
        timelineInfo = "Laufende Betreuung";
        startDateStr = "Fortlaufend";
        endDateStr = "Offen";
    }

    // Datenaufbereitung
    const aiShare = data.aiTraffic && kpis.sessions?.value
      ? (data.aiTraffic.totalSessions / kpis.sessions.value * 100).toFixed(1)
      : '0';

    const topKeywords = data.topQueries?.slice(0, 5)
      .map((q: any) => `- "${q.query}" (Pos: ${q.position.toFixed(1)}, Klicks: ${q.clicks})`)
      .join('\n') || 'Keine Keywords';
      
    const topChannels = data.channelData?.slice(0, 3)
      .map(c => `${c.name} (${fmt(c.value)})`)
      .join(', ') || 'Keine Kanal-Daten';

    const summaryData = `
      DOMAIN: ${project.domain}
      ZEITPLAN STATUS: ${timelineInfo}
      START: ${startDateStr}
      ENDE: ${endDateStr}
      
      KPIs (Format: Wert (Veränderung%)):
      - Nutzer (Gesamt): ${fmt(kpis.totalUsers?.value)} (${change(kpis.totalUsers?.change)}%)
      - Klassische Besucher (Humans): ${fmt(Math.max(0, (kpis.totalUsers?.value || 0) - (data.aiTraffic?.totalUsers || 0)))}
      - Sichtbarkeit in KI-Systemen (AI Search): ${fmt(data.aiTraffic?.totalUsers || 0)}
      - Impressionen: ${fmt(kpis.impressions?.value)} (${change(kpis.impressions?.change)}%)
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - KI-Anteil am Traffic: ${aiShare}%
      
      TOP KEYWORDS:
      ${topKeywords}
      
      KANÄLE:
      ${topChannels}
    `;

    // --- CACHE LOGIK (48 Stunden) ---
    const cacheInputString = `${summaryData}|ROLE:${userRole}|V3_HTML_FIX`; // Hash Key geändert um Cache zu invalidieren
    const inputHash = createHash(cacheInputString);

    const { rows: cacheRows } = await sql`
      SELECT response 
      FROM ai_analysis_cache
      WHERE 
        user_id = ${projectId}::uuid 
        AND date_range = ${dateRange}
        AND input_hash = ${inputHash}
        AND created_at > NOW() - INTERVAL '48 hours'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (cacheRows.length > 0) {
      console.log('[AI Cache] ✅ HIT! Liefere gespeicherte Antwort.');
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(cacheRows[0].response));
          controller.close();
        },
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    // --- ENDE CACHE ---


    // 2. PROMPT SETUP (Strikes HTML Enforcement)
    
    const visualSuccessTemplate = `
      <div class="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-4 shadow-sm">
         <div class="bg-white p-2.5 rounded-full text-emerald-600 shadow-sm mt-1">🏆</div>
         <div><div class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Top Erfolg</div>
         <div class="text-sm font-semibold text-emerald-900 leading-relaxed">ERFOLG_TEXT_PLATZHALTER</div></div>
      </div>
    `;

    let systemPrompt = `
      Du bist "Data Max", ein Performance-Analyst.

      REGELN FÜR FORMATIERUNG (STRIKT BEFOLGEN):
      1. VERWENDE KEIN MARKDOWN. Keine Sternchen (*), keine Rauten (#), keine Bindestriche (-) für Listen.
      2. Nutze AUSSCHLIESSLICH HTML-Tags für die Struktur.
      
      ERLAUBTE HTML-STRUKTUR:
      - Absätze: <p class="mb-4 leading-relaxed text-gray-700">Dein Text...</p>
      - Überschriften: <h4 class="font-bold text-indigo-900 mt-6 mb-3 text-base flex items-center gap-2">Dein Titel</h4>
      - Listen: <ul class="space-y-2 mb-4 text-sm text-gray-600 list-none pl-1"> 
                  <li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span> <span>Dein Punkt</span></li> 
                </ul>
      - Hervorhebungen (Positiv): <span class="text-emerald-600 font-bold">
      - Hervorhebungen (Negativ/Kritisch): <span class="text-red-600 font-bold">
      - Hervorhebungen (Neutral/Wichtig): <span class="font-semibold text-gray-900">

      OUTPUT AUFBAU:
      [Inhalt Spalte 1]
      [[SPLIT]]
      [Inhalt Spalte 2]
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN MODUS ===
      systemPrompt += `
        ZIELGRUPPE: Admin/Experte. Ton: Analytisch, Kritisch.
        
        SPALTE 1 (Status & Zahlen):
        1. <h4...>Zeitplan:</h4>
           <ul...>
             <li...>Status: ...</li>
             <li...>Aktueller Monat: ...</li>
           </ul...>
        2. <h4...>Performance Kennzahlen:</h4> 
           <ul...>
             <li...>Liste alle KPIs. Färbe negative Trends (<0%) ROT (<span class="text-red-600 font-bold">). Positive neutral oder grün.</li>
           </ul...>
        3. VISUAL ENDING: ${visualSuccessTemplate} (Fülle ERFOLG_TEXT_PLATZHALTER mit dem stärksten technischen Wert).
        
        SPALTE 2 (Analyse):
        1. <h4...>Status-Analyse:</h4>
           <p...>Analysiere den Projektfortschritt kritisch. Nutze <b>fette rote Schrift</b> für Probleme.</p>
        2. <h4...>Handlungsempfehlung:</h4>
           <ul...>
             <li...>Konkrete technische Schritte (z.B. "Prüfe GSC Snippet für Keyword X").</li>
           </ul...>
      `;
    } else {

      // === KUNDEN MODUS ===
      systemPrompt += `
        ZIELGRUPPE: Kunde. Ton: Höflich, Positiv.
        
        SPALTE 1 (Status & Zahlen):
        1. <h4...>Projekt-Laufzeit:</h4> Start, Ende, Monat.
        2. <h4...>Aktuelle Leistung:</h4>
           <ul...>
             <li...>Nutzer & Klassische Besucher.
             <li...>KI-Sichtbarkeit: Füge hinzu: <br><span class="text-xs text-emerald-600 block mt-0.5">✔ Ihre Inhalte werden von KI (ChatGPT, Gemini) gefunden.</span>
           </ul...>
        3. VISUAL ENDING: ${visualSuccessTemplate}
        
        SPALTE 2 (Performance Analyse):
        1. Anrede: <p class="mb-4 font-medium">Sehr geehrte Kundin, sehr geehrter Kunde,</p>
        2. <h4...>Zusammenfassung:</h4> Fließtext über Erfolge.
        3. <h4...>Top Keywords & Relevanz:</h4> Analyse der Keywords.
      `;
    }

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: `Analysiere diese Daten für den Zeitraum ${dateRange}:\n${summaryData}`,
      temperature: 0.4, 
      onFinish: async ({ text }) => {
        if (text && text.length > 50) {
          try {
            await sql`
              INSERT INTO ai_analysis_cache (user_id, date_range, input_hash, response)
              VALUES (${projectId}::uuid, ${dateRange}, ${inputHash}, ${text})
            `;
          } catch (e) { console.error('Cache Error', e); }
        }
      }
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json({ message: 'Fehler', error: String(error) }, { status: 500 });
  }
}
