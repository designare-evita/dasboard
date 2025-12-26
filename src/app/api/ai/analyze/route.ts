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

    // ==========================================
    // ✅ DEMO-MODUS CHECK
    // ==========================================
    const isDemo = session.user.email?.includes('demo');
    
    if (isDemo) {
      console.log('[AI Analyze] Demo-User erkannt. Simuliere Antwort...');
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Nur der KI-Text für "Analyse & Fazit" mit [[SPLIT]] für 2-Spalten-Layout
      const demoResponse = `<h4 class="text-lg font-semibold text-indigo-900 mb-2">Das Wichtigste zuerst:</h4>
<p class="mb-4">Willkommen im <strong>Demo-Modus</strong>! Hier sehen Sie exemplarisch, wie unsere KI echte Projektdaten analysieren würde. Ihr Demo-Shop entwickelt sich hervorragend.</p>
<h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Zusammenfassung:</h4>
<p class="mb-4">Die Besucherzahlen zeigen einen starken Aufwärtstrend (+24% im Vergleich zum Vormonat). Besonders erfreulich: Die Conversion-Rate ist auf stabile 3,2% gestiegen. Das deutet darauf hin, dass die Zielgruppe genau angesprochen wird.</p>[[SPLIT]]<h4 class="text-lg font-semibold text-indigo-900 mb-2">Top Seiten:</h4>
<ul class="list-disc pl-5 mb-4 space-y-1">
<li>/produkte/sneaker-collection (52 Conversions)</li>
<li>/sale/sommer-special (38 Conversions)</li>
<li>/landingpage/newsletter-anmeldung (21 Conversions)</li>
</ul>
<h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Potenzial:</h4>
<p>Wir sehen noch ungenutztes Potenzial bei mobilen Besuchern. Die Absprungrate ist dort leicht erhöht. Eine Optimierung der Ladezeit für Mobilgeräte könnte hier weitere Umsätze freisetzen.</p>`;

      return new NextResponse(demoResponse, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
    // ==========================================
    // ENDE DEMO-MODUS
    // ==========================================

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
    // Hinweis: getOrFetchGoogleData erwartet ein User-Objekt, nicht nur projectId
    // Wir müssen den User erst laden
    const { rows: userRows } = await sql`
      SELECT * FROM users WHERE id = ${projectId}::uuid LIMIT 1
    `;
    
    if (userRows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }
    
    const user = userRows[0] as User;
    const analyticsData = await getOrFetchGoogleData(user, dateRange);

    if (!analyticsData) {
        return NextResponse.json({ message: 'Keine Daten gefunden' }, { status: 404 });
    }

    // 3. Daten für KI aufbereiten (Zusammenfassung)
    // FIX: Zugriff auf die korrekten Properties des ProjectDashboardData Typs
    // Die Struktur ist: analyticsData.kpis.{metric}.value und analyticsData.kpis.{metric}.change
    // Optional Chaining für alle Zugriffe um TypeScript-Fehler zu vermeiden
    const kpis = analyticsData.kpis;
    
    const summaryData = `
      Nutzer: ${kpis?.totalUsers?.value ?? 0} (Änderung: ${change(kpis?.totalUsers?.change)}%)
      Sitzungen: ${kpis?.sessions?.value ?? 0} (Änderung: ${change(kpis?.sessions?.change)}%)
      Absprungrate: ${fmt(kpis?.bounceRate?.value)}%
      Durschn. Sitzungsdauer: ${fmt(kpis?.avgEngagementTime?.value)}s
      Conversions: ${kpis?.conversions?.value ?? 0} (Änderung: ${change(kpis?.conversions?.change)}%)
      Engagement Rate: ${fmt(kpis?.engagementRate?.value)}%
      
      Top Seiten (Conversions):
      ${analyticsData.topConvertingPages?.slice(0, 5).map(p => `- ${p.path}: ${p.conversions} Conversions`).join('\n') || 'Keine Daten'}

      Top Suchanfragen:
      ${analyticsData.topQueries?.slice(0, 5).map(q => `- ${q.query}: ${q.clicks} Klicks, Position ${q.position?.toFixed(1)}`).join('\n') || 'Keine Daten'}
    `;

    // 4. Prompt Engineering
    let systemPrompt = `
      Du bist ein erfahrener Web-Analyst. Deine Aufgabe ist es, Google Analytics 4 Daten für einen Kunden verständlich und handlungsorientiert zusammenzufassen.
      
      Stil: Professionell, ermutigend, aber ehrlich. "Du"-Ansprache.
      
      Formatierung: Nutze HTML-Tags für die Struktur (KEIN Markdown!).
      
      WICHTIG: Teile deine Antwort mit dem Marker [[SPLIT]] auf:
      
      TEIL 1 (vor [[SPLIT]]):
      1. <h4 class="text-lg font-semibold text-indigo-900 mb-2">Das Wichtigste zuerst:</h4> Ein kurzer Satz als Einleitung.
      2. <h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Zusammenfassung:</h4> Fließtext über Erfolge (Conversions hervorheben).
      
      Dann schreibe GENAU: [[SPLIT]]
      
      TEIL 2 (nach [[SPLIT]]):
      3. <h4 class="text-lg font-semibold text-indigo-900 mb-2">Top Seiten:</h4> Nenne die stärksten Inhalte.
      4. <h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Potenzial:</h4> Ein konkreter Verbesserungsvorschlag basierend auf den Daten (z.B. Absprungrate senken).
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      systemPrompt = `
        Du bist ein knallharter Daten-Analyst. Analysiere die folgenden Daten kurz und prägnant.
        Format: HTML.
        
        WICHTIG: Teile deine Antwort mit dem Marker [[SPLIT]] auf:
        
        TEIL 1 (vor [[SPLIT]]):
        1. <h4 class="text-lg font-semibold text-indigo-900 mb-2">Status:</h4> Kurzfazit.
        2. <h4 class="text-lg font-semibold text-indigo-900 mt-4 mb-2">Zusammenfassung:</h4> Fließtext über Erfolge (Conversions hervorheben).
        
        Dann schreibe GENAU: [[SPLIT]]
        
        TEIL 2 (nach [[SPLIT]]):
        3. <h4 class="text-lg font-semibold text-indigo-900 mb-2">Top Seiten (Umsatz):</h4> Nenne lobend die Seiten mit den meisten Conversions.
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
