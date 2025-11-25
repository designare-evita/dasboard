import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

// Konfiguration des Google Providers
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Runtime: 'nodejs' ist notwendig für die Datenbank-Verbindungen
export const runtime = 'nodejs';

// Hilfsfunktionen für konsistente Formatierung
const fmt = (val?: number) => (val ? val.toLocaleString('de-DE') : '0');
const change = (val?: number) => {
  if (val === undefined || val === null) return '0';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}`;
};

export async function POST(req: NextRequest) {
  try {
    // 1. Authentifizierung & Input Validierung
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { projectId, dateRange } = await req.json();

    if (!projectId || !dateRange) {
      return NextResponse.json({ message: 'Fehlende Parameter' }, { status: 400 });
    }

    // 2. Projektdaten laden
    const { rows } = await sql`
      SELECT id, email, domain, gsc_site_url, ga4_property_id 
      FROM users WHERE id::text = ${projectId}
    `;
    
    if (rows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const project = rows[0];
    
    // 3. Dashboard-Daten abrufen (Nutzt Cache falls vorhanden für Speed)
    const data = await getOrFetchGoogleData(project, dateRange);

    if (!data || !data.kpis) {
      return NextResponse.json({ message: 'Keine Daten verfügbar' }, { status: 400 });
    }

    const kpis = data.kpis;

    // 4. Daten für den Prompt aufbereiten (Kontextanreicherung)
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
      
      KPI ENTWICKLUNG:
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Impressionen: ${fmt(kpis.impressions?.value)} (${change(kpis.impressions?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - Nutzer: ${fmt(kpis.totalUsers?.value)} (${change(kpis.totalUsers?.change)}%)
      
      KONTEXT:
      - Top Kanäle: ${topChannels}
      - KI-Bot Traffic Anteil: ${aiShare}%
      
      TOP KEYWORDS:
      ${topKeywords}
    `;

    // 5. System Prompt & User Prompt trennen für bessere Ergebnisse
    const systemPrompt = `
      Du bist ein Senior SEO & Performance Consultant.
      Deine Aufgabe ist es, Web-Analyse-Daten für den Kunden "${project.domain}" prägnant zu interpretieren.
      
      STIL & RICHTLINIEN:
      - Sprich den Kunden direkt mit "Sie" an.
      - Sei professionell, datengestützt und komm sofort zum Punkt.
      - Nutze Markdown (**fett**) für wichtige KPIs.
      - Formatiere die Antwort in HTML-freundlichem Markdown.
    `;

    const userPrompt = `
      Analysiere diese Daten (max. 4-5 Sätze):
      ${summaryData}

      STRUKTUR DER ANTWORT:
      1. **Status:** Was ist die wichtigste positive oder negative Entwicklung? (Verbinde KPIs logisch, z.B. Impressionen vs Klicks).
      2. **Ursache:** Was ist der wahrscheinlichste Grund basierend auf Kanälen oder Keywords?
      3. **Handlung:** Gib EINEN konkreten, strategischen Handlungsschritt.
    `;

    // 6. Streaming starten (Das ist der Geschwindigkeits-Boost!)
    // Wir verwenden streamText statt generateText für sofortiges Feedback
    const result = streamText({
      model: google('gemini-2.5-flash'), // Flash Modell für maximale Geschwindigkeit
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Gibt einen Daten-Stream zurück, den das Frontend verarbeiten kann
    return result.toDataStreamResponse();

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json(
      { 
        message: 'Analyse fehlgeschlagen', 
        error: error instanceof Error ? error.message : String(error) 
      }, 
      { status: 500 }
    );
  }
}
