// src/app/api/projects/[id]/route.ts - KOMPLETT KORRIGIERT

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
import { sql } from '@vercel/postgres';
import { User } from '@/types';

// ✅ TopQuery-Typ Definition
interface TopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// Hilfsfunktionen
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
 * Gibt Platzhalterdaten zurück, wenn GSC/GA4 nicht konfiguriert sind oder Fehler auftreten.
 */
async function getProjectDashboardData(user: Partial<User>, dateRange: string = '30d') {

  // ✅ Standard-Platzhalter-Werte definieren
  const defaultGscData = { clicks: { total: 0, daily: [] }, impressions: { total: 0, daily: [] } };
  const defaultGaData = { sessions: { total: 0, daily: [] }, totalUsers: { total: 0, daily: [] } };
  const defaultTopQueries: TopQuery[] = [];
  const defaultAiTraffic: AiTrafficData = {
    totalSessions: 0,
    totalUsers: 0,
    sessionsBySource: {},
    topAiSources: [],
    trend: []
  };

  // ✅ Zeitberechnung
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
      daysBack = 29;
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

    // ✅ Promises bedingt zusammenstellen
    const gscPromises = user.gsc_site_url ? [
      getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getTopQueries(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
    ] : [
      Promise.resolve(defaultGscData),
      Promise.resolve(defaultGscData),
      Promise.resolve(defaultTopQueries)
    ];

    const gaPromises = user.ga4_property_id ? [
      getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getAiTrafficData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent))
    ] : [
      Promise.resolve(defaultGaData),
      Promise.resolve(defaultGaData),
      Promise.resolve(defaultAiTraffic)
    ];

    console.log(`[getProjectDashboardData] GSC konfiguriert: ${!!user.gsc_site_url}`);
    console.log(`[getProjectDashboardData] GA4 konfiguriert: ${!!user.ga4_property_id}`);

    // ✅ Promise.allSettled verwenden
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

    // ✅ Typsichere Helfer-Funktion mit generics
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

    const gscCurrent = getValue(gscCurrentResult, defaultGscData, 'GSC Aktuell');
    const gscPrevious = getValue(gscPreviousResult, defaultGscData, 'GSC Vorher');
    const topQueries = getValue(topQueriesResult, defaultTopQueries, 'GSC Top Queries');
    const gaCurrent = getValue(gaCurrentResult, defaultGaData, 'GA4 Aktuell');
    const gaPrevious = getValue(gaPreviousResult, defaultGaData, 'GA4 Vorher');
    const aiTraffic = getValue(aiTrafficResult, defaultAiTraffic, 'GA4 AI Traffic');

    console.log(`[getProjectDashboardData] ✅ Daten erfolgreich verarbeitet (ggf. mit Platzhaltern)`);

    // ✅ KI-Traffic-Anteil berechnen
    const totalSessions = gaCurrent.sessions.total ?? 0;
    const aiSessionsPercentage = totalSessions > 0
      ? (aiTraffic.totalSessions / totalSessions) * 100
      : 0;

    console.log(`[getProjectDashboardData] Gesamt-Sitzungen: ${totalSessions}`);
    console.log(`[getProjectDashboardData] KI-Sitzungen: ${aiTraffic.totalSessions}`);
    console.log(`[getProjectDashboardData] KI-Anteil: ${aiSessionsPercentage.toFixed(2)}%`);

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
      },
      charts: {
        clicks: gscCurrent.clicks.daily ?? [],
        impressions: gscCurrent.impressions.daily ?? [],
        sessions: gaCurrent.sessions.daily ?? [],
        totalUsers: gaCurrent.totalUsers.daily ?? [],
      },
      topQueries,
      aiTraffic
    };
  } catch (error) {
    console.error('[getProjectDashboardData] Schwerwiegender Fehler:', error);
    return {
      kpis: {
        clicks: { value: 0, change: 0 },
        impressions: { value: 0, change: 0 },
        sessions: { value: 0, change: 0, aiTraffic: { value: 0, percentage: 0 } },
        totalUsers: { value: 0, change: 0 },
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
 * Query-Parameter: dateRange (optional) - '30d' | '3m' | '6m' | '12m'
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
    const { id: projectId } = await context.params;

    // ✅ DateRange-Parameter aus URL extrahieren
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';

    console.log('[/api/projects/[id]] GET Request');
    console.log('[/api/projects/[id]] User:', session.user.email, 'Role:', role);
    console.log('[/api/projects/[id]] Project ID:', projectId);
    console.log('[/api/projects/[id]] DateRange:', dateRange);

    // Prüfe, ob der Benutzer Zugriff auf dieses Projekt hat
    let hasAccess = false;

    if (role === 'SUPERADMIN') {
      hasAccess = true;
    } else if (role === 'ADMIN') {
      const { rows } = await sql`
        SELECT 1
        FROM project_assignments
        WHERE user_id::text = ${userId}
        AND project_id::text = ${projectId}
        LIMIT 1;
      `;
      hasAccess = rows.length > 0;
    } else if (role === 'BENUTZER') {
      hasAccess = userId === projectId;
    }

    if (!hasAccess) {
      console.warn(`[/api/projects/[id]] ⚠️ Zugriff verweigert für User ${userId} auf Projekt ${projectId}`);
      return NextResponse.json({
        message: 'Sie haben keine Berechtigung, dieses Projekt anzusehen.'
      }, { status: 403 });
    }

    // Lade Projekt-Daten
    const { rows } = await sql<User>`
      SELECT id, gsc_site_url, ga4_property_id, email, domain
      FROM users
      WHERE id::text = ${projectId}
    `;

    const project = rows[0];
    if (!project) {
      return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    }

    // ✅ Rufe Dashboard-Daten auf
    const dashboardData = await getProjectDashboardData(project, dateRange);

    console.log('[/api/projects/[id]] ✅ Projekt-Daten erfolgreich verarbeitet');

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('[/api/projects/[id]] Schwerwiegender Fehler im Handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({
      message: `Fehler beim Abrufen der Projekt-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
