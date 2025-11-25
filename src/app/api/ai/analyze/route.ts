// src/app/api/ai/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

// 1. API Key Prüfung
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ [SERVER START] GEMINI_API_KEY fehlt in .env!");
} else {
  console.log("✅ [SERVER START] GEMINI_API_KEY ist gesetzt (Länge: " + apiKey.length + ")");
}

const google = createGoogleGenerativeAI({
  apiKey: apiKey || '',
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log("➡️ [API] Analyse-Request gestartet...");

  try {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user) {
      console.warn("⚠️ [API] Nicht authentifiziert");
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, dateRange } = body;
    console.log(`ℹ️ [API] Projekt: ${projectId}, Zeitraum: ${dateRange}`);

    // 2. Daten laden
    const { rows } = await sql`
      SELECT id, email, domain, gsc_site_url, ga4_property_id 
      FROM users WHERE id::text = ${projectId}
    `;
    
    if (rows.length === 0) {
      console.error("❌ [API] Projekt nicht in DB gefunden");
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const project = rows[0];
    console.log("ℹ️ [API] Lade Google Daten...");
    const data = await getOrFetchGoogleData(project, dateRange);

    if (!data) {
      console.error("❌ [API] Keine Google Daten erhalten");
      return NextResponse.json({ message: 'Keine Daten verfügbar' }, { status: 400 });
    }
    console.log("✅ [API] Google Daten geladen. Generiere Prompt...");

    // 3. Prompt (gekürzt für Übersicht)
    const kpis = data.kpis;
    const summaryData = `Domain: ${project.domain} ... (Daten hier) ...`; // Ihr Prompt-Code
    
    const prompt = `Du bist ein SEO-Analyst. ... ${summaryData}`;

    // 4. Streaming Starten
    console.log("🚀 [API] Starte Gemini Stream (Modell: gemini-2.5-flash)...");
    
    try {
      const result = await streamText({
        model: google('gemini-2.5-flash'), // Testen Sie ggf. 'gemini-1.5-flash' falls 2.5 noch zickt
        prompt: prompt,
        onFinish: () => console.log("🏁 [API] Stream erfolgreich beendet.")
      });

      return result.toTextStreamResponse();
    } catch (streamError) {
      console.error("💥 [API] Fehler BEIM STREAMING:", streamError);
      throw streamError; // Weiterwerfen zum äußeren Catch
    }

  } catch (error) {
    console.error('🔥 [API] FATAL ERROR in route:', error);
    // Geben Sie den echten Fehlertext zurück, damit das Frontend ihn anzeigt!
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Serverfehler',
      details: String(error)
    }, { status: 500 });
  }
}
