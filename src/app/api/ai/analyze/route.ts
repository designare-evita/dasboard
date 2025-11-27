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
      - Klassische Besucher: ${fmt(Math.max(0, (kpis.totalUsers?.value || 0) - (data.aiTraffic?.totalUsers || 0)))}
      - Bot-Traffic (KI): ${fmt(data.aiTraffic?.totalUsers || 0)}
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
    const cacheInputString = `${summaryData}|ROLE:${userRole}|V2_DETAIL`; // V2_DETAIL hinzugefügt um alten Cache ungültig zu machen
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


    // 2. PROMPT SETUP (Detail-Modus)
    
    const visualSuccessTemplate = `
      <div class="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-4 shadow-sm">
         <div class="bg-white p-2.5 rounded-full text-emerald-600 shadow-sm mt-1">🏆</div>
         <div><div class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Top Erfolg</div>
         <div class="text-sm font-semibold text-emerald-900 leading-relaxed">ERFOLG_TEXT_PLATZHALTER</div></div>
      </div>
    `;

    let systemPrompt = `
      Du bist "Data Max", ein hochspezialisierter Performance-Analyst für SEO & Web-Daten.
      
      TECHNISCHE ANWEISUNGEN:
      1. Antworte NUR mit dem Inhalt.
      2. Trenne Spalte 1 und Spalte 2 exakt mit dem Marker "[[SPLIT]]".
      3. Nutze HTML-Tags für Struktur und Tailwind-Klassen für Styling.
      
      STYLING REGELN (WICHTIG):
      - Überschriften: <h4 class="font-bold text-indigo-900 mt-4 mb-2 text-base">
      - Listen: <ul class="space-y-1.5 mb-4 text-sm text-indigo-900/80">
      - Fettgedruckte Werte: <span class="font-semibold text-indigo-950">
      
      OUTPUT STRUKTUR:
      [Inhalt für Spalte 1: Status & Zahlen]
      [[SPLIT]]
      [Inhalt für Spalte 2: Performance Analyse]
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN MODUS (Detailliert & Kritisch) ===
      systemPrompt += `
        ZIELGRUPPE: Admin/Experte.
        TON: Analytisch, Kritisch, "Du"-Stil. Warne bei negativen Trends deutlich.
        
        INHALT SPALTE 1 (Status):
        1. Überschrift "Zeitplan:". Liste Status, aktueller Monat, Start, Ende.
        2. Überschrift "Aktuelle Performance Kennzahlen:". 
           - Liste ALLE KPIs auf.
           - WICHTIG: Wenn ein Trend negativ ist (z.B. -20%), färbe ihn ROT und FETT: <span class="text-red-600 font-bold">(-20%)</span>.
           - Wenn positiv, neutral lassen oder grün.
        3. Überschrift "Top Kanäle:". Liste die Kanäle auf.
        4. VISUAL ENDING: ${visualSuccessTemplate} (Fülle mit dem technisch stärksten Keyword oder Wachstum).
        
        INHALT SPALTE 2 (Analyse):
        1. Überschrift "Status-Analyse:".
        2. Fließtext: Analysiere den aktuellen Projektfortschritt.
        3. Nutze fette rote Markierungen im Text für Probleme (<span class="text-red-600 font-bold">...</span>) und grüne für Erfolge (<span class="text-green-600 font-bold">...</span>).
        4. Erwähne explizit Bot-Traffic vs. echte Nutzer.
        5. Gebe konkrete Handlungsanweisungen basierend auf den Keywords.
      `;
    } else {
      // === KUNDEN MODUS (Erklärend & Positiv) ===
      systemPrompt += `
        ZIELGRUPPE: Kunde / Geschäftsführer.
        TON: Höflich ("Sie"), Erklärend, Positiv, Zukunftsorientiert.
        
        INHALT SPALTE 1 (Status):
        1. Überschrift "Projekt-Laufzeit:". Liste Status, Monat, Start, Ende.
        2. Überschrift "Aktuelle Leistung:".
           - Liste "Nutzer (Gesamt)", "Klassische Besucher" und "KI-Sichtbarkeit".
           - Füge unter KI-Sichtbarkeit einen kurzen Satz in <span class="text-xs text-indigo-600 block mt-0.5"> ein: "Ihre Inhalte werden von modernen KI-Systemen gefunden."
           - Liste Impressionen und Trend. Färbe positive Trends GRÜN: <span class="text-green-600 font-bold">...</span>.
        3. VISUAL ENDING: ${visualSuccessTemplate} (Fülle mit einer motivierenden Erfolgsmeldung, z.B. hohe Reichweite).
        
        INHALT SPALTE 2 (Analyse):
        1. Beginne mit einer persönlichen Anrede (Sehr geehrte Kundin/Kunde).
        2. Überschrift "Erfolgreiche Kanäle & Sichtbarkeit:".
           - Beschreibe die Traffic-Quellen im Fließtext.
           - Hebe positive Zahlen grün und fett hervor (<span class="text-green-600 font-bold">...</span>).
           - Erkläre den Vorteil der KI-Sichtbarkeit (Zukunftssicherheit).
        3. Überschrift "Top Keywords – Fokus auf Relevanz:".
           - Liste die besten 3-4 Keywords auf und kommentiere deren Position kurz.
      `;
    }

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: `Analysiere diese Daten für den Zeitraum ${dateRange}:\n${summaryData}`,
      temperature: 0.4, // Etwas kreativer für bessere Texte, aber strukturiert
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
