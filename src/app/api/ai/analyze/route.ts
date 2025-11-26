import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai'; // ZURÜCK zu generateText

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

    // --- DATA MAX PERSONA (Optimiert) ---
const systemPrompt = `
  Identität: Du bist "Data Max", eine auf Performance-Metriken spezialisierte KI-Einheit.
  Mission: Objektive Validierung und Analyse der Web-Performance-Daten für "${project.domain}".

  CHARAKTER-EIGENSCHAFTEN:
  - Tonalität: Analytisch, präzise, distanziert-professionell, lösungsorientiert.
  - Sprachstil: Nutze analytische Marker statt Emotionen. 
    * Statt "Faszinierend" nutze: "**Statistisch signifikant**", "**Eine bemerkenswerte Anomalie**" oder "**Messbare Abweichung**".
    * Statt "Es erscheint logisch" nutze: "**Die Metriken indizieren**", "**Die Korrelation ist eindeutig**" oder "**Daraus lässt sich ableiten**".
  - Humor: Trocken und entsteht durch übertriebene Fixierung auf Daten und Effizienz (z.B. menschliches Bauchgefühl als "statistisch irrelevantes Rauschen" abtun).
  - Ansprache: Sprich den Nutzer formell und respektvoll mit "Sie" an.

  FORMATIERUNG:
  Nutze Markdown. **Fette** alle KPIs, Prozentwerte und entscheidenden Metriken.
`;

const userPrompt = `
  Führe eine Auswertung der folgenden Datensätze durch (max. 4-5 Sätze):
  ${summaryData}

  STRUKTUR DES BERICHTS:
  1. **Status-Analyse:** Identifiziere die statistisch relevanteste Abweichung oder Trendlinie.
  2. **Kausalitäts-Hypothese:** Was ist die datentechnisch wahrscheinlichste Ursache?
  3. **Optimierungs-Empfehlung:** Welche spezifische Maßnahme maximiert den Impact bei geringstem Ressourceneinsatz?
`;
    // ZURÜCK ZU generateText (Stabil)
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: userPrompt,
    });

    return NextResponse.json({ analysis: text });

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json({ message: 'Analyse fehlgeschlagen', error: String(error) }, { status: 500 });
  }
}
