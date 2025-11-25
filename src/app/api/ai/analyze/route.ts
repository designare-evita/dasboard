import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai'; // ÄNDERUNG: generateText statt streamText importieren

// Konfiguration des Google Providers
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Runtime auf nodejs belassen oder edge, beides sollte mit generateText funktionieren
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Authentifizierung
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { projectId, dateRange } = await req.json();

    // 2. Daten laden
    const { rows } = await sql`
      SELECT id, email, domain, gsc_site_url, ga4_property_id 
      FROM users WHERE id::text = ${projectId}
    `;
    
    if (rows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const project = rows[0];
    const data = await getOrFetchGoogleData(project, dateRange);

    if (!data) {
      return NextResponse.json({ message: 'Keine Daten verfügbar' }, { status: 400 });
    }

    // 3. Prompt bauen
    const kpis = data.kpis;
    // Sicherheitscheck, falls kpis undefined sind
    if (!kpis) {
        return NextResponse.json({ message: 'Keine KPI Daten für Analyse vorhanden' }, { status: 400 });
    }

    const fmt = (val?: number) => val ? val.toLocaleString('de-DE') : '0';
    const change = (val?: number) => val ? val.toFixed(1) : '0';

    const summaryData = `
      Domain: ${project.domain}
      Zeitraum: ${dateRange}
      KPIs:
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Impressionen: ${fmt(kpis.impressions?.value)} (${change(kpis.impressions?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - Nutzer: ${fmt(kpis.totalUsers?.value)} (${change(kpis.totalUsers?.change)}%)
      
      Top Keywords:
      ${data.topQueries?.slice(0, 5).map((q: any) => `- ${q.query} (Pos: ${q.position.toFixed(1)})`).join('\n')}
    `;

    const prompt = `
      Du bist ein erfahrener SEO-Analyst. Interpretiere diese Daten kurz (max 3-4 Sätze):
      ${summaryData}
      
      Anweisungen:
      1. Erkläre die Hauptursache für Veränderungen.
      2. Gib EINEN konkreten Tipp.
      3. Sprich den Nutzer mit "Sie" an.
      4. Nutze Markdown für **fette** Begriffe.
    `;

    // 4. GENERIERUNG (BLOCKING)
    const { text } = await generateText({
      model: google('gemini-2.5-flash'), 
      prompt: prompt,
    });

    // ÄNDERUNG: Wir senden ein normales JSON zurück
    return NextResponse.json({ analysis: text });

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    // Hier wird der Fehler auch im Backend-Log sichtbar gemacht
    return NextResponse.json(
        { message: 'Analyse fehlgeschlagen', error: error instanceof Error ? error.message : String(error) }, 
        { status: 500 }
    );
  }
}
