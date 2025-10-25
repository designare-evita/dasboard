// src/app/api/projects/[id]/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getSearchConsoleData,
  getAnalyticsData,
  getTopQueries,
  getAiTrafficData,
  type AiTrafficData
} from '@/lib/google-api';
import { getSemrushDomainOverview } from '@/lib/semrush-api';
import { sql } from '@vercel/postgres';
import { User } from '@/types'; // Importiere den Basis-User-Typ

// ✅ NEUER TYP: Erweitert User um ein temporäres Fehlerfeld für Semrush
type ProjectUser = User & {
  semrushError?: string | null;
};

// --- Typ-Definitionen (unverändert) ---
interface TopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}
interface DateRangeData {
  total: number;
  daily: Array<{ date: string; value: number }>;
}
interface GscData {
  clicks: DateRangeData;
  impressions: DateRangeData;
}
interface GaData {
  sessions: DateRangeData;
  totalUsers: DateRangeData;
}

// --- Hilfsfunktionen (unverändert) ---
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const currentNum = typeof current === 'number' ? current : 0;
  const previousNum = typeof previous === 'number' ? previous : 0;
  if (previousNum === 0) return currentNum > 0 ? 100 : 0;
  const change = ((currentNum - previousNum) / previousNum) * 100;
  return Math.round(change * 10) / 10;
}


/**
 * Lädt vollständige Dashboard-Daten für ein spezifisches Projekt
 */
