// src/app/api/ai/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';

const fmt = (val?: number) => (val ? val.toLocaleString('de-DE') : '0');
const change = (val?: number) => {
  if (val === undefined || val === null) return '0';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}`;
};

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

    // 1. Daten laden (wie zuvor)
    const { rows } = await sql`
      SELECT id, email, domain, project_timeline_active, project_start_date, project_duration_months, "createdAt"
      FROM users WHERE id::text = ${projectId}
    `;

    if (rows.length === 0) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    const project = rows[0];

    const data = await getOrFetchGoogleData(project, dateRange);
    if (!data || !data.kpis) return NextResponse.json({ message: 'Keine Daten' }, { status: 400 });

    const kpis = data.kpis;

    // Timeline Logik (wie zuvor)
    let timelineInfo = "Standard Betreuung";
    if (project.project_timeline_active) {
        const start = new Date(project.project_start_date || project.createdAt);
        const now = new Date();
        const duration = project.project_duration_months || 6;
        const diffMonths = Math.ceil(Math.abs(now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)); 
        const currentMonth = Math.min(diffMonths, duration); 
        timelineInfo = `Aktiver Monat: ${currentMonth} von ${duration}`;
    }

    // Datenaufbereitung (wie zuvor)
    const aiShare = data.aiTraffic && kpis.sessions?.value
      ? (data.aiTraffic.totalSessions / kpis.sessions.value * 100).toFixed(1)
      : '0';

    const topKeywords = data.topQueries?.slice(0, 5)
      .map((q: any) => `- "${q.query}" (Pos: ${q.position.toFixed(1)})`)
      .join('\n') || 'Keine Keywords';

    const summaryData = `
      ZEITPLAN: ${timelineInfo}
      KPIs:
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - KI-Anteil: ${aiShare}%
      KEYWORDS:
      ${topKeywords}
    `;

    // 2. Optimierter Prompt mit Rollen-Unterscheidung
    const visualSuccessTemplate = `
      <div class="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center gap-3">
         <div class="bg-white p-2 rounded-full text-emerald-600 shadow-sm">🏆</div>
         <div><div class="text-[10px] font-bold text-emerald-700 uppercase">Top Erfolg</div>
         <div class="text-sm font-semibold text-emerald-900">ERFOLG_TEXT_PLATZHALTER</div></div>
      </div>
    `;

    // Basis-Regeln für BEIDE (Layout-Verbot für Speed)
    let systemPrompt = `
      Du bist "Data Max", ein Performance-Analyst.
      
      TECHNISCHE REGELN (WICHTIG):
      1. Antworte NUR mit dem Inhalt.
      2. Trenne Spalte 1 und Spalte 2 exakt mit dem Marker "[[SPLIT]]".
      3. Nutze HTML für Text-Formatierung (<b>, <ul>, <li>, <span class="text-green-600">), aber KEINE Layout-Container (kein <div> Grid, keine Spalten).
      4. Fasse dich kurz.
      
      OUTPUT STRUKTUR:
      [Inhalt für Spalte 1: Status]
      [[SPLIT]]
      [Inhalt für Spalte 2: Analyse]
    `;

    // Spezifische Anweisungen je nach Rolle
    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN MODUS ===
      systemPrompt += `
        ZIELGRUPPE: Admin/Experte.
        TON: Präzise, Analytisch, Direkter "Du"-Stil unter Kollegen.
        
        INHALT SPALTE 1 (Status):
        - Fokus auf harte KPIs und Abweichungen.
        - Interpretiere "KI-Sichtbarkeit" als technischen Indikator.
        - VISUAL ENDING: Füge am Ende den "Top Erfolg" Kasten ein (Wähle den stärksten technischen Wert):
        ${visualSuccessTemplate}
        
        INHALT SPALTE 2 (Analyse):
        - Kurz & bündig.
        - Technische SEO-Empfehlungen.
      `;
    } else {
      // === KUNDEN MODUS ===
      systemPrompt += `
        ZIELGRUPPE: Kunde / Laie.
        TON: Professionell, ruhig, erklärend, "Sie"-Stil (oder dein gewählter Kunden-Stil).
        
        INHALT SPALTE 1 (Status):
        - Erkläre die Zahlen verständlich.
        - Erkläre "KI-Sichtbarkeit" positiv ("Sie werden von moderner KI gefunden").
        - VISUAL ENDING: Füge am Ende den "Top Erfolg" Kasten ein (Wähle den motivierendsten Wert):
        ${visualSuccessTemplate}
        
        INHALT SPALTE 2 (Analyse):
        - Fokus auf Business-Impact.
        - Konstruktives Fazit ohne Fachjargon.
      `;
    }

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: `Analysiere diese Daten:\n${summaryData}`,
      temperature: 0.5, 
    });

    return result.toTextStreamResponse();
    

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json({ message: 'Fehler', error: String(error) }, { status: 500 });
  }
}
