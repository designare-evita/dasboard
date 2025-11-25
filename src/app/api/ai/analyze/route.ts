import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

// API Key Setup
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// ✅ KORREKTUR: Safety Settings HIER definieren
const google = createGoogleGenerativeAI({
  apiKey: apiKey || '',
  safetySettings: [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  ],
});

// Node.js Runtime für Streaming
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log("➡️ [API AI] Analyse-Start...");

  try {
    // 1. Auth
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { projectId, dateRange } = await req.json();

    // 2. Daten laden
    const { rows } = await sql`
      SELECT id, email, domain 
      FROM users WHERE id::text = ${projectId}
    `;
    
    if (rows.length === 0) return NextResponse.json({ message: 'Projekt fehlt' }, { status: 404 });
    const project = rows[0];

    const data = await getOrFetchGoogleData(project, dateRange);
    if (!data) return NextResponse.json({ message: 'Keine Daten' }, { status: 400 });

    // 3. Prompt bauen
    const kpis = data.kpis || {};
    const fmt = (val?: number) => val ? val.toLocaleString('de-DE') : '0';
    const change = (val?: number) => val ? val.toFixed(1) : '0';

    const summaryData = `
      Domain: ${project.domain || 'Unbekannt'}
      Zeitraum: ${dateRange}
      KPIs:
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Impressionen: ${fmt(kpis.impressions?.value)} (${change(kpis.impressions?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - Nutzer: ${fmt(kpis.totalUsers?.value)} (${change(kpis.totalUsers?.change)}%)
      
      Top 3 Keywords:
      ${data.topQueries?.slice(0, 3).map((q: any) => `- ${q.query} (Pos: ${Number(q.position).toFixed(1)})`).join('\n') || 'Keine Keywords'}
    `;

    const prompt = `
      Du bist ein SEO-Experte. Analysiere diese Webseiten-Daten kurz (max 4 Sätze):
      ${summaryData}
      
      Aufgaben:
      1. Nenne die Hauptursache für die Entwicklung.
      2. Gib EINEN konkreten Optimierungs-Tipp.
      3. Nutze **fette** Markierung für wichtige Begriffe.
      4. Sprich den Nutzer mit "Sie" an.
    `;

    console.log("📝 [API AI] Generierter Prompt (Auszug):", summaryData.replace(/\n/g, ' '));

    // 4. Streaming starten
    const result = await streamText({
      // ✅ KORREKTUR: Nur noch den Modellnamen übergeben (Settings sind oben im Provider)
      model: google('gemini-2.5-flash'), 
      prompt: prompt,
      onChunk: ({ chunk }) => {
        // Optional: Debugging
        // if (chunk.type === 'text-delta') console.log("Chunk:", chunk.textDelta); 
      },
      onFinish: (res) => {
        console.log(`🏁 [API AI] Fertig. Textlänge: ${res.text.length}`);
        if (res.text.length === 0) console.warn("⚠️ [API AI] Leere Antwort!");
      }
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('🔥 [API AI] Fehler:', error);
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