// ✅ KORRIGIERT: Akzeptiert den erweiterten Typ 'ProjectUser'
async function getProjectDashboardData(user: Partial<ProjectUser>, dateRange: string = '30d') {

  // --- Standard-Platzhalter-Werte (unverändert) ---
  const defaultGscData: GscData = {
    clicks: { total: 0, daily: [] },
    impressions: { total: 0, daily: [] }
  };
  const defaultGaData: GaData = {
    sessions: { total: 0, daily: [] },
    totalUsers: { total: 0, daily: [] }
  };
  const defaultTopQueries: TopQuery[] = [];
  const defaultAiTraffic: AiTrafficData = {
    totalSessions: 0,
    totalUsers: 0,
    sessionsBySource: {},
    topAiSources: [],
    trend: []
  };

  // --- Zeitberechnung (unverändert) ---
  const today = new Date();
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 1);
  const startDateCurrent = new Date(endDateCurrent);
  let daysBack: number;

  switch (dateRange) {
    case '3m':
      daysBack = 90;
      break;
    case '6m':
      daysBack = 180;
      break;
    case '12m':
      daysBack = 365;
      break;
    case '30d':
    default:
      daysBack = 29; // Korrekt für 30 Tage (z.B. Tag 30 bis Tag 1 = 29 Tage Differenz)
      break;
  }

  startDateCurrent.setDate(startDateCurrent.getDate() - daysBack);
  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - daysBack);

  try {
    console.log(`[getProjectDashboardData] Lade Daten für Projekt ${user.email} (${dateRange})`);
    // ... (restliche console.log unverändert) ...

    // --- Promises (unverändert) ---
    const gscPromises: [Promise<GscData>, Promise<GscData>, Promise<TopQuery[]>] = user.gsc_site_url ? [
      getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)) as Promise<GscData>,
      getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)) as Promise<GscData>,
      getTopQueries(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)) as Promise<TopQuery[]>,
    ] : [
      Promise.resolve(defaultGscData),
      Promise.resolve(defaultGscData),
      Promise.resolve(defaultTopQueries)
    ];
    const gaPromises: [Promise<GaData>, Promise<GaData>, Promise<AiTrafficData>] = user.ga4_property_id ? [
      getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)) as Promise<GaData>,
      getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious)) as Promise<GaData>,
      getAiTrafficData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)) as Promise<AiTrafficData>
    ] : [
      Promise.resolve(defaultGaData),
      Promise.resolve(defaultGaData),
      Promise.resolve(defaultAiTraffic)
    ];

    console.log(`[getProjectDashboardData] GSC konfiguriert: ${!!user.gsc_site_url}`);
    console.log(`[getProjectDashboardData] GA4 konfiguriert: ${!!user.ga4_property_id}`);

    // --- Promise.allSettled (unverändert) ---
    const [
      gscCurrentResult,
      gscPreviousResult,
      topQueriesResult,
      gaCurrentResult,
      gaPreviousResult,
      aiTrafficResult
    ] = await Promise.allSettled([
      ...gscPromises,
      ...gaPromises
    ]);

    // --- getValue Helfer (unverändert) ---
    const getValue = <T,>(
      result: PromiseSettledResult<T>,
      defaultValue: T,
      apiName: string
    ): T => {
      if (result.status === 'fulfilled') {
        console.log(`[getProjectDashboardData] ✅ ${apiName} erfolgreich`);
        return result.value ?? defaultValue;
      }
      console.error(`[getProjectDashboardData] ❌ ${apiName} Fehler:`, result.reason);
      return defaultValue;
    };

    // --- Datenzuweisung (unverändert) ---
    const gscCurrent: GscData = getValue(gscCurrentResult, defaultGscData, 'GSC Aktuell');
    const gscPrevious: GscData = getValue(gscPreviousResult, defaultGscData, 'GSC Vorher');
    const topQueries: TopQuery[] = getValue(topQueriesResult, defaultTopQueries, 'GSC Top Queries');
    const gaCurrent: GaData = getValue(gaCurrentResult, defaultGaData, 'GA4 Aktuell');
    const gaPrevious: GaData = getValue(gaPreviousResult, defaultGaData, 'GA4 Vorher');
    const aiTraffic: AiTrafficData = getValue(aiTrafficResult, defaultAiTraffic, 'GA4 AI Traffic');

    console.log(`[getProjectDashboardData] ✅ Daten erfolgreich verarbeitet (ggf. mit Platzhaltern)`);

    // --- KI-Traffic-Anteil (unverändert) ---
    const totalSessions = gaCurrent.sessions.total ?? 0;
    const aiSessionsPercentage = totalSessions > 0
      ? (aiTraffic.totalSessions / totalSessions) * 100
      : 0;

    console.log(`[getProjectDashboardData] Gesamt-Sitzungen: ${totalSessions}`);
    console.log(`[getProjectDashboardData] KI-Sitzungen: ${aiTraffic.totalSessions}`);
    console.log(`[getProjectDashboardData] KI-Anteil: ${aiSessionsPercentage.toFixed(2)}%`);

    // ✅ DATENRÜCKGABE (mit Semrush KPIs)
    return {
      kpis: {
        clicks: {
          value: gscCurrent.clicks.total ?? 0,
          change: calculateChange(gscCurrent.clicks.total, gscPrevious.clicks.total)
        },
        impressions: {
          value: gscCurrent.impressions.total ?? 0,
          change: calculateChange(gscCurrent.impressions.total, gscPrevious.impressions.total)
        },
        sessions: {
          value: gaCurrent.sessions.total ?? 0,
          change: calculateChange(gaCurrent.sessions.total, gaPrevious.sessions.total),
          aiTraffic: {
            value: aiTraffic.totalSessions,
            percentage: aiSessionsPercentage
          }
        },
        totalUsers: {
          value: gaCurrent.totalUsers.total ?? 0,
          change: calculateChange(gaCurrent.totalUsers.total, gaPrevious.totalUsers.total)
        },
        // --- NEUE SEMRUSH KPIS ---
        semrushKeywords: {
          value: user.semrush_organic_keywords ?? 0,
          change: 0
        },
        semrushTraffic: {
          value: user.semrush_organic_traffic ?? 0,
          change: 0
        }
      },
      charts: {
        clicks: gscCurrent.clicks.daily ?? [],
        impressions: gscCurrent.impressions.daily ?? [],
        sessions: gaCurrent.sessions.daily ?? [],
        totalUsers: gaCurrent.totalUsers.daily ?? [],
      },
      topQueries,
      aiTraffic,
      // ✅ KORRIGIERT: Typsicherer Zugriff auf semrushError (kein 'any' nötig)
      semrushError: user.semrushError || null
    };
  } catch (error) {
    console.error('[getProjectDashboardData] Schwerwiegender Fehler:', error);
    // --- Fehlerfall-Rückgabe (unverändert) ---
    return {
      kpis: {
        clicks: { value: 0, change: 0 },
        impressions: { value: 0, change: 0 },
        sessions: { value: 0, change: 0, aiTraffic: { value: 0, percentage: 0 } },
        totalUsers: { value: 0, change: 0 },
        semrushKeywords: { value: 0, change: 0 },
        semrushTraffic: { value: 0, change: 0 }
      },
      charts: {
        clicks: [],
        impressions: [],
        sessions: [],
        totalUsers: [],
      },
      topQueries: defaultTopQueries,
      aiTraffic: defaultAiTraffic,
      error: `Interner Fehler: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * GET /api/projects/[id]
 * Hauptendpoint für Projekt-Dashboard-Daten
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id: userId } = session.user;
    const resolvedParams = await context.params;
    const projectId = resolvedParams.id;

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';

    console.log('[/api/projects/[id]] GET Request');
    console.log('[/api/projects/[id]] User:', session.user.email, 'Role:', role);
    console.log('[/api/projects/[id]] Project ID:', projectId);
    console.log('[/api/projects/[id]] DateRange:', dateRange);

    // --- Zugriffs-Logik (unverändert) ---
    let hasAccess = false;
    if (role === 'SUPERADMIN') {
      hasAccess = true;
    } else if (role === 'ADMIN') {
      const { rows: assignmentCheck } = await sql`
        SELECT 1
        FROM project_assignments
        WHERE user_id::text = ${userId}
        AND project_id::text = ${projectId}
        LIMIT 1;
      `;
      hasAccess = assignmentCheck.length > 0;
    } else if (role === 'BENUTZER') {
      hasAccess = userId === projectId;
    }

    if (!hasAccess) {
      console.warn(`[/api/projects/[id]] ⚠️ Zugriff verweigert für User ${userId} auf Projekt ${projectId}`);
      return NextResponse.json({
        message: 'Sie haben keine Berechtigung, dieses Projekt anzusehen.'
      }, { status: 403 });
    }

    // Lade Projekt-Daten (Basis-Typ 'User' aus der DB)
    const { rows } = await sql<User>`
      SELECT
        id, email, role, domain,
        gsc_site_url, ga4_property_id,
        semrush_organic_keywords,
        semrush_organic_traffic,
        semrush_last_fetched
      FROM users
      WHERE id::text = ${projectId}
    `;

    // ✅ KORRIGIERT: Deklariere 'project' als unseren erweiterten Typ 'ProjectUser'
    const project: ProjectUser = rows[0];

    if (!project) {
      return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    }

    // --- SEMRUSH 14-TAGE CACHING LOGIK START ---
    const lastFetched = project.semrush_last_fetched ? new Date(project.semrush_last_fetched) : null;
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const needsFetch = !lastFetched || lastFetched < fourteenDaysAgo;

    if (project.domain && needsFetch) {
      console.log(`[/api/projects/[id]] ♻️ Semrush-Daten für ${project.domain} sind veraltet. Führe Fetch aus...`);
      try {
        const newData = await getSemrushDomainOverview(project.domain, 'de');

        if (newData.error) {
          console.error(`[/api/projects/[id]] ❌ Semrush API Fehler:`, newData.error);
          // ✅ KORRIGIERT: Typsicherer Zugriff (kein 'any' nötig)
          project.semrushError = newData.error;
          project.semrush_organic_keywords = null;
          project.semrush_organic_traffic = null;
        } else {
          console.log(`[/api/projects/[id]] ✅ Semrush-Daten erfolgreich geholt.`);
          project.semrush_organic_keywords = newData.organicKeywords;
          project.semrush_organic_traffic = newData.organicTraffic;
          project.semrush_last_fetched = new Date().toISOString();

          // Asynchrones DB-Update
          sql`
            UPDATE users
            SET
              semrush_organic_keywords = ${newData.organicKeywords},
              semrush_organic_traffic = ${newData.organicTraffic},
              semrush_last_fetched = ${project.semrush_last_fetched}
            WHERE id::text = ${projectId};
          `.then(() => {
            console.log(`[/api/projects/[id]] ✅ Semrush-Cache in DB aktualisiert für ${project.domain}.`);
          }).catch((dbError) => {
            console.error(`[/api/projects/[id]] ❌ Fehler beim DB-Update des Semrush-Cache:`, dbError);
          });
        }
      } catch (fetchError) {
        console.error(`[/api/projects/[id]] ❌ Schwerer Fehler bei Semrush-Fetch:`, fetchError);
        // ✅ KORRIGIERT: Typsicherer Zugriff (kein 'any' nötig)
        project.semrushError = (fetchError as Error).message;
        project.semrush_organic_keywords = null;
        project.semrush_organic_traffic = null;
      }
    } else if (project.domain) {
      console.log(`[/api/projects/[id]] ✅ Semrush-Daten aus Cache geladen (Geholt am: ${lastFetched ? lastFetched.toISOString() : 'nie'}).`);
      // ✅ KORRIGIERT: Typsicherer Zugriff (kein 'any' nötig)
      project.semrushError = null;
    } else {
      console.log(`[/api/projects/[id]] ⚠️ Keine Domain für Semrush-Abruf konfiguriert.`);
      // ✅ KORRIGIERT: Typsicherer Zugriff (kein 'any' nötig)
      project.semrushError = null;
      project.semrush_organic_keywords = null;
      project.semrush_organic_traffic = null;
    }
    // --- SEMRUSH 14-TAGE CACHING LOGIK ENDE ---


    // ✅ Rufe Dashboard-Daten auf (Google etc.)
    // 'project' ist jetzt vom Typ 'ProjectUser' und kann sicher übergeben werden
    const dashboardData = await getProjectDashboardData(project, dateRange);

    console.log('[/api/projects/[id]] ✅ Projekt-Daten erfolgreich verarbeitet');

    return NextResponse.json(dashboardData);

  } catch (error) {
    // --- Haupt-Fehlerbehandlung (unverändert) ---
    console.error('[/api/projects/[id]] Schwerwiegender Fehler im Handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({
      message: `Fehler beim Abrufen der Projekt-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
