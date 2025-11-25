import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenerativeAIStream, StreamingTextResponse } from 'ai';

// Initialisierung (greift auf Ihre Variable zu)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Da Streaming-Antworten verwendet werden, muss Edge-Runtime oder Nodejs korrekt gesetzt sein.
// Vercel Postgres benötigt meist Node.js Runtime, daher lassen wir 'edge' hier weg oder setzen explizit 'nodejs'.
export const runtime = 'nodejs'; 
// (Falls Sie Probleme mit Timeouts bekommen, hilft 'nodejs' meist besser bei DB-Verbindungen)

export async function POST(req: NextRequest) {
  try {
    // 1. Authentifizierung
    const session = await auth();
    if (!session?.user) return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });

    // Wir lesen den Body. Bei useCompletion wird der Body oft anders gesendet,
    // aber wir können custom bodies übergeben.
    const { projectId, dateRange } = await req.json();

    // 2. Daten laden (bleibt gleich)
    const { rows } = await sql`
      SELECT id, email, domain, gsc_site_url, ga4_property_id 
      FROM users WHERE id::text = ${projectId}
    `;
    const project = rows[0];

    const data = await getOrFetchGoogleData(project, dateRange);

    if (!data) {
      // Bei Streaming ist Fehler-Handling im Client etwas anders, 
      // aber ein JSON-Response mit Error bricht den Stream sauber ab.
      return NextResponse.json({ message: 'Keine Daten verfügbar' }, { status: 400 });
    }

    // 3. Prompt bauen (bleibt gleich)
    const kpis = data.kpis;
    const fmt = (val?: number) => val ? val.toLocaleString('de-DE') : '0';
    const change = (val?: number) => val ? val.toFixed(1) : '0';

    const summaryData = `
      Domain: ${project.domain}
      Zeitraum: ${dateRange}
      KPIs:
      - Klicks: ${fmt(kpis?.clicks?.value)} (${change(kpis?.clicks?.change)}%)
      - Impressionen: ${fmt(kpis?.impressions?.value)} (${change(kpis?.impressions?.change)}%)
      - Sitzungen: ${fmt(kpis?.sessions?.value)} (${change(kpis?.sessions?.change)}%)
      - Nutzer: ${fmt(kpis?.totalUsers?.value)} (${change(kpis?.totalUsers?.change)}%)
      
      Top Keywords:
      ${data.topQueries?.slice(0, 5).map(q => `- ${q.query} (Pos: ${q.position.toFixed(1)})`).join('\n')}
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Ihr funktionierendes Modell

    const prompt = `
      Du bist ein erfahrener SEO-Analyst. Interpretiere diese Daten kurz (max 3-4 Sätze):
      ${summaryData}
      
      Anweisungen:
      1. Erkläre die Hauptursache für Veränderungen.
      2. Gib EINEN konkreten Tipp.
      3. Sprich den Nutzer mit "Sie" an.
      4. Nutze Markdown für **fette** Begriffe.
    `;

    // 4. STREAMING STARTEN
    // Nutze generateContentStream statt generateContent
    const geminiStream = await model.generateContentStream(prompt);

    // Konvertiere den Google-Stream in einen Vercel AI Stream
    const stream = GoogleGenerativeAIStream(geminiStream);

    // Gib den Stream direkt an den Client zurück
    return new StreamingTextResponse(stream);

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json({ message: 'Analyse fehlgeschlagen' }, { status: 500 });
  }
}
