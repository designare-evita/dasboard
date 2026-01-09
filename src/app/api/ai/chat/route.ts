// src/app/api/ai/chat/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import { streamTextSafe } from '@/lib/ai-config';
import { UserSchema, type User } from '@/lib/schemas';
import type { ProjectDashboardData } from '@/lib/dashboard-shared';

export const runtime = 'nodejs';

// ============================================================================
// KONTEXT-BUILDER
// ============================================================================

function buildChatContext(data: ProjectDashboardData, user: User, dateRange: string): string {
  const kpis = data.kpis;
  const fmt = (val?: number) => val?.toLocaleString('de-DE') ?? '0';
  const pct = (val?: number) => val ? `${val > 0 ? '+' : ''}${val.toFixed(1)}%` : '0%';

  // Early return wenn keine KPIs vorhanden
  if (!kpis) {
    return `
PROJEKT: ${user.domain || 'Unbekannt'}
ZEITRAUM: ${dateRange}

Keine Daten verfügbar. Bitte stelle sicher, dass GA4 und GSC korrekt konfiguriert sind.
`.trim();
  }

  // Top Keywords (max 10)
  const topKeywords = data.topQueries?.slice(0, 10)
    .map(q => `"${q.query}" (Pos: ${q.position.toFixed(1)}, Klicks: ${q.clicks})`)
    .join('\n') || 'Keine Daten';

  // SEO-Chancen (Position 4-20)
  const seoChances = data.topQueries
    ?.filter(q => q.position >= 4 && q.position <= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)
    .map(q => `"${q.query}" (Pos: ${q.position.toFixed(1)}, Impr: ${q.impressions})`)
    .join('\n') || 'Keine identifiziert';

  // Top Converting Pages
  const topPages = data.topConvertingPages
    ?.filter(p => !p.path.includes('danke') && !p.path.includes('thank'))
    .slice(0, 5)
    .map(p => `${p.path}: ${p.conversions} Conv. (${p.conversionRate}%)`)
    .join('\n') || 'Keine Daten';

  // KI-Traffic
  const aiInfo = data.aiTraffic ? `
KI-TRAFFIC:
- Gesamt: ${fmt(data.aiTraffic.totalSessions)} Sessions von ${fmt(data.aiTraffic.totalUsers)} Nutzern
- Top-Quellen: ${data.aiTraffic.topAiSources?.slice(0, 3).map(s => `${s.source} (${s.sessions})`).join(', ') || 'Keine'}
` : '';

  // Kanäle
  const channels = data.channelData?.slice(0, 5)
    .map(c => `${c.name}: ${fmt(c.value)} Sessions`)
    .join('\n') || 'Keine Daten';

  return `
PROJEKT: ${user.domain || 'Unbekannt'}
ZEITRAUM: ${dateRange === '7d' ? 'Letzte 7 Tage' : dateRange === '30d' ? 'Letzte 30 Tage' : dateRange === '3m' ? 'Letzte 3 Monate' : dateRange === '6m' ? 'Letzte 6 Monate' : 'Letztes Jahr'}

=== HAUPT-KPIs ===
Nutzer: ${fmt(kpis.totalUsers?.value)} (${pct(kpis.totalUsers?.change)})
Sessions: ${fmt(kpis.sessions?.value)} (${pct(kpis.sessions?.change)})
Klicks (GSC): ${fmt(kpis.clicks?.value)} (${pct(kpis.clicks?.change)})
Impressionen: ${fmt(kpis.impressions?.value)} (${pct(kpis.impressions?.change)})
Conversions: ${fmt(kpis.conversions?.value)} (${pct(kpis.conversions?.change)})
Interaktionsrate: ${kpis.engagementRate?.value?.toFixed(1)}%
Bounce Rate: ${kpis.bounceRate?.value?.toFixed(1)}%
${aiInfo}
=== TOP KEYWORDS ===
${topKeywords}

=== SEO-CHANCEN (Striking Distance) ===
${seoChances}

=== TOP CONVERTING PAGES ===
${topPages}

=== TRAFFIC-KANÄLE ===
${channels}
`.trim();
}

// ============================================================================
// SUGGESTED QUESTIONS GENERATOR
// ============================================================================

