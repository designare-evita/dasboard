import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialisierung von Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    // 1. Authentifizierung
    const session = await auth();
    if (!session?.user) return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });

    const { projectId, dateRange } = await req.json();

    // 2. Projektdaten laden
    const { rows } = await sql`
      SELECT id, email, domain, gsc_site_url, ga4_property_id 
      FROM users WHERE id::text = ${projectId}
    `;
    const project = rows[0];

    // 3. Die "echten" Dashboard-Daten laden (nutzt den Cache!)
    const data = await getOrFetchGoogleData(project, dateRange);

    if (!data) {
      return NextResponse.json({ message: 'Keine Daten für Analyse verfügbar' }, { status: 400 });
    }

    // 4. Daten für den Prompt aufbereiten (Zusammenfassung)
    const kpis = data.kpis;
    
    // Hilfsfunktion für sichere Werte
    const fmt = (val?: number) => val ? val.toLocaleString('de-DE') : '0';
    const change = (val?: number) => val ? val.toFixed(1) : '0';

    const summaryData = `
      Domain: ${project.domain}
      Zeitraum: ${dateRange}
      
      KPIs:
      - Klicks (GSC): ${fmt(kpis?.clicks?.value)} (Änderung: ${change(kpis?.clicks?.change)}%)
      - Impressionen (GSC): ${fmt(kpis?.impressions?.value)} (Änderung: ${change(kpis?.impressions?.change)}%)
      - Sitzungen (GA4): ${fmt(kpis?.sessions?.value)} (Änderung: ${change(kpis?.sessions?.change)}%)
      - Nutzer (GA4): ${fmt(kpis?.totalUsers?.value)} (Änderung: ${change(kpis?.totalUsers?.change)}%)
      
      Top Suchbegriffe (Position):
      ${data.topQueries?.slice(0, 5).map(q => `- "${q.query}" (Pos: ${q.position.toFixed(1)}, Klicks: ${q.clicks})`).join('\n')}
    `;

    // 5. Gemini Pro aufrufen
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      Du bist ein erfahrener SEO-Analyst für das Dashboard "Data Peak".
      Deine Aufgabe ist es, die folgenden Web-Performance-Daten kurz und prägnant zu interpretieren.

      Daten:
      ${summaryData}

      Anweisungen:
      1. Analysiere die Korrelation zwischen Klicks, Impressionen und Sitzungen.
      2. Identifiziere die Hauptursache für Auffälligkeiten (z.B. "Sichtbarkeit gestiegen, aber Klicks gesunken -> schlechte CTR").
      3. Gib EINEN konkreten, handlungsrelevanten Tipp für den Nutzer.
      4. Fasse dich kurz (maximal 3-4 Sätze).
      5. Sprich den Nutzer direkt und professionell an ("Sie...").
      6. Formatiere wichtige Begriffe **fett** (Markdown).

      Antwort:
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysis = response.text();

    return NextResponse.json({ analysis });

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json({ message: 'Analyse fehlgeschlagen' }, { status: 500 });
  }
}
