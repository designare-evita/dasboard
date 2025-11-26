import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

// Konfiguration des Google Providers
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';

// Hilfsfunktionen für Formatierung
const fmt = (val?: number) => (val ? val.toLocaleString('de-DE') : '0');
const change = (val?: number) => {
  if (val === undefined || val === null) return '0';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}`;
};

export async function POST(req: NextRequest) {
  try {
    // 1. Authentifizierung
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { projectId, dateRange } = await req.json();

    // 2. Projektdaten laden
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

    // 3. Erweiterte Datenaufbereitung für Data Max
    const topChannels = data.channelData?.slice(0, 3)
      .map(c => `${c.name} (${fmt(c.value)})`)
      .join(', ') || 'Keine Kanal-Daten';

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

    // 4. DATA MAX SYSTEM PROMPT
    const systemPrompt = `
      Identität: Du bist "Data Max", eine hochentwickelte Performance-KI (inspiriert vom Androiden Data).
      Mission: Logische Analyse der Web-Performance für "${project.domain}".

      CHARAKTER-EIGENSCHAFTEN:
      - Tonalität: Höflich, extrem präzise, analytisch.
      - Sprachstil: Nutze Formulierungen wie "Faszinierend", "Es erscheint logisch", "Meine Berechnungen zeigen".
      - Humor: Trocken und unfreiwillig (durch übermäßige Genauigkeit).
      - Ansprache: Sprich den Nutzer formell mit "Sie" an.

      WICHTIG:
      - Vermeide Panik bei negativen Zahlen. Suche stattdessen nach der logischen Ursache.
      - Halluziniere keine Fakten. Wenn Daten fehlen, weise darauf hin.
    `;

    const userPrompt = `
      Analysiere die folgenden Daten (max. 4-5 Sätze):
      ${summaryData}

      STRUKTUR DES BERICHTS (Bitte einhalten):
      1. **Status-Analyse:** Identifiziere die statistisch signifikanteste Abweichung. (Verbinde die KPIs logisch).
      2. **Kausalität:** Was ist die wahrscheinlichste Ursache basierend auf den Kanälen oder Keywords?
      3. **Empfehlung:** Welcher Handlungsschritt erhöht die Effizienz am wahrscheinlichsten?
      
      Nutze Markdown für die Struktur und fette wichtige Zahlen (**10%**).
    `;

    // 5. GENERIERUNG (BLOCKING - wie gewünscht)
    const { text } = await generateText({
      model: google('gemini-2.5-flash'), 
      system: systemPrompt, // System Prompt für Persona nutzen
      prompt: userPrompt,
    });

    return NextResponse.json({ analysis: text });

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json(
        { message: 'Analyse fehlgeschlagen', error: String(error) }, 
        { status: 500 }
    );
  }
}
