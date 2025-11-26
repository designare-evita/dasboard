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
      SELECT 
        id, email, domain, gsc_site_url, ga4_property_id,
        project_timeline_active, project_start_date, project_duration_months, "createdAt"
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

    // 3. Status-Daten berechnen (Wird nun auch für Kunden verwendet)
    let statusContext = "Standard Betreuung (Keine aktive Zeitlinie)";
    if (project.project_timeline_active) {
        const start = new Date(project.project_start_date || project.createdAt);
        const now = new Date();
        const duration = project.project_duration_months || 6;
        
        // Berechne vergangenen Monate
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)); 
        const currentMonth = Math.min(diffMonths, duration); 
        
        const endDate = new Date(start);
        endDate.setMonth(start.getMonth() + duration);

        statusContext = `
          Status: AKTIVE PROJEKT-LAUFZEIT
          Aktueller Monat: ${currentMonth} von ${duration}
          Start: ${start.toLocaleDateString('de-DE')}
          Geplantes Ende: ${endDate.toLocaleDateString('de-DE')}
          Fortschritt: ${Math.round((currentMonth / duration) * 100)}%
        `;
    }

    // 4. Datenaufbereitung
    const topChannels = data.channelData?.slice(0, 3)
      .map(c => `${c.name} (${fmt(c.value)})`)
      .join(', ') || 'Keine Kanal-Daten';

    const aiShare = data.aiTraffic && kpis.sessions?.value
      ? (data.aiTraffic.totalSessions / kpis.sessions.value * 100).toFixed(1)
      : '0';

    const topKeywords = data.topQueries?.slice(0, 5)
      .map((q: any) => `<li>"${q.query}" (Pos: ${q.position.toFixed(1)}, ${q.clicks} Klicks)</li>`)
      .join('') || '<li>Keine Keywords</li>';

    const summaryData = `
      PROJEKT STATUS INFOS:
      ${statusContext}

      DOMAIN DATEN (${project.domain}):
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

    // 5. Rollenbasierte Prompt-Generierung
    let systemPrompt = '';
    let userPrompt = '';
    
    const htmlRules = `
      ANTWORTE IN REINEM HTML (ohne Markdown-Codeblöcke):
      - Nutze <h4> für Überschriften.
      - Nutze <p> für Text.
      - Nutze <ul>/<li> für Listen.
      - Nutze Tailwind-Klassen für Farben: <span class="text-green-600 font-bold">...</span>
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN MODE ===
      systemPrompt = `
        Identität: "Data Max", Performance-KI für Experten.
        Ton: Präzise, Analytisch.
        
        REGELN:
        1. Positive Werte: <span class="text-green-600 font-bold">Grün</span>
        2. Negative Werte/Probleme: <span class="text-red-600 font-bold">Rot</span>
        
        ${htmlRules}
      `;
      userPrompt = `
        Analysiere für einen Experten:
        ${summaryData}

        STRUKTUR:
        <h4>Status-Analyse</h4> (Abweichungen inkl. Projekt-Fortschritt)
        <h4>Kausalität</h4> (Ursachen)
        <h4>Profi-Empfehlung</h4> (Technische Maßnahmen)
      `;
    } else {
      // === KUNDEN MODE ===
      systemPrompt = `
        Identität: "Data Max", freundlicher Assistent für Kunden.
        Ton: Höflich, Verständlich.
        
        REGELN:
        1. Positive Werte/Erfolge: <span class="text-green-600 font-bold">Grün</span>
        2. Negative Werte/Rückgänge: NEUTRAL darstellen (kein Rot, keine Warnfarben).
        3. KEINE Handlungsaufforderungen.
        
        ${htmlRules}
      `;

      // Hier fügen wir den Block "Projekt Status" für den Kunden hinzu
      userPrompt = `
        Fasse für den Kunden zusammen:
        ${summaryData}

        STRUKTUR:
        <h4>Projekt Status</h4> (Fasse hier sachlich den Status aus "PROJEKT STATUS INFOS" zusammen: Phase, Monat, Zeitraum, Domain. Ohne Wertung.)
        <h4>Leistungs-Überblick</h4> (Wie lief es? Hebe Erfolge grün hervor. Erkläre Rückgänge neutral.)
        <h4>Suchbegriffe</h4> (Was wurde gesucht?)
        <h4>Fazit</h4> (Positiver Abschluss)
      `;
    }

    // 6. Generierung
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: userPrompt,
    });

    return NextResponse.json({ analysis: text });

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json({ message: 'Fehler', error: String(error) }, { status: 500 });
  }
}
