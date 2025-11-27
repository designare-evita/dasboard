// src/app/api/ai/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import crypto from 'node:crypto'; // Für den Hash

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

/**
 * Erstellt einen SHA-256 Hash aus einem String.
 * Dient als Fingerabdruck für die Eingabedaten.
 */
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
    let timelineInfo = "Standard Betreuung";
    if (project.project_timeline_active) {
        const start = new Date(project.project_start_date || project.createdAt);
        const now = new Date();
        const duration = project.project_duration_months || 6;
        const diffMonths = Math.ceil(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)); 
        const currentMonth = Math.min(diffMonths, duration); 
        timelineInfo = `Aktiver Monat: ${currentMonth} von ${duration}`;
    }

    // Datenaufbereitung
    const aiShare = data.aiTraffic && kpis.sessions?.value
      ? (data.aiTraffic.totalSessions / kpis.sessions.value * 100).toFixed(1)
      : '0';

    const topKeywords = data.topQueries?.slice(0, 5)
      .map((q: any) => `- "${q.query}" (Pos: ${q.position.toFixed(1)})`)
      .join('\n') || 'Keine Keywords';

    // Dieser String enthält ALLE Fakten, die die KI sieht.
    const summaryData = `
      DOMAIN: ${project.domain}
      ZEITPLAN: ${timelineInfo}
      KPIs:
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - KI-Anteil: ${aiShare}%
      KEYWORDS:
      ${topKeywords}
    `;

    // --- CACHE LOGIK START (48 Stunden) ---
    
    const cacheInputString = `${summaryData}|ROLE:${userRole}`;
    const inputHash = createHash(cacheInputString);

    console.log('[AI Cache] Checking Hash:', inputHash);

    // Prüfen, ob wir einen aktuellen Eintrag in der DB haben (jünger als 48h)
    const { rows: cacheRows } = await sql`
      SELECT response 
      FROM ai_analysis_cache
      WHERE 
        user_id = ${projectId}::uuid 
        AND date_range = ${dateRange}
        AND input_hash = ${inputHash}
        AND created_at > NOW() - INTERVAL '48 hours' -- HIER AUF 48 STUNDEN GESETZT
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (cacheRows.length > 0) {
      console.log('[AI Cache] ✅ HIT! Liefere gespeicherte Antwort.');
      const cachedResponse = cacheRows[0].response;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(cachedResponse));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    console.log('[AI Cache] ❌ MISS. Generiere neu...');
    // --- CACHE LOGIK ENDE ---


    // 2. Prompting
    const visualSuccessTemplate = `
      <div class="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center gap-3">
         <div class="bg-white p-2 rounded-full text-emerald-600 shadow-sm">🏆</div>
         <div><div class="text-[10px] font-bold text-emerald-700 uppercase">Top Erfolg</div>
         <div class="text-sm font-semibold text-emerald-900">ERFOLG_TEXT_PLATZHALTER</div></div>
      </div>
    `;

    let systemPrompt = `
      Du bist "Data Max", ein Performance-Analyst.
      
      TECHNISCHE REGELN:
      1. Antworte NUR mit dem Inhalt.
      2. Trenne Spalte 1 und Spalte 2 exakt mit dem Marker "[[SPLIT]]".
      3. Nutze HTML für Text-Formatierung (<b>, <ul>, <li>, <span class="text-green-600">), aber KEINE Layout-Container.
      4. Fasse dich kurz.
      
      OUTPUT STRUKTUR:
      [Inhalt für Spalte 1: Status]
      [[SPLIT]]
      [Inhalt für Spalte 2: Analyse]
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      systemPrompt += `
        ZIELGRUPPE: Admin/Experte.
        TON: Präzise, Analytisch, "Du"-Stil.
        INHALT SPALTE 1: Fokus auf harte KPIs. Interpretiere "KI-Sichtbarkeit" technisch.
        VISUAL ENDING SPALTE 1: Füge am Ende den "Top Erfolg" Kasten ein (Wähle den stärksten technischen Wert):
        ${visualSuccessTemplate}
      `;
    } else {
      systemPrompt += `
        ZIELGRUPPE: Kunde.
        TON: Professionell, ruhig, "Sie"-Stil.
        INHALT SPALTE 1: Erkläre Zahlen verständlich. Verkaufe "KI-Sichtbarkeit" positiv.
        VISUAL ENDING SPALTE 1: Füge am Ende den "Top Erfolg" Kasten ein (Wähle den motivierendsten Wert):
        ${visualSuccessTemplate}
      `;
    }

    // 3. Streaming mit onFinish Callback zum Speichern
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: `Analysiere diese Daten:\n${summaryData}`,
      temperature: 0.5,
      onFinish: async ({ text }) => {
        if (text && text.length > 50) {
          try {
            console.log('[AI Cache] Speichere neue Antwort...');
            await sql`
              INSERT INTO ai_analysis_cache (user_id, date_range, input_hash, response)
              VALUES (${projectId}::uuid, ${dateRange}, ${inputHash}, ${text})
            `;
          } catch (e) {
            console.error('[AI Cache] Fehler beim Speichern:', e);
          }
        }
      }
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json({ message: 'Fehler', error: String(error) }, { status: 500 });
  }
}
