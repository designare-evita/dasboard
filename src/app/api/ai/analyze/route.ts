import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';

const fmt = (val?: number) => (val ? val.toLocaleString('de-DE') : '0');
const change = (val?: number) => {
  if (val === undefined || val === null) return '0';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}`;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { projectId, dateRange } = await req.json();
    const userRole = session.user.role;

    // 1. Daten laden
    const { rows } = await sql`
      SELECT 
        id, email, domain, gsc_site_url, ga4_property_id,
        project_timeline_active, project_start_date, project_duration_months, "createdAt"
      FROM users WHERE id::text = ${projectId}
    `;
    
    if (rows.length === 0) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });

    const project = rows[0];
    const data = await getOrFetchGoogleData(project, dateRange);

    if (!data || !data.kpis) return NextResponse.json({ message: 'Keine Daten' }, { status: 400 });

    const kpis = data.kpis;

    // 2. Projekt-Status berechnen (HTML für linke Spalte vorbereiten)
    let statusContext = "<strong>Standard Betreuung</strong><br>Laufende Optimierung";
    let progressPercentage = 0;

    if (project.project_timeline_active) {
        const start = new Date(project.project_start_date || project.createdAt);
        const now = new Date();
        const duration = project.project_duration_months || 6;
        
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)); 
        const currentMonth = Math.min(diffMonths, duration);
        progressPercentage = Math.round((currentMonth / duration) * 100);
        
        const endDate = new Date(start);
        endDate.setMonth(start.getMonth() + duration);

        statusContext = `
          <strong>Phase:</strong> AKTIVE PROJEKT-LAUFZEIT<br>
          <strong>Fortschritt:</strong> Monat ${currentMonth} von ${duration} (${progressPercentage}%)<br>
          <strong>Zeitraum:</strong> ${start.toLocaleDateString('de-DE')} - ${endDate.toLocaleDateString('de-DE')}
        `;
    }

    const statusHtml = `
      <div class="bg-indigo-50/60 rounded-xl p-5 border border-indigo-100 h-full">
        <h4 class="font-bold text-indigo-900 mb-3 flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.037-.492.046-.686-.07-.198-.143-.236-.338-.129-.562l.61-2.86zM8 15"/></svg>
           Projekt Status
        </h4>
        <div class="text-sm text-indigo-800 space-y-2 leading-relaxed">
          <p>${statusContext}</p>
          <p class="text-xs opacity-80 mt-2 border-t border-indigo-200 pt-2">
            Daten-Basis: ${project.domain} (${dateRange})
          </p>
        </div>
      </div>
    `;

    // 3. Daten für KI
    const topChannels = data.channelData?.slice(0, 3).map(c => `${c.name} (${fmt(c.value)})`).join(', ') || '-';
    const aiShare = data.aiTraffic && kpis.sessions?.value ? (data.aiTraffic.totalSessions / kpis.sessions.value * 100).toFixed(1) : '0';
    const topKeywords = data.topQueries?.slice(0, 5).map((q: any) => `<li>"${q.query}" (Pos: ${q.position.toFixed(1)}, ${q.clicks} Klicks)</li>`).join('') || '<li>Keine Keywords</li>';

    const summaryData = `
      KPIs: Klicks ${fmt(kpis.clicks?.value)} (${change(kpis.clicks?.change)}%), Impr. ${fmt(kpis.impressions?.value)} (${change(kpis.impressions?.change)}%), Nutzer ${fmt(kpis.totalUsers?.value)} (${change(kpis.totalUsers?.change)}%)
      Kanäle: ${topChannels} | KI-Anteil: ${aiShare}%
      Top-Keywords: ${topKeywords}
    `;

    let systemPrompt = '';
    let userPrompt = '';

    // Wir geben das HTML-Gerüst vor
    const layoutInstruction = `
      ANTWORT-FORMAT (HTML):
      Erstelle ein HTML-Grid mit 2 Spalten.
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
           ${statusHtml}
        </div>

        <div class="space-y-4">
           </div>
      </div>
    `;

    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      // === ADMIN MODE ===
      systemPrompt = `
        Identität: "Data Max" für Experten. Ton: Präzise, Analytisch.
        REGELN:
        - Positive Werte: <span class="text-green-600 font-bold">...</span>
        - Negative Werte: <span class="text-red-600 font-bold">...</span>
        - Halte dich an das 2-Spalten HTML Layout.
      `;
      userPrompt = `
        ${layoutInstruction}
        Analysiere die Daten in Spalte 2:
        ${summaryData}

        STRUKTUR SPALTE 2:
        <h4>Status-Analyse</h4> (Abweichungen)
        <h4>Kausalität</h4> (Ursachen)
        <h4>Profi-Empfehlung</h4> (Maßnahmen)
      `;
    } else {
      // === KUNDEN MODE ===
      systemPrompt = `
        Identität: "Data Max" für Kunden. Ton: Höflich, Verständlich.
        REGELN:
        - Positive Werte: <span class="text-green-600 font-bold">...</span>
        - Negative Werte: NEUTRAL darstellen (kein Rot).
        - KEINE Handlungsaufforderungen.
        - Halte dich an das 2-Spalten HTML Layout.
      `;
      userPrompt = `
        ${layoutInstruction}
        Fasse die Leistung in Spalte 2 zusammen:
        ${summaryData}

        STRUKTUR SPALTE 2:
        <h4>Leistungs-Überblick</h4> (Wie lief es? Hebe Erfolge grün hervor.)
        <h4>Suchbegriffe</h4> (Was wurde gesucht?)
        <h4>Fazit</h4> (Positiver Abschluss)
      `;
    }

    const { text } = await generateText({
      model: google('gemini-2.5-flash'), 
      system: systemPrompt,
      prompt: userPrompt,
    });

    return NextResponse.json({ analysis: text });

  } catch (error) {
    console.error('[AI Analyze] Fehler:', error);
    return NextResponse.json({ message: 'Fehler', error: String(error) }, { status: 500 });
  }
}
