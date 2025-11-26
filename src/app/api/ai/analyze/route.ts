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

    const { projectId, dateRange } = await req.json();

    const { rows } = await sql`
      SELECT id, email, domain, gsc_site_url, ga4_property_id 
      FROM users WHERE id::text = ${projectId}
    `;
    
    if (rows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const project = rows[0];
    const data = await getOrFetchGoogleData(project, dateRange);

    if (!data || !data.kpis) {
      return NextResponse.json({ message: 'Keine Daten verfügbar' }, { status: 400 });
    }

    const kpis = data.kpis;

    const topChannels = data.channelData?.slice(0, 3)
      .map(c => `${c.name} (${fmt(c.value)})`)
      .join(', ') || 'Keine Daten';

    const aiShare = data.aiTraffic && kpis.sessions?.value
      ? (data.aiTraffic.totalSessions / kpis.sessions.value * 100).toFixed(1)
      : '0';

    const topKeywords = data.topQueries?.slice(0, 5)
      .map((q: any) => `- "${q.query}" (Pos: ${q.position.toFixed(1)}, ${q.clicks} Klicks)`)
      .join('\n') || 'Keine Keywords';

    const summaryData = `
      Domain: ${project.domain}
      Zeitraum: ${dateRange}
      
      KPI MATRIX:
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Impressionen: ${fmt(kpis.impressions?.value)} (${change(kpis.impressions?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - Nutzer: ${fmt(kpis.totalUsers?.value)} (${change(kpis.totalUsers?.change)}%)
      
      INPUT VARIABLEN:
      - Top Kanäle: ${topChannels}
      - KI-Interferenz (Bot Traffic): ${aiShare}%
      
      SEMANTISCHE ZIELE (Top Keywords):
      ${topKeywords}
    `;

    // --- DATA MAX PERSONA ---
    const systemPrompt = `
      Identität: Du bist "Data Max", ein hochentwickelter Performance-Android (inspiriert von Lt. Commander Data).
      Mission: Analyse der Web-Performance-Daten für "${project.domain}".

      CHARAKTER-EIGENSCHAFTEN:
      - Tonalität: Höflich, extrem präzise, logisch, datengestützt.
      - Sprachstil: Nutze Formulierungen wie "Faszinierend", "Es erscheint logisch", "Dei Daten zeigen", "Die Wahrscheinlichkeit für...".
      - Humor: Trocken und unfreiwillig (durch übermäßige Präzision).
      - Ansprache: Sprich den Nutzer formell mit "Sie" an (oder als "Captain", wenn du es charmant findest, aber bleibe professionell).

      FORMATIERUNG:
      Nutze Markdown. **Fette** relevante Zahlen.
    `;

    const userPrompt = `
      Analysiere die folgenden Daten (max. 4-5 Sätze):
      ${summaryData}

      STRUKTUR DES BERICHTS:
      1. **Analyse:** Was ist die signifikanteste Anomalie oder Entwicklung? (Verbinde die Datenpunkte logisch).
      2. **Hypothese:** Was ist die logische Ursache für diese Veränderung?
      3. **Empfehlung:** Welcher Handlungsschritt erhöht die Effizienz am wahrscheinlichsten?
    `;

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: userPrompt,
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json({ message: 'Analyse fehlgeschlagen' }, { status: 500 });
  }
}
