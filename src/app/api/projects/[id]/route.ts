// src/app/api/projects/[id]/route.ts (ANGEPASST - Ohne Domain Overview)

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
// NEU: Semrush API importieren (DEAKTIVIERT)
// import { getSemrushDomainOverview } from '@/lib/semrush-api';
import { sql } from '@vercel/postgres';
import { User } from '@/types'; // Stelle sicher, dass User die Semrush-Felder enthält

// ✅ Typ-Definitionen (unverändert aus deiner Datei)
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

// ✅ NEU: Erweiterter User-Typ mit Semrush Error-Feld
interface UserWithSemrushError extends Partial<User> {
  semrushError?: string | null; // Behalten wir bei, falls wir es später brauchen
}

// Hilfsfunktionen (unverändert)
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
 * (Liest jetzt auch Semrush-Daten aus dem user-Objekt)
 */
async function getProjectDashboardData(user: UserWithSemrushError, dateRange: string = '30d') {

  // Standard-Platzhalter-Werte (unverändert)
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

  // Zeitberechnung (unverändert)
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
      daysBack = 29; // Korrigiert von 29 auf 30 Tage
      break;
  }

  startDateCurrent.setDate(startDateCurrent.getDate() - daysBack);

  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - daysBack);

  try {
    console.log(`[getProjectDashboardData] Lade Daten für Projekt ${user.email} (${dateRange})`);
    console.log(`[getProjectDashboardData] Aktueller Zeitraum: ${formatDate(startDateCurrent)} bis ${formatDate(endDateCurrent)}`);
    console.log(`[getProjectDashboardData] Vorheriger Zeitraum: ${formatDate(startDatePrevious)} bis ${formatDate(endDatePrevious)}`);

    // Promises bedingt zusammenstellen (unverändert)
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

    // Promise.allSettled verwenden (unverändert)
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

    // Typsichere Helfer-Funktion (unverändert)
    const getValue = <T,>(
      result: PromiseSettledResult<T>,
      defaultValue: T,
      apiName: string
    ): T => {
      if (result.status === 'fulfilled') {
        console.log(`[getProjectDashboardData] ✅ ${apiName} erfolgreich`);
        // Fallback, falls der API-Call 'undefined' oder 'null' zurückgibt
        return result.value ?? defaultValue;
      }
      console.error(`[getProjectDashboardData] ❌ ${apiName} Fehler:`, result.reason);
      return defaultValue;
    };

    const gscCurrent: GscData = getValue(gscCurrentResult, defaultGscData, 'GSC Aktuell');
    const gscPrevious: GscData = getValue(gscPreviousResult, defaultGscData, 'GSC Vorher');
    const topQueries: TopQuery[] = getValue(topQueriesResult, defaultTopQueries, 'GSC Top Queries');
    const gaCurrent: GaData = getValue(gaCurrentResult, defaultGaData, 'GA4 Aktuell');
    const gaPrevious: GaData = getValue(gaPreviousResult, defaultGaData, 'GA4 Vorher');
    const aiTraffic: AiTrafficData = getValue(aiTrafficResult, defaultAiTraffic, 'GA4 AI Traffic');

    console.log(`[getProjectDashboardData] ✅ Daten erfolgreich verarbeitet (ggf. mit Platzhaltern)`);

    // KI-Traffic-Anteil berechnen (unverändert)
    const totalSessions = gaCurrent.sessions.total ?? 0;
    const aiSessionsPercentage = totalSessions > 0
      ? (aiTraffic.totalSessions / totalSessions) * 100
      : 0;

    console.log(`[getProjectDashboardData] Gesamt-Sitzungen: ${totalSessions}`);
    console.log(`[getProjectDashboardData] KI-Sitzungen: ${aiTraffic.totalSessions}`);
    console.log(`[getProjectDashboardData] KI-Anteil: ${aiSessionsPercentage.toFixed(2)}%`);

    // ✅ DATENRÜCKGABE (mit Semrush KPIs) - ZEILE 232 KORRIGIERT
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
        
        // --- SEMRUSH DEAKTIVIERT ---
        /*
        semrushKeywords: {
          value: user.semrush_organic_keywords ?? 0,
          change: 0 // Keine historischen Daten für Vergleich
        },
        semrushTraffic: {
          value: user.semrush_organic_traffic ?? 0,
          change: 0 // Keine historischen Daten für Vergleich
        }
        */
      },
      charts: {
        clicks: gscCurrent.clicks.daily ?? [],
        impressions: gscCurrent.impressions.daily ?? [],
        sessions: gaCurrent.sessions.daily ?? [],
        totalUsers: gaCurrent.totalUsers.daily ?? [],
      },
      topQueries,
      aiTraffic,
      // ✅ KORRIGIERT: Type-safe Zugriff auf semrushError
      semrushError: user.semrushError || null
    };
  } catch (error) {
    console.error('[getProjectDashboardData] Schwerwiegender Fehler:', error);
    // Fehlerfall-Rückgabe (mit Semrush Standardwerten)
    return {
      kpis: {
        clicks: { value: 0, change: 0 },
        impressions: { value: 0, change: 0 },
        sessions: { value: 0, change: 0, aiTraffic: { value: 0, percentage: 0 } },
        totalUsers: { value: 0, change: 0 },
        // --- NEUE SEMRUSH KPIS (Standardwerte) ---
        // semrushKeywords: { value: 0, change: 0 }, // DEAKTIVIERT
        // semrushTraffic: { value: 0, change: 0 } // DEAKTIVIERT
        // ----------------------------------------
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
 * (Jetzt mit Semrush 14-Tage-Caching-Logik)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } // context.params ist ein Promise
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id: userId } = session.user;
    // projectId aus dem context Promise extrahieren
    const resolvedParams = await context.params;
    const projectId = resolvedParams.id;


    // DateRange-Parameter aus URL extrahieren (unverändert)
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';

    console.log('[/api/projects/[id]] GET Request');
    console.log('[/api/projects/[id]] User:', session.user.email, 'Role:', role);
    console.log('[/api/projects/[id]] Project ID:', projectId);
    console.log('[/api/projects/[id]] DateRange:', dateRange);

    // Zugriffs-Logik 'hasAccess' (unverändert)
    let hasAccess = false;
    if (role === 'SUPERADMIN') {
      hasAccess = true;
    } else if (role === 'ADMIN') {
      // Annahme: project_assignments Tabelle existiert
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

    // Lade Projekt-Daten (inkl. der NEUEN Semrush-Felder)
    const { rows } = await sql<User>`
      SELECT
        id,
        email,
        role,
        domain,
        gsc_site_url,
        ga4_property_id
        /* -- DEAKTIVIERT --
        semrush_organic_keywords,
        semrush_organic_traffic,
        semrush_last_fetched
        */
      FROM users
      WHERE id::text = ${projectId}
    `;

    const project = rows[0];
    if (!project) {
      return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    }

    // ✅ KORRIGIERT: Erweitere project-Typ mit semrushError
    const projectWithError: UserWithSemrushError = { ...project };

    // --- NEUE SEMRUSH 14-TAGE CACHING LOGIK START ---
    
    // DEAKTIVIERT, DA WIR NUR NOCH KEYWORDS VERWENDEN (IN /api/semrush/keywords)
    /*
    const lastFetched = project.semrush_last_fetched ? new Date(project.semrush_last_fetched) : null;
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const needsFetch = !lastFetched || lastFetched < fourteenDaysAgo;

    // Nur fetchen, wenn eine Domain vorhanden ist UND ein Fetch nötig ist
    if (project.domain && needsFetch) {
      console.log(`[/api/projects/[id]] ♻️ Semrush-Daten für ${project.domain} sind veraltet (> 14 Tage) oder fehlen. Führe Fetch aus...`);
      try {
        // TODO: 'de' ist hier hartkodiert. Zukünftig könnte dies auch aus der DB kommen.
        const newData = await getSemrushDomainOverview(project.domain, 'de');

        if (newData.error) {
          console.error(`[/api/projects/[id]] ❌ Semrush API Fehler:`, newData.error);
          // ✅ KORRIGIERT (Zeile 355): Type-safe Error-Zuweisung
          projectWithError.semrushError = newData.error;
          // Setze KPIs auf undefined, wenn Fehler auftritt, damit alte Daten nicht angezeigt werden
          projectWithError.semrush_organic_keywords = undefined;
          projectWithError.semrush_organic_traffic = undefined;
        } else {
          console.log(`[/api/projects/[id]] ✅ Semrush-Daten erfolgreich geholt.`);
          // Aktualisiere das 'project'-Objekt für die aktuelle Anfrage
          projectWithError.semrush_organic_keywords = newData.organicKeywords ?? undefined;
          projectWithError.semrush_organic_traffic = newData.organicTraffic ?? undefined;
          projectWithError.semrush_last_fetched = new Date().toISOString(); // Aktualisiere Zeitstempel

          // Asynchrones Update der Datenbank (muss nicht blockieren)
          sql`
            UPDATE users
            SET
              semrush_organic_keywords = ${newData.organicKeywords ?? undefined},
              semrush_organic_traffic = ${newData.organicTraffic ?? undefined},
              semrush_last_fetched = ${projectWithError.semrush_last_fetched}
            WHERE id::text = ${projectId};
          `.then(() => {
            console.log(`[/api/projects/[id]] ✅ Semrush-Cache in DB aktualisiert für ${project.domain}.`);
          }).catch((dbError) => {
            console.error(`[/api/projects/[id]] ❌ Fehler beim DB-Update des Semrush-Cache:`, dbError);
          });
        }
      } catch (fetchError) {
        console.error(`[/api/projects/[id]] ❌ Schwerer Fehler bei Semrush-Fetch:`, fetchError);
        // ✅ KORRIGIERT (Zeile 382): Type-safe Error-Zuweisung
        projectWithError.semrushError = (fetchError as Error).message;
         // Setze KPIs auf undefined bei schwerem Fehler
        projectWithError.semrush_organic_keywords = undefined;
        projectWithError.semrush_organic_traffic = undefined;
      }
    } else if (project.domain) {
      // Gültiger Cache vorhanden
      console.log(`[/api/projects/[id]] ✅ Semrush-Daten aus Cache geladen (Geholt am: ${lastFetched ? lastFetched.toISOString() : 'nie'}).`);
      // ✅ KORRIGIERT (Zeile 391): Type-safe Error-Zuweisung
      projectWithError.semrushError = null;
    } else {
      // Keine Domain konfiguriert
      console.log(`[/api/projects/[id]] ⚠️ Keine Domain für Semrush-Abruf konfiguriert.`);
       // Setze KPIs auf undefined, wenn keine Domain da ist
      projectWithError.semrush_organic_keywords = undefined;
      projectWithError.semrush_organic_traffic = undefined;
      // ✅ KORRIGIERT (Zeile 398): Type-safe Error-Zuweisung
      projectWithError.semrushError = null;
    }
    */
    // --- NEUE SEMRUSH 14-TAGE CACHING LOGIK ENDE ---

    // ✅ Rufe Dashboard-Daten auf (Google etc.)
    // getProjectDashboardData liest die Semrush-Daten (frisch, alt oder null) jetzt direkt aus dem 'project'-Objekt
    const dashboardData = await getProjectDashboardData(projectWithError, dateRange);

    console.log('[/api/projects/[id]] ✅ Projekt-Daten erfolgreich verarbeitet');

    return NextResponse.json(dashboardData);

  } catch (error) {
    // Haupt-Fehlerbehandlung (unverändert)
    console.error('[/api/projects/[id]] Schwerwiegender Fehler im Handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({
      message: `Fehler beim Abrufen der Projekt-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
