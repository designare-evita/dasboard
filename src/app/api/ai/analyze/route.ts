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
    
    // 3. Dashboard-Daten abrufen (aus Cache oder live)
    const data = await getOrFetchGoogleData(project, dateRange);

    if (!data || !data.kpis) {
      return NextResponse.json({ message: 'Keine Daten verfügbar' }, { status: 400 });
    }

    const kpis = data.kpis;

    // --- OPTIMIERUNG START: Erweiterte Datenaufbereitung ---

    // Hilfsfunktionen für Formatierung (Deutsch)
    const fmt = (val?: number) => val ? val.toLocaleString('de-DE') : '0';
    const change = (val?: number) => {
      if (val === undefined || val === null) return '0';
      const prefix = val > 0 ? '+' : '';
      return `${prefix}${val.toFixed(1)}`;
    };

    // Top 3 Kanäle extrahieren (z.B. Organic Search, Direct, etc.)
    const topChannels = data.channelData?.slice(0, 3)
      .map(c => `${c.name} (${c.value.toLocaleString('de-DE')})`)
      .join(', ') || 'Keine Kanal-Daten';

    // KI-Traffic Anteil berechnen
    const aiShare = data.aiTraffic && kpis.sessions?.value
      ? (data.aiTraffic.totalSessions / kpis.sessions.value * 100).toFixed(1)
      : '0';

    // Zusammenfassung der Daten für den Prompt
    const summaryData = `
      Domain: ${project.domain}
      Zeitraum: ${dateRange}
      
      WICHTIGE KPIs (Vergleich zum Vorzeitraum):
      - SEO Klicks (GSC): ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - SEO Impressionen (GSC): ${fmt(kpis.impressions?.value)} (${change(kpis.impressions?.change)}%)
      - Website Sitzungen (GA4): ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - Nutzer (GA4): ${fmt(kpis.totalUsers?.value)} (${change(kpis.totalUsers?.change)}%)
      
      TRAFFIC KONTEXT:
      - Top Kanäle: ${topChannels}
      - Anteil KI-Bot Traffic (z.B. ChatGPT): ${aiShare}%
      
      TOP 5 KEYWORDS (Ranking):
      ${data.topQueries?.slice(0, 5).map((q: any) => `- "${q.query}" (Pos: ${q.position.toFixed(1)}, ${q.clicks} Klicks)`).join('\n')}
    `;

    // Erweiterter System-Prompt ("Persona")
    const prompt = `
      Du bist ein Senior SEO & Performance Consultant für die Domain "${project.domain}".
      Deine Aufgabe ist es, die folgenden Leistungsdaten für den Kunden prägnant zu interpretieren.

      DATEN:
      ${summaryData}

      AUFGABE (Maximal 4 Sätze):
      Erstelle eine Management-Summary für den Kunden.
      1. **Analyse:** Was ist die auffälligste Entwicklung? (Verbinde KPIs logisch, z.B. "Mehr Impressionen aber weniger Klicks deuten auf CTR-Probleme hin").
      2. **Ursache:** Nenne eine wahrscheinliche Ursache basierend auf den Daten (z.B. Kanal-Verschiebungen, KI-Traffic oder Ranking-Veränderungen).
      3. **Handlung:** Gib EINEN konkreten, strategischen Handlungsschritt ("Call to Action").
      
      STIL & FORMAT:
      - Sprich den Kunden direkt mit "Sie" an.
      - Sei professionell, datengestützt und auf den Punkt.
      - Nutze **fette Schrift** für wichtige Kennzahlen und Erkenntnisse.
      - Starte direkt mit der Analyse, ohne Einleitung wie "Hier ist die Analyse".
    `;

    // --- OPTIMIERUNG ENDE ---

    // 4. Generierung starten (Wir warten auf das Ergebnis -> kein Streaming)
    const { text } = await generateText({
      model: google('gemini-2.5-flash'), // Modell auf 2.5-flash gesetzt (Standard)
      prompt: prompt,
    });

    // 5. JSON Antwort zurückgeben
    return NextResponse.json({ analysis: text });

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
