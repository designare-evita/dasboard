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

    // 2. Projektdaten laden (INKLUSIVE TIMELINE DATEN)
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

    // 3. Timeline-Daten berechnen
    let timelineInfo = "Standard Betreuung (Keine aktive Zeitlinie)";
    let progressPercent = 0;
    
    if (project.project_timeline_active) {
        const start = new Date(project.project_start_date || project.createdAt);
        const now = new Date();
        const duration = project.project_duration_months || 6;
        
        // Berechne vergangenen Monate
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)); 
        const currentMonth = Math.min(diffMonths, duration); // Nicht höher als Laufzeit
        
        const endDate = new Date(start);
        endDate.setMonth(start.getMonth() + duration);
        
        progressPercent = Math.round((currentMonth / duration) * 100);

        timelineInfo = `
          Status: AKTIVE PROJEKT-LAUFZEIT
          Aktueller Monat: ${currentMonth} von ${duration}
          Start: ${start.toLocaleDateString('de-DE')}
          Geplantes Ende: ${endDate.toLocaleDateString('de-DE')}
          Fortschritt: ${progressPercent}%
        `;
    }

    // 4. Datenaufbereitung für KI
    
    // BERECHNUNG: Echte Besucher (ohne KI)
    const totalUsers = kpis.totalUsers?.value || 0;
    const aiUsers = data.aiTraffic?.totalUsers || 0;
    const realUsers = Math.max(0, totalUsers - aiUsers);

    // BERECHNUNG: Status Context (Timeline + Key Metrics)
    // Wir fügen hier explizit die "Zahlen" hinzu, damit sie in Spalte 1 landen
    const statusContext = `
      ZEITPLAN:
      ${timelineInfo}

      AKTUELLE PERFORMANCE (Für "Projekt Status" Box):
      - Echte Besucher (Humans): ${fmt(realUsers)}
      - Gesamte Sichtbarkeit (Impressionen): ${fmt(kpis.impressions?.value)}
      - Trend (Sichtbarkeit): ${change(kpis.impressions?.change)}%
    `;

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
      PROJEKT STATUS INFOS (Spalte 1):
      ${statusContext}

      DOMAIN DATEN (${project.domain}):
      Zeitraum: ${dateRange}
      
      DETAIL-KPIs (Für Analyse Spalte 2):
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      
      INPUT VARIABLEN:
      - Top Kanäle: ${topChannels}
      - KI-Interferenz (Bot Traffic): ${aiShare}%
      
      SEMANTISCHE ZIELE (Top Keywords):
      ${topKeywords}
    `;

    // 5. Rollenbasierte Prompt-Generierung
    let systemPrompt = '';
    let userPrompt = '';

    // Gemeinsames HTML Layout Template
    const layoutInstruction = `
      OUTPUT FORMAT (HTML GRID):
      Du musst deine Antwort ZWINGEND in folgende HTML-Struktur verpacken. Nutze keine Markdown-Codeblöcke (\`\`\`), sondern direktes HTML.

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        <div class="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 h-full flex flex-col">
           <h3 class="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-info-circle-fill" viewBox="0 0 16 16">
               <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
             </svg>
             Projekt Status & Zahlen
           </h3>
           <div class="space-y-3 text-indigo-900 text-sm flex-grow">
             </div>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-200 h-full shadow-sm flex flex-col">
           <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-graph-up-arrow" viewBox="0 0 16 16">
               <path fill-rule="evenodd" d="M0 0h1v15h15v1H0V0Zm10 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.9l-3.613 4.417a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61L13.445 4H10.5a.5.5 0 0 1-.5-.5Z"/>
             </svg>
             Performance Analyse
           </h3>
           <div class="space-y-4 text-gray-700 text-sm flex-grow">
             </div>
        </div>

      </div>
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN PROMPT ===
      systemPrompt = `
        Identität: "Data Max", Performance-KI. Zielgruppe: Admin/Experte.
        Ton: Präzise, Analytisch, Strategisch.
        
        VISUELLE REGELN:
        - Nutze HTML Tags für Farben: <span class="text-green-600 font-bold">positiv</span>, <span class="text-red-600 font-bold">negativ/kritisch</span>.
        
        INHALT SPALTE 1 (Status):
        - Liste Timeline-Fakten (Laufzeit, Monat).
        - Liste DARUNTER die Key-Facts: "Echte Besucher", "Sichtbarkeit" und "Trend".
        
        INHALT SPALTE 2 (Analyse):
        - Status-Analyse (Abweichungen).
        - Profi-Empfehlung.
      `;
    } else {
      // === KUNDEN PROMPT ===
      systemPrompt = `
        Identität: "Data Max", dein persönlicher Assistent. Zielgruppe: Kunde.
        Ton: Professionell, ruhig, faktenbasiert.
        
        VISUELLE REGELN:
        - <span class="text-green-600 font-bold">Positives grün</span>.
        - NEUTRALISIERUNG: Negative Zahlen in Spalte 1 und 2 bitte in normaler Textfarbe (kein Rot), keine Warnsymbole.
        
        INHALT SPALTE 1 (Status & Zahlen):
        - 1. Block: Timeline (Monat X von Y, Start/Ende).
        - 2. Block: "Aktuelle Leistung": Liste hier unbedingt "Echte Besucher" und "Sichtbarkeit".
        - Das sorgt dafür, dass der Kunde sofort sieht, wo er steht (Zeitlich + Zahlentechnisch).
        
        INHALT SPALTE 2 (Analyse):
        - Fokus auf erreichte Erfolge.
        - Erwähne Top Keywords.
        - Konstruktives Fazit.
      `;
    }

    userPrompt = `
      ${layoutInstruction}
      
      Hier sind die Daten für die Analyse:
      ${summaryData}
    `;

    // 6. Generierung
    const { text } = await generateText({
      model: google('gemini-2.5-flash'), 
      system: systemPrompt,
      prompt: userPrompt,
    });

    return NextResponse.json({ analysis: text });

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json(
        { message: 'Analyse fehlgeschlagen', error: String(error) }, 
        { status: 500 }
    );
  }
}