function generateSuggestedQuestions(data: ProjectDashboardData): string[] {
  const questions: string[] = [];
  const kpis = data.kpis;

  // Basierend auf Daten-Anomalien (nur wenn kpis vorhanden)
  if (kpis) {
    if (kpis.conversions?.change && kpis.conversions.change < -10) {
      questions.push('Warum sind meine Conversions gesunken?');
    }
    if (kpis.clicks?.change && kpis.clicks.change > 20) {
      questions.push('Was hat den Klick-Anstieg verursacht?');
    }
  }
  
  if (data.aiTraffic && data.aiTraffic.totalSessions > 50) {
    questions.push('Erkläre meinen KI-Traffic genauer');
  }
  if (data.topQueries?.some(q => q.position >= 4 && q.position <= 10)) {
    questions.push('Welche Keywords sollte ich priorisieren?');
  }

  // Fallback-Fragen
  if (questions.length < 3) {
    questions.push('Wie kann ich meine Conversion-Rate verbessern?');
    questions.push('Was sind meine größten SEO-Chancen?');
    questions.push('Gib mir 3 konkrete Empfehlungen');
  }

  return questions.slice(0, 4);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { message, projectId, dateRange = '30d' } = await req.json();

    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Nachricht fehlt' }, { status: 400 });
    }

    // 2. Ziel-User bestimmen (eigenes Projekt oder Admin-Zugriff)
    const userId = session.user.id;
    const userRole = session.user.role;
    let targetUserId = projectId || userId;

    // Admin-Check für fremde Projekte
    if (targetUserId !== userId && userRole === 'ADMIN') {
      const { rows: assignments } = await sql`
        SELECT 1 FROM project_assignments
        WHERE user_id::text = ${userId} AND project_id::text = ${targetUserId}
      `;
      if (assignments.length === 0) {
        return Response.json({ error: 'Zugriff verweigert' }, { status: 403 });
      }
    }

    // 3. User-Daten laden
    const { rows } = await sql`SELECT * FROM users WHERE id::text = ${targetUserId}`;
    if (rows.length === 0) {
      return Response.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const parseResult = UserSchema.safeParse(rows[0]);
    if (!parseResult.success) {
      return Response.json({ error: 'Daten fehlerhaft' }, { status: 500 });
    }
    const user = parseResult.data;

    // 4. Dashboard-Daten laden (aus Cache)
    const dashboardData = await getOrFetchGoogleData(user, dateRange);
    if (!dashboardData) {
      return Response.json({ error: 'Keine Projektdaten verfügbar' }, { status: 400 });
    }

    // 5. Kontext bauen
    const context = buildChatContext(dashboardData, user, dateRange);
    const suggestedQuestions = generateSuggestedQuestions(dashboardData);

    // 6. System-Prompt
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
    
    const systemPrompt = `Du bist "DataMax", ein freundlicher aber kompetenter SEO- und Analytics-Experte.

DEINE PERSÖNLICHKEIT:
- Präzise und datengetrieben
- Gibst konkrete, umsetzbare Empfehlungen
- Erklärst komplexe Zusammenhänge verständlich
- ${isAdmin ? 'Sprichst technisch mit SEO-Fachbegriffen' : 'Sprichst kundenfreundlich ohne zu viel Fachjargon'}

KONTEXT - AKTUELLE PROJEKTDATEN:
${context}

REGELN:
1. Beziehe dich IMMER auf die konkreten Zahlen oben
2. Gib maximal 3-4 Empfehlungen pro Antwort
3. Sei prägnant (max. 200 Wörter, außer explizit mehr gewünscht)
4. Bei Fragen außerhalb deines Datenbereichs: Sage ehrlich, dass du das nicht weißt
5. Formatiere mit **fett** für wichtige Zahlen und Begriffe
6. Nutze Aufzählungen für Empfehlungen

${isAdmin ? `
ADMIN-MODUS AKTIV:
- Du kannst technische Details und API-Daten erwähnen
- Erwähne auch negative Trends offen
- Schlage auch komplexere SEO-Maßnahmen vor
` : `
KUNDEN-MODUS AKTIV:
- Erkläre Fachbegriffe kurz
- Fokussiere auf positive Entwicklungen, aber sei ehrlich
- Halte Empfehlungen einfach umsetzbar
`}`;

    // 7. Stream-Response
    const result = await streamTextSafe({
      system: systemPrompt,
      prompt: message,
      temperature: 0.7,
    });

    // Response mit Suggested Questions Header
    const response = result.toTextStreamResponse();
    response.headers.set('X-Suggested-Questions', JSON.stringify(suggestedQuestions));
    
    return response;

  } catch (error) {
    console.error('[DataMax Chat] Fehler:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET: Suggested Questions ohne Chat
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || session.user.id;
    const dateRange = searchParams.get('dateRange') || '30d';

    // User laden
    const { rows } = await sql`SELECT * FROM users WHERE id::text = ${projectId}`;
    if (rows.length === 0) {
      return Response.json({ questions: [] });
    }

    const parseResult = UserSchema.safeParse(rows[0]);
    if (!parseResult.success) {
      return Response.json({ questions: [] });
    }

    // Daten laden
    const dashboardData = await getOrFetchGoogleData(parseResult.data, dateRange);
    if (!dashboardData) {
      return Response.json({ questions: [] });
    }

    const questions = generateSuggestedQuestions(dashboardData);
    return Response.json({ questions });

  } catch (error) {
    console.error('[DataMax Questions] Fehler:', error);
    return Response.json({ questions: [] });
  }
}
