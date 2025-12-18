// src/app/api/ai/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import crypto from 'node:crypto';
import type { User } from '@/lib/schemas'; 

// NEU: Importiere den zentralen Safe-Helper statt direkt 'ai' und 'createGoogleGenerativeAI'
import { streamTextSafe } from '@/lib/ai-config';

export const runtime = 'nodejs';

// Hilfsfunktionen
const fmt = (val?: number) => (val ? val.toLocaleString('de-DE') : '0');
const change = (val?: number) => {
  if (val === undefined || val === null) return '0';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}`;
};

function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, dateRange } = body;
    const userRole = session.user.role;

    if (!projectId || !dateRange) {
      return NextResponse.json({ message: 'Projekt-ID und Zeitraum erforderlich' }, { status: 400 });
    }

    // 1. Prüfen, ob eine Analyse für diese Daten schon im Cache ist
    // Wir hashen die Inputs, um Änderungen zu erkennen
    const inputHash = createHash(`${projectId}-${dateRange}`);
    
    // Check Cache (nur wenn nicht explizit "refresh" angefordert wurde - bauen wir später ein)
    const { rows } = await sql`
      SELECT response, created_at FROM ai_analysis_cache 
      WHERE user_id = ${projectId}::uuid 
      AND date_range = ${dateRange}
      AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC LIMIT 1
    `;

    if (rows.length > 0) {
      // Cache Hit!
      return new NextResponse(rows[0].response);
    }

    // 2. Daten laden (wenn nicht im Cache)
    const analyticsData = await getOrFetchGoogleData(projectId, dateRange);

    if (!analyticsData) {
        return NextResponse.json({ message: 'Keine Daten gefunden' }, { status: 404 });
    }

    // 3. Daten für KI aufbereiten (Zusammenfassung)
    // FIX: Zugriff auf die korrekten Properties des ProjectDashboardData Typs
    const summaryData = `
      Nutzer: ${analyticsData.users ?? 0} (Änderung: ${change(analyticsData.usersChange)}%)
      Sitzungen: ${analyticsData.sessions ?? 0} (Änderung: ${change(analyticsData.sessionsChange)}%)
      Absprungrate: ${fmt(analyticsData.bounceRate)}%
      Durschn. Sitzungsdauer: ${fmt(analyticsData.avgSessionDuration)}s
      
      Top Seiten (Views):
      ${analyticsData.pages?.slice(0, 5).map(p => `- ${p.path}: ${p.views} Views`).join('\n') || 'Keine Daten'}

      Top Quellen:
      ${analyticsData.sources?.slice(0, 5).map(s => `- ${s.source}: ${s.users} User`).join('\n') || 'Keine Daten'}
    `;

    // 4. Prompt Engineering
    let systemPrompt = `
      Du bist ein erfahrener Web-Analyst. Deine Aufgabe ist es, Google Analytics 4 Daten für einen Kunden verständlich und handlungsorientiert zusammenzufassen.
      
      Stil: Professionell, ermutigend, aber ehrlich. "Du"-Ansprache.
      
      Formatierung: Nutze HTML-Tags für die Struktur (KEIN Markdown!).
      Struktur der Antwort:
      1. <h4 class="text-lg font-semibold text-indigo-900 mb-2">Das Wichtigste zuerst:</h4> Ein kurzer Satz als Einleitung.
      2. <h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Zusammenfassung:</h4> Fließtext über Erfolge (Conversions hervorheben).
      3. <h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Top Seiten:</h4> Nenne die stärksten Inhalte.
      4. <h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Potenzial:</h4> Ein konkreter Verbesserungsvorschlag basierend auf den Daten (z.B. Absprungrate senken).
    `;

    // Spezieller Prompt für Evita-Kunden (wenn wir das Flag hätten, hier einfach Standard)
    if (userRole === 'admin') {
      systemPrompt = `
        Du bist ein knallharter Daten-Analyst. Analysiere die folgenden Daten kurz und prägnant.
        Format: HTML.
        1. <h4 class="text-lg font-semibold text-indigo-900 mb-2">Status:</h4> Kurzfazit.
        2. <h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Zusammenfassung:</h4> Fließtext über Erfolge (Conversions hervorheben).
        3. <h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Top Seiten (Umsatz):</h4> Nenne lobend die Seiten mit den meisten Conversions.
        4. <h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Ihr Wachstumspotenzial:</h4> 
           Greifen Sie 1-2 Keywords aus "SEO CHANCEN" heraus und formulieren Sie es als gute Nachricht: 
           "Wir haben tolles Potenzial entdeckt! Viele Menschen suchen nach [Keyword], und Sie sind schon fast ganz vorne dabei (Seite 2)."
           Erklären Sie motivierend, dass kleine Anpassungen hier große Wirkung für noch mehr Besucher haben können.
      `;
    }

    // 5. KI Generierung starten (MIT ZENTRALEM HELPER)
    // Wir rufen streamTextSafe auf statt streamText. Das 'model' Argument lassen wir weg.
    const result = await streamTextSafe({
      system: systemPrompt,
      prompt: `Analysiere diese Daten für den Zeitraum ${dateRange}:\n${summaryData}`,
      temperature: 0.4, 
      onFinish: async ({ text }) => {
        if (text && text.length > 50) {
          try {
            await sql`
              INSERT INTO ai_analysis_cache (user_id, date_range, input_hash, response)
              VALUES (${projectId}::uuid, ${dateRange}, ${inputHash}, ${text})
            `;
          } catch (e) { console.error('Cache Error', e); }
        }
      }
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[AI Analyze] Error:', error);
    return NextResponse.json({ message: 'Fehler bei der KI-Analyse' }, { status: 500 });
  }
}
