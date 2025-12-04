// src/app/api/ai/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import crypto from 'node:crypto';
import type { User } from '@/lib/schemas'; 

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
      SELECT *
      FROM users WHERE id::text = ${projectId}
    `;

    if (rows.length === 0) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    
    // Expliziter Cast zu User
    const project = rows[0] as unknown as User;

    const data = await getOrFetchGoogleData(project, dateRange);
    if (!data || !data.kpis) return NextResponse.json({ message: 'Keine Daten' }, { status: 400 });

    const kpis = data.kpis;

    // Timeline Logik
    let timelineInfo = "";
    let startDateStr = "";
    let endDateStr = "";
    
    if (project.project_timeline_active) {
        const start = new Date(project.project_start_date || project.createdAt || new Date());
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

    // --- KEYWORD ANALYSE (NEU) ---
    const allQueries = data.topQueries || [];

    // 1. Top Traffic Bringer (Die Gewinner)
    const topTraffic = allQueries.slice(0, 5)
      .map((q: any) => `- "${q.query}" (Pos: ${q.position.toFixed(1)}, Klicks: ${q.clicks})`)
      .join('\n') || 'Keine Keywords';

    // 2. SEO Chancen (Hohes Suchvolumen, aber Position 4-20)
    // Das sind die "Low Hanging Fruits"
    const seoOpportunities = allQueries
      .filter((q: any) => q.position > 3 && q.position < 21) // Seite 1 unten bis Seite 2
      .sort((a: any, b: any) => b.impressions - a.impressions) // Sortiert nach Potenzial (Impressionen)
      .slice(0, 5)
      .map((q: any) => `- "${q.query}" (Potenzial! Pos: ${q.position.toFixed(1)}, Impr: ${q.impressions})`)
      .join('\n') || 'Keine spezifischen Chancen erkannt.';

    // --- ENDE KEYWORD ANALYSE ---

    const topConverters = data.topConvertingPages
      ?.filter((p: any) => {
         const path = p.path.toLowerCase();
         const isStandardExcluded = 
            path.includes('danke') || 
            path.includes('thank') || 
            path.includes('success') || 
            path.includes('confirmation') ||
            path.includes('impressum') ||
            path.includes('datenschutz') ||
            path.includes('widerruf') ||
            path.includes('agb');

         const isTechnical = 
            path.includes('search') ||
            path.includes('suche') ||
            path.includes('404') ||
            path.includes('undefined');

         return !isStandardExcluded && !isTechnical;
      })
      .map((p: any) => {
         if (p.conversions > 0) {
           return `- "${p.path}": ${p.conversions} Conv. (Rate: ${p.conversionRate}%, Eng: ${p.engagementRate}%)`;
         } else {
           return `- "${p.path}": ${p.engagementRate}% Engagement (bei 0 Conversions)`;
         }
      })
      .slice(0, 10)
      .join('\n') || 'Keine relevanten Content-Daten verfügbar.';
      
    const topChannels = data.channelData?.slice(0, 3)
      .map((c: any) => `${c.name} (${fmt(c.value)})`)
      .join(', ') || 'Keine Kanal-Daten';

    const summaryData = `
      DOMAIN: ${project.domain}
      ZEITPLAN STATUS: ${timelineInfo}
      START: ${startDateStr}
      ENDE: ${endDateStr}
      
      KPIs (Format: Wert (Veränderung%)):
      - Nutzer (Gesamt): ${fmt(kpis.totalUsers?.value)} (${change(kpis.totalUsers?.change)}%)
      - Klassische Besucher: ${fmt(Math.max(0, (kpis.totalUsers?.value || 0) - (data.aiTraffic?.totalUsers || 0)))}
      - Sichtbarkeit in KI-Systemen: ${fmt(data.aiTraffic?.totalUsers || 0)}
      - Impressionen: ${fmt(kpis.impressions?.value)} (${change(kpis.impressions?.change)}%)
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - Conversions: ${fmt(kpis.conversions?.value)} (${change(kpis.conversions?.change)}%)
      - Interaktionsrate: ${fmt(kpis.engagementRate?.value)}%
      - KI-Anteil am Traffic: ${aiShare}%
      
      TOP KEYWORDS (Aktueller Traffic):
      ${topTraffic}

      SEO CHANCEN (Verstecktes Potenzial - Hohe Nachfrage, Ranking verbesserungswürdig):
      ${seoOpportunities}

      TOP CONVERSION TREIBER (RELEVANTE LANDINGPAGES):
      ${topConverters}
      
      KANÄLE:
      ${topChannels}
    `;

    // --- CACHE LOGIK ---
    const cacheInputString = `${summaryData}|ROLE:${userRole}|V6_SEO_OPPS`; // Cache Key Update
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


    // 2. PROMPT SETUP
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
      1. VERWENDE KEIN MARKDOWN.
      2. Nutze AUSSCHLIESSLICH HTML-Tags.
      
      ERLAUBTE HTML-STRUKTUR:
      - Absätze: <p class="mb-4 leading-relaxed text-gray-700">Dein Text...</p>
      - Überschriften: <h4 class="font-bold text-indigo-900 mt-6 mb-3 text-base flex items-center gap-2">Dein Titel</h4>
      - Listen: <ul class="space-y-2 mb-4 text-sm text-gray-600 list-none pl-1"> 
                  <li class="flex gap-2"><span class="text-indigo-400 mt-1">•</span> <span>Dein Punkt</span></li> 
                </ul>
      - Positiv: <span class="text-emerald-600 font-bold">
      - Negativ: <span class="text-red-600 font-bold">
      - Wichtig: <span class="font-semibold text-gray-900">

      OUTPUT AUFBAU:
      [Inhalt Spalte 1]
      [[SPLIT]]
      [Inhalt Spalte 2]
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN MODUS ===
      systemPrompt += `
        ZIELGRUPPE: Admin/Experte. Ton: Analytisch.
        
        SPALTE 1 (Status & Zahlen):
        1. <h4...>Zeitplan:</h4> Status, Monat.
        2. <h4...>Performance Kennzahlen:</h4> 
           <ul...>
             <li...>Liste alle KPIs.
             <li...>Negative Trends ROT.
           </ul...>
        3. VISUAL ENDING: ${visualSuccessTemplate}
        
        SPALTE 2 (Analyse & SEO):
        1. <h4...>Status-Analyse:</h4> Kritische Analyse.
        2. <h4...>SEO-Chancen (WICHTIG):</h4> Analysiere die "SEO CHANCEN" Daten. Nenne konkrete Keywords mit hohem Potenzial (Impressionen vs. Position) und empfiehl Optimierungen für diese.
        3. <h4...>Conversion Analyse:</h4> Welche Seiten bringen Umsatz?
      `;
    } else {
      // === KUNDEN MODUS ===
      systemPrompt += `
        ZIELGRUPPE: Kunde. Ton: Höflich, Positiv, Verständlich.
        
        SPALTE 1 (Status & Zahlen):
        1. <h4...>Projekt-Laufzeit:</h4> Start, Ende, Monat.
        2. <h4...>Aktuelle Leistung:</h4>
           <ul...>
             <li...>Nutzer & Klassische Besucher.
             <li...>Conversions & Engagement.
             <li...>KI-Sichtbarkeit: Füge hinzu: <br><span class="text-xs text-emerald-600 block mt-0.5">✔ Ihre Inhalte werden von KI (ChatGPT, Gemini) gefunden.</span>
           </ul...>
        3. VISUAL ENDING: ${visualSuccessTemplate}
        
        SPALTE 2 (Performance Analyse):
        1. Anrede: <p class="mb-4 font-medium">Sehr geehrte Kundin, sehr geehrter Kunde,</p>
        2. <h4...>Zusammenfassung:</h4> Fließtext über Erfolge.
        3. <h4...>Top Seiten & Themen:</h4> Nenne die erfolgreichsten Seiten.
        4. <h4...>Wachstumspotenzial:</h4> Erwähne 1-2 "SEO Chancen" (Keywords) aus den Daten, wo mit wenig Aufwand mehr Besucher möglich sind (Erkläre es einfach: "Hier suchen viele Leute, wir sind knapp vor Seite 1").
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
