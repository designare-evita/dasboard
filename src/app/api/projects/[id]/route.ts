// src/app/api/projects/[id]/route.ts

import { NextResponse } from 'next/server';
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

// Hilfsfunktionen
function formatDate(date: Date): string { 
  return date.toISOString().split('T')[0]; 
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

/**
 * Lädt vollständige Dashboard-Daten für ein spezifisches Projekt
 */
async function getProjectDashboardData(user: Partial<User>, dateRange: string = '30d') {
  if (!user.gsc_site_url || !user.ga4_property_id) {
    console.warn(`[getProjectDashboardData] Projekt ${user.email} hat keine GSC/GA4-Daten konfiguriert.`);
    return null;
  }

  // ✅ Berechne Zeitraum basierend auf dateRange Parameter
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

  // Vorheriger Zeitraum (für Vergleich)
  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - daysBack);

  try {
    console.log(`[getProjectDashboardData] Lade Daten für Projekt ${user.email} (${dateRange})`);
    
    // ✅ Alle API-Calls parallel ausführen
    const [gscCurrent, gscPrevious, gaCurrent, gaPrevious, topQueries, aiTraffic] = await Promise.all([
      getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getTopQueries(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAiTrafficData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent))
    ]);
    
    console.log(`[getProjectDashboardData] ✅ Daten erfolgreich geladen`);
    console.log(`[getProjectDashboardData] KI-Traffic: ${aiTraffic.totalSessions} Sitzungen`);
    
    // ✅ KI-Traffic-Anteil berechnen
    const totalSessions = gaCurrent.sessions.total ?? 0;
    const aiSessionsPercentage = totalSessions > 0 
      ? (aiTraffic.totalSessions / totalSessions) * 100 
      : 0;

    console.log(`[getProjectDashboardData] KI-Traffic-Anteil: ${aiSessionsPercentage.toFixed(2)}%`);

    return {
      kpis: {
        clicks: { 
          value: gscCurrent.clicks.total ?? 0, 
          change: calculateChange(gscCurrent.clicks.total ?? 0, gscPrevious.clicks.total ?? 0) 
        },
        impressions: { 
          value: gscCurrent.impressions.total ?? 0, 
          change: calculateChange(gscCurrent.impressions.total ?? 0, gscPrevious.impressions.total ?? 0) 
        },
        sessions: { 
          value: gaCurrent.sessions.total ?? 0, 
          change: calculateChange(gaCurrent.sessions.total ?? 0, gaPrevious.sessions.total ?? 0),
          // ✅ KI-Traffic-Info zu Sessions hinzufügen
          aiTraffic: {
            value: aiTraffic.totalSessions,
            percentage: aiSessionsPercentage
          }
        },
        totalUsers: { 
          value: gaCurrent.totalUsers.total ?? 0, 
          change: calculateChange(gaCurrent.totalUsers.total ?? 0, gaPrevious.totalUsers.total ?? 0) 
        },
      },
      charts: {
        clicks: gscCurrent.clicks.daily,
        impressions: gscCurrent.impressions.daily,
        sessions: gaCurrent.sessions.daily,
        totalUsers: gaCurrent.totalUsers.daily,
      },
      topQueries,
      aiTraffic
    };
  } catch (error) {
    console.error('[getProjectDashboardData] Fehler beim Abrufen der Google-Daten:', error);
    throw error;
  }
}

/**
 * GET /api/projects/[id]
 * Hauptendpoint für Projekt-Dashboard-Daten
 * Query-Parameter: dateRange (optional) - '30d' | '3m' | '6m' | '12m'
 */
export async function GET(
  request: Request,
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
      // Superadmin hat Zugriff auf alle Projekte
      hasAccess = true;
    } else if (role === 'ADMIN') {
      // Admin muss dem Projekt zugewiesen sein
      const { rows } = await sql`
        SELECT 1 
        FROM project_assignments 
        WHERE user_id::text = ${userId} 
        AND project_id::text = ${projectId}
        LIMIT 1;
      `;
      hasAccess = rows.length > 0;
    } else if (role === 'BENUTZER') {
      // Benutzer kann nur sein eigenes Projekt sehen
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
      SELECT gsc_site_url, ga4_property_id, email, domain
      FROM users 
      WHERE id::text = ${projectId}
    `;

    const project = rows[0];
    if (!project) {
      return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    }

    // ✅ Übergebe dateRange Parameter
    const dashboardData = await getProjectDashboardData(project, dateRange);
    if (!dashboardData) {
      return NextResponse.json({ 
        message: 'Für dieses Projekt sind keine Google-Properties konfiguriert.' 
      }, { status: 404 });
    }

    console.log('[/api/projects/[id]] ✅ Projekt-Daten erfolgreich geladen');

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('[/api/projects/[id]] Fehler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({ 
      message: `Fehler beim Abrufen der Projekt-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
