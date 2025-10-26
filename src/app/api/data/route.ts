// src/app/api/data/route.ts
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
 * Lädt vollständige Dashboard-Daten für einen Benutzer inkl. KI-Traffic
 */
async function getDashboardDataForUser(user: Partial<User>, dateRange: string = '30d') {
  if (!user.gsc_site_url || !user.ga4_property_id) {
    console.warn(`[getDashboardDataForUser] Benutzer ${user.email} hat keine GSC/GA4-Daten konfiguriert.`);
    return null;
  }

  // Berechne Zeitraum basierend auf dateRange Parameter
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
    console.log(`[getDashboardDataForUser] Lade Daten für ${user.email}`);
    
    // Alle API-Calls parallel ausführen (inkl. KI-Traffic)
    const [gscCurrent, gscPrevious, gaCurrent, gaPrevious, topQueries, aiTraffic] = await Promise.all([
      getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getTopQueries(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAiTrafficData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent))
    ]);
    
    console.log(`[getDashboardDataForUser] ✅ Daten erfolgreich geladen`);
    console.log(`[getDashboardDataForUser] KI-Traffic: ${aiTraffic.totalSessions} Sitzungen`);
    
    // KI-Traffic-Anteil berechnen
    const totalSessions = gaCurrent.sessions.total ?? 0;
    const aiSessionsPercentage = totalSessions > 0 
      ? (aiTraffic.totalSessions / totalSessions) * 100 
      : 0;

    console.log(`[getDashboardDataForUser] KI-Traffic-Anteil: ${aiSessionsPercentage.toFixed(2)}%`);

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
    console.error('[getDashboardDataForUser] Fehler beim Abrufen der Google-Daten:', error);
    throw error;
  }
}

/**
 * GET /api/data
 * Hauptendpoint für Dashboard-Daten - unterstützt alle Rollen
 * Query-Parameter: 
 *   - dateRange (optional): '30d' | '3m' | '6m' | '12m'
 *   - projectId (optional): Für Admins um spezifisches Projekt zu laden
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;

    // Parameter aus URL extrahieren
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';
    const projectId = searchParams.get('projectId'); // NEU: projectId Parameter

    console.log('[/api/data] GET Request');
    console.log('[/api/data] User:', session.user.email, 'Role:', role, 'ID:', id);
    console.log('[/api/data] DateRange:', dateRange, 'ProjectId:', projectId || 'none');

    // ========================================
    // ADMIN/SUPERADMIN mit projectId: Lade Dashboard für spezifisches Projekt
    // ========================================
    if ((role === 'ADMIN' || role === 'SUPERADMIN') && projectId) {
      console.log('[/api/data] Admin lädt Dashboard für Projekt:', projectId);

      // Projekt-Daten laden
      const { rows } = await sql<User>`
        SELECT id, email, domain, gsc_site_url, ga4_property_id 
        FROM users 
        WHERE id::text = ${projectId}
        AND role = 'BENUTZER'
      `;

      if (rows.length === 0) {
        return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
      }

      const project = rows[0];

      // Wenn ADMIN: Prüfe ob Zugriff erlaubt ist
      if (role === 'ADMIN') {
        const { rows: assignments } = await sql`
          SELECT 1 
          FROM project_assignments 
          WHERE user_id::text = ${id} 
          AND project_id::text = ${projectId}
        `;

        if (assignments.length === 0) {
          console.warn('[/api/data] ⚠️ Admin hat keinen Zugriff auf dieses Projekt');
          return NextResponse.json({ message: 'Zugriff verweigert.' }, { status: 403 });
        }
      }

      // Dashboard-Daten für das Projekt laden
      const dashboardData = await getDashboardDataForUser(project, dateRange);
      
      if (!dashboardData) {
        return NextResponse.json({ 
          message: 'Für dieses Projekt sind keine Google-Properties konfiguriert.' 
        }, { status: 404 });
      }

      console.log('[/api/data] ✅ Dashboard-Daten für Projekt erfolgreich geladen');
      
      return NextResponse.json(dashboardData);
    }

    // ========================================
    // SUPERADMIN ohne projectId: Sieht alle Benutzer-Projekte (Übersicht)
    // ========================================
    if (role === 'SUPERADMIN' && !projectId) {
      console.log('[/api/data] Loading projects for SUPERADMIN');
      
      const { rows: projects } = await sql<User>`
        SELECT id, email, domain, gsc_site_url, ga4_property_id 
        FROM users 
        WHERE role = 'BENUTZER'
        ORDER BY email ASC;
      `;
      
      console.log('[/api/data] Found', projects.length, 'projects for SUPERADMIN');
      
      return NextResponse.json({ role, projects });
    }
    
    // ========================================
    // ADMIN ohne projectId: Sieht nur zugewiesene Projekte (Übersicht)
    // ========================================
    if (role === 'ADMIN' && !projectId) {
      console.log('[/api/data] Loading projects for ADMIN:', id);
      
      const { rows: projects } = await sql<User>`
        SELECT 
          u.id, 
          u.email, 
          u.domain, 
          u.gsc_site_url, 
          u.ga4_property_id 
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${id}
        AND u.role = 'BENUTZER'
        ORDER BY u.email ASC;
      `;
      
      console.log('[/api/data] Found', projects.length, 'assigned projects for ADMIN');
      
      if (projects.length === 0) {
        console.warn('[/api/data] ⚠️ ADMIN hat keine zugewiesenen Projekte');
      }
      
      return NextResponse.json({ role, projects });
    }
    
    // ========================================
    // BENUTZER: Sieht sein eigenes Dashboard
    // ========================================
    if (role === 'BENUTZER') {
      console.log('[/api/data] Loading dashboard for BENUTZER');
      
      const { rows } = await sql<User>`
        SELECT gsc_site_url, ga4_property_id, email 
        FROM users 
        WHERE id::text = ${id}
      `;
      
      const user = rows[0];
      if (!user) {
        return NextResponse.json({ message: 'Benutzer nicht gefunden.' }, { status: 404 });
      }
      
      const dashboardData = await getDashboardDataForUser(user, dateRange);
      if (!dashboardData) {
        return NextResponse.json({ 
          message: 'Für diesen Benutzer sind keine Google-Properties konfiguriert.' 
        }, { status: 404 });
      }
      
      console.log('[/api/data] ✅ Dashboard-Daten erfolgreich geladen');
      
      return NextResponse.json(dashboardData);
    }

    return NextResponse.json({ message: 'Unbekannte Benutzerrolle.' }, { status: 403 });

  } catch (error) {
    console.error('[/api/data] Fehler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({ 
      message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
