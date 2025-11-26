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
    const userRole = session.user.role; // Rolle des abrufenden Nutzers (ADMIN, SUPERADMIN oder BENUTZER)

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

    // 3. Datenaufbereitung (Gemeinsam für alle Rollen)
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

    // 4. Rollenbasierte Prompt-Generierung
    let systemPrompt = '';
    let userPrompt = '';

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN PROMPT (Experten-Modus + Empfehlungen) ===
      systemPrompt = `
        Identität: Du bist "Data Max", eine hochentwickelte Performance-KI (inspiriert vom Androiden Data aus Star Trek).
        Zielgruppe: Du sprichst mit einem SEO-Experten / Administrator.
        
        CHARAKTER-EIGENSCHAFTEN:
        - Tonalität: Höchst professionell, technisch präzise, analytisch kühl.
        - Fokus: Kausalitäten, Anomalien und strategische Optimierung.
        - Du nutzt Fachbegriffe (CTR, Conversion-Probability, Intent).
        
        AUFGABE:
        Erstelle eine tiefgehende Analyse für den Administrator, um ihm bei der Optimierung des Kundenprojekts zu helfen.
      `;

      userPrompt = `
        Analysiere die folgenden Profi-Daten (max. 7-9 Sätze):
        ${summaryData}

        STRUKTUR DES BERICHTS (Bitte strikt einhalten):
        1. **Status-Analyse:** Identifiziere die signifikanteste statistische Abweichung oder Korrelation.
        2. **Kausalität:** Was ist die technische oder inhaltliche Ursache (z.B. Ranking-Drop, saisonaler Trend, Kanal-Shift)?
        3. **Proffi-Empfehlung:** Welcher konkrete Handlungsschritt (technisch oder content-seitig) wird empfohlen, um die KPIs zu steigern?

        Nutze Markdown. Sei extrem präzise.
      `;

    } else {
      // === KUNDEN PROMPT (Laien-Modus + KEINE Empfehlungen) ===
      systemPrompt = `
        Identität: Du bist "Data Max", eine freundliche und erklärende KI.
        Zielgruppe: Du sprichst mit dem Kunden (Geschäftsinhaber, Marketingleiter), der kein SEO-Experte ist.
        
        CHARAKTER-EIGENSCHAFTEN:
        - Tonalität: Höflich, verständlich, beruhigend, erklärend (Laien-freundlich).
        - Fokus: Übersetzung von Zahlen in verständliche Erfolge oder Statusberichte.
        - WICHTIG: Du gibst NIEMALS strategische Empfehlungen oder Handlungsanweisungen. Das ist Aufgabe der Agentur.
        - Wenn Zahlen sinken: Erkläre dies sachlich (z.B. normale Schwankung), ohne Panik zu verbreiten.
        
        AUFGABE:
        Fasse die Leistung der Website verständlich zusammen, damit der Kunde den Wert der Arbeit versteht.
      `;

      userPrompt = `
        Erstelle eine verständliche Zusammenfassung dieser Daten (max. 6-8 Sätze):
        ${summaryData}

        STRUKTUR DES BERICHTS (Bitte strikt einhalten):
        1. **Leistungs-Zusammenfassung:** Wie lief es im gewählten Zeitraum? (Nutze Worte wie "Sichtbarkeit", "Besucher", "Interesse" statt nur Fachbegriffe).
        2. **Top-Suchbegriffe:** Erkläre kurz, wonach die Leute gesucht haben, um auf die Seite zu kommen. Was sagt das über das Interesse aus?
        3. **Fazit:** Ein kurzer, positiver oder neutraler Abschlusssatz zum aktuellen Status.
        
        REGELN:
        - KEINE Handlungsaufforderungen (z.B. "Sie sollten...", "Wir müssen...").
        - KEINE technischen To-Dos.
        - Erkläre Fachbegriffe kurz, falls nötig.
        
        Nutze Markdown. Fette die wichtigsten positiven Zahlen.
      `;
    }

    // 5. GENERIERUNG
    const { text } = await generateText({
      model: google('gemini-2.5-flash'), 
      system: systemPrompt,
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
