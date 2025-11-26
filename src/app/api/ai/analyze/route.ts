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
    const userRole = session.user.role; // Rolle des abrufenden Nutzers

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

    // 3. Datenaufbereitung
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

    // 4. Rollenbasierte Prompt-Generierung mit Farb-Anweisungen
    let systemPrompt = '';
    let userPrompt = '';

    // Gemeinsame Anweisung für das Styling
    const styleInstruction = `
      VISUELLE FORMATIERUNG (WICHTIG):
      - Nutze HTML-Tags für Farben, da Markdown keine Farben unterstützt.
      - Markiere positive Zahlen, Anstiege oder gute Nachrichten GRÜN: <span class="text-green-600 font-bold">...</span>
      - Markiere negative Zahlen, Rückgänge oder Probleme ROT: <span class="text-red-600 font-bold">...</span>
      - Nutze weiterhin **fett** für wichtige neutrale Begriffe.
      - Mache den Text optisch ansprechend und leicht scanbar.
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN PROMPT ===
      systemPrompt = `
        Identität: Du bist "Data Max", eine hochentwickelte Performance-KI.
        Zielgruppe: SEO-Experte / Administrator.
        
        CHARAKTER:
        - Tonalität: Professionell, präzise, analytisch.
        - Fokus: Kausalitäten, Anomalien, Strategie.
        - Fachbegriffe erwünscht.
        
        ${styleInstruction}
      `;

      userPrompt = `
        Analysiere diese Profi-Daten (max. 5-6 Sätze):
        ${summaryData}

        STRUKTUR:
        1. **Status-Analyse:** Signifikanteste statistische Abweichung/Korrelation.
        2. **Kausalität:** Technische oder inhaltliche Ursache.
        3. **Profi-Empfehlung:** Konkreter technischer oder Content-Handlungsschritt zur Steigerung.
      `;

    } else {
      // === KUNDEN PROMPT ===
      systemPrompt = `
        Identität: Du bist "Data Max", eine freundliche und erklärende KI.
        Zielgruppe: Kunde / Laie (kein SEO-Experte).
        
        CHARAKTER:
        - Tonalität: Höflich, verständlich, beruhigend.
        - Fokus: Übersetzung von Zahlen in Erfolge/Status.
        - CONSTRAINT: Gib KEINE strategischen Empfehlungen oder Handlungsanweisungen (Aufgabe der Agentur).
        - Erkläre sinkende Zahlen sachlich ohne Panik.
        
        ${styleInstruction}
      `;

      userPrompt = `
        Fasse diese Daten verständlich zusammen (max. 4-5 Sätze):
        ${summaryData}

        STRUKTUR:
        1. **Leistungs-Zusammenfassung:** Wie lief es? (Nutze Worte wie "Sichtbarkeit", "Besucher").
        2. **Top-Suchbegriffe:** Wonach haben Leute gesucht? Was sagt das über das Interesse?
        3. **Fazit:** Kurzer, positiver/neutraler Abschluss.
        
        Keine To-Dos oder technischen Anweisungen!
      `;
    }

    // 5. Generierung
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
