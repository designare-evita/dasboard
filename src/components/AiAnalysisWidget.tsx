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
    const userRole = session.user.role;

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
      .map((q: any) => `<li>"${q.query}" (Pos: ${q.position.toFixed(1)}, ${q.clicks} Klicks)</li>`)
      .join('') || '<li>Keine Keywords verfügbar</li>';

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
      
      TOP KEYWORDS (HTML Liste):
      <ul>${topKeywords}</ul>
    `;

    // 4. Rollenbasierte Prompt-Generierung
    let systemPrompt = '';
    let userPrompt = '';

    // Gemeinsame HTML-Anweisungen
    const htmlInstructions = `
      FORMATIERUNG (HTML ONLY):
      - Antworte NICHT in Markdown. Antworte in reinem HTML.
      - Nutze <p class="mb-3"> für Absätze.
      - Nutze <strong> für Hervorhebungen.
      - Nutze <ul class="list-disc pl-5 mb-3 space-y-1"> und <li> für Listen.
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN MODE ===
      systemPrompt = `
        Identität: "Data Max", Performance-KI für Experten.
        Ton: Präzise, Analytisch.
        
        FARB-REGELN (HTML classes):
        - Positive Werte/Trends: <span class="text-green-600 font-bold">...</span>
        - Negative Werte/Probleme: <span class="text-red-600 font-bold">...</span>
        
        ${htmlInstructions}
      `;

      userPrompt = `
        Analysiere die Daten für einen Experten:
        ${summaryData}

        STRUKTUR:
        1. <h4 class="font-bold text-gray-900 mt-2">Status-Analyse</h4> (Signifikante Abweichungen)
        2. <h4 class="font-bold text-gray-900 mt-2">Kausalität</h4> (Ursachenforschung)
        3. <h4 class="font-bold text-gray-900 mt-2">Profi-Empfehlung</h4> (Konkrete technische Maßnahmen)
      `;

    } else {
      // === KUNDEN MODE ===
      systemPrompt = `
        Identität: "Data Max", freundlicher Assistent für Kunden.
        Ton: Höflich, Verständlich, Ermutigend.
        
        WICHTIGE REGELN:
        1. KEINE roten Farben/Warnungen für negative Zahlen. Stelle Rückgänge neutral dar (nur Text oder <strong>).
        2. Nutze <span class="text-green-600 font-bold">...</span> NUR für positive Entwicklungen und Erfolge.
        3. KEINE Handlungsaufforderungen an den Kunden.
        
        ${htmlInstructions}
      `;

      userPrompt = `
        Fasse die Leistung für den Kunden zusammen:
        ${summaryData}

        STRUKTUR:
        1. <h4 class="font-bold text-gray-900 mt-2">Leistungs-Überblick</h4> (Wie lief es? Hebe Erfolge grün hervor.)
        2. <h4 class="font-bold text-gray-900 mt-2">Suchbegriffe</h4> (Was wurde gesucht?)
        3. <h4 class="font-bold text-gray-900 mt-2">Fazit</h4> (Kurzer, positiver Abschluss)
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
