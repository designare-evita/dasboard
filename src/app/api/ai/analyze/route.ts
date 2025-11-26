import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

// 1. Setup Google AI
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// 2. WICHTIG: Erlaubt bis zu 60 Sekunden Laufzeit (verhindert Abbruch bei Datenladung)
export const maxDuration = 60; 
export const runtime = 'nodejs';

// Hilfsfunktionen
const fmt = (val?: number) => (val ? val.toLocaleString('de-DE') : '0');
const change = (val?: number) => {
  if (val === undefined || val === null) return '0';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}`;
};

export async function POST(req: NextRequest) {
  try {
    // A. Authentifizierung
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { projectId, dateRange } = await req.json();
    const userRole = session.user.role;

    // B. Projektdaten holen
    const { rows } = await sql`
      SELECT 
        id, email, domain, gsc_site_url, ga4_property_id,
        project_timeline_active, project_start_date, project_duration_months, "createdAt"
      FROM users WHERE id::text = ${projectId}
    `;
    
    if (rows.length === 0) throw new Error('Projekt nicht gefunden');
    const project = rows[0];

    // C. Externe Daten laden (Das dauert kurz, danach startet Stream)
    const data = await getOrFetchGoogleData(project, dateRange);
    if (!data || !data.kpis) throw new Error('Keine Daten verfügbar');
    const kpis = data.kpis;

    // D. Kontext berechnen
    let timelineInfo = "Standard Betreuung (Keine aktive Zeitlinie)";
    let progressPercent = 0;
    
    if (project.project_timeline_active) {
        const start = new Date(project.project_start_date || project.createdAt);
        const duration = project.project_duration_months || 6;
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)); 
        const currentMonth = Math.min(diffMonths, duration);
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

    const totalUsers = kpis.totalUsers?.value || 0;
    const aiUsers = data.aiTraffic?.totalUsers || 0;
    const realUsers = Math.max(0, totalUsers - aiUsers);

    const statusContext = `
      ZEITPLAN:
      ${timelineInfo}
      AKTUELLE PERFORMANCE:
      - Echte Besucher: ${fmt(realUsers)}
      - KI-Sichtbarkeit: ${fmt(aiUsers)}
      - Trend (Sichtbarkeit): ${change(kpis.impressions?.change)}%
    `;

    const summaryData = `
      STATUS INFOS:
      ${statusContext}
      DOMAIN: ${project.domain} (${dateRange})
      KPIs:
      - Klicks: ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%)
      - Sitzungen: ${fmt(kpis.sessions?.value)} (${change(kpis.sessions?.change)}%)
      - Nutzer: ${fmt(totalUsers)} (${change(kpis.totalUsers?.change)}%)
      TOP KANÄLE: ${data.channelData?.slice(0, 3).map(c => c.name).join(', ') || '-'}
      KI-ANTEIL: ${data.aiTraffic ? (data.aiTraffic.totalSessions/kpis.sessions.value*100).toFixed(1) : 0}%
      TOP KEYWORDS: ${data.topQueries?.slice(0, 5).map((q:any) => q.query).join(', ') || '-'}
    `;

    // E. Prompt Engineering
    const visualSuccessTemplate = `
      <div class="mt-auto pt-8 pb-2">
        <div class="bg-emerald-50 rounded-xl border border-emerald-100 p-4 flex items-center gap-4 shadow-sm transition-transform hover:scale-[1.02]">
           <div class="bg-white p-2.5 rounded-full text-emerald-500 shadow-sm flex-shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-trophy-fill" viewBox="0 0 16 16"><path d="M2.5.5A.5.5 0 0 1 3 0h10a.5.5 0 0 1 .5.5c0 .538-.012 1.05-.034 1.536a3 3 0 1 1-1.133 5.89c-.79 1.865-1.878 2.777-2.833 3.011v2.173l1.425.356c.194.048.377.135.537.255L13.3 15.1a.5.5 0 0 1-.3.9H3a.5.5 0 0 1-.3-.9l1.838-1.379c.16-.12.343-.207.537-.255L6.5 13.11v-2.173c-.955-.234-2.043-1.146-2.833-3.012a3 3 0 1 1-1.132-5.89A33.076 33.076 0 0 1 2.5.5zm.099 2.54a2 2 0 0 0 .72 3.935c-.333-1.05-.588-2.346-.72-3.935zm10.083 3.935a2 2 0 0 0 .72-3.935c-.133 1.59-.388 2.885-.72 3.935z"/></svg>
           </div>
           <div>
             <div class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Top Erfolg</div>
             <div class="text-sm font-semibold text-emerald-900 leading-tight">ERFOLG_TEXT_PLATZHALTER</div>
           </div>
        </div>
      </div>
    `;

    const layoutInstruction = `
      OUTPUT FORMAT (HTML GRID):
      Antworte NUR mit diesem HTML. Kein Markdown.
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div class="bg-indigo-50/50 rounded-2xl border border-indigo-100 h-[80vh] flex flex-col relative group overflow-hidden">
           <div class="p-6 pb-0 flex-shrink-0">
             <h3 class="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
               Projekt Status & Zahlen
             </h3>
           </div>
           <div class="p-6 pt-2 space-y-3 text-indigo-900 text-sm flex-grow overflow-y-auto pr-2 pb-16 scroll-smooth">
             </div>
           <div class="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-indigo-50 via-indigo-50/90 to-transparent pointer-events-none flex justify-center items-end pb-4 transition-opacity duration-300 group-hover:opacity-0">
              <span class="text-indigo-400 text-xs font-medium bg-white/50 px-3 py-1 rounded-full border border-indigo-100 shadow-sm">Mehr anzeigen</span>
           </div>
        </div>
        <div class="bg-white rounded-2xl border border-gray-200 h-[80vh] shadow-sm flex flex-col relative group overflow-hidden">
           <div class="p-6 pb-0 flex-shrink-0">
             <h3 class="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
               Performance Analyse
             </h3>
           </div>
           <div class="p-6 pt-4 space-y-4 text-gray-700 text-sm flex-grow overflow-y-auto pr-2 pb-16 scroll-smooth">
             </div>
           <div class="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none flex justify-center items-end pb-4 transition-opacity duration-300 group-hover:opacity-0">
              <span class="text-gray-400 text-xs font-medium bg-gray-50 px-3 py-1 rounded-full border border-gray-200 shadow-sm">Mehr lesen</span>
           </div>
        </div>
      </div>
    `;

    let systemPrompt = '';
    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      systemPrompt = `
        Rolle: "Data Max", Performance-KI. Zielgruppe: Admin.
        Inhalt Spalte 1: Timeline, KPIs, KI-Traffic. Am Ende: "${visualSuccessTemplate}" (Fülle ERFOLG_TEXT_PLATZHALTER).
        Inhalt Spalte 2: Analyse & Empfehlung.
        Farben: <span class="text-green-600 font-bold">positiv</span>.
      `;
    } else {
      systemPrompt = `
        Rolle: "Data Max", Assistent. Zielgruppe: Kunde.
        Inhalt Spalte 1: Timeline, Echte Besucher, KI-Sichtbarkeit (als Erfolg). Am Ende: "${visualSuccessTemplate}" (Fülle ERFOLG_TEXT_PLATZHALTER mit bestem Wert).
        Inhalt Spalte 2: Erfolge & Fazit.
        Farben: <span class="text-green-600 font-bold">positiv</span>. Negative Zahlen neutral.
      `;
    }

    // F. STREAM STARTEN mit gemini-2.5-flash
    const result = await streamText({
      model: google('gemini-2.5-flash'), // Das korrekte, aktuelle Modell
      system: systemPrompt,
      prompt: `${layoutInstruction}\n\nDaten:\n${summaryData}`,
    });

    // WICHTIG: Text-Stream zurückgeben
    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json(
        { message: 'Fehler', error: String(error) }, 
        { status: 500 }
    );
  }
}
