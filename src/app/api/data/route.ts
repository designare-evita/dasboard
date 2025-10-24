// src/app/api/data/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getSearchConsoleData,
  getAnalyticsData,
  getTopQueries,
  getAiTrafficData, // ✅ Neue Funktion
  type AiTrafficData // ✅ Typ importieren
} from '@/lib/google-api';
import { sql } from '@vercel/postgres';
import { User } from '@/types';

// Hilfsfunktionen (bleiben gleich)
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  // Sicherstellen, dass wir Zahlen haben
  const currentNum = typeof current === 'number' && !isNaN(current) ? current : 0;
  const previousNum = typeof previous === 'number' && !isNaN(previous) ? previous : 0;
  if (previousNum === 0) return currentNum > 0 ? 100 : 0;
  
  const change = ((currentNum - previousNum) / previousNum) * 100;
  return Math.round(change * 10) / 10;
}

/**
 * Lädt vollständige Dashboard-Daten für einen Benutzer inkl. KI-Traffic
 * (Logik bleibt im Kern gleich, Fehlerbehandlung leicht angepasst)
 */
async function getDashboardDataForUser(user: Partial<User>, dateRange: string = '30d') {
  if (!user.gsc_site_url || !user.ga4_property_id) {
    console.warn(`[getDashboardDataForUser] Benutzer ${user.email} hat keine GSC/GA4-Daten konfiguriert.`);
    // Wir werfen keinen Fehler mehr, sondern geben null zurück, damit der Cache funktioniert,
    // aber das Frontend muss dies behandeln.
    return null;
  }

  // Zeitraum-Berechnung (bleibt gleich)
  const today = new Date();
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 1);

  const startDateCurrent = new Date(endDateCurrent);
  let daysBack: number;

  switch (dateRange) {
    case '3m': daysBack = 90; break;
    case '6m': daysBack = 180; break;
    case '12m': daysBack = 365; break;
    case '30d': default: daysBack = 29; break;
  }

  startDateCurrent.setDate(startDateCurrent.getDate() - daysBack);

  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - daysBack);

  try {
    console.log(`[getDashboardDataForUser] Lade Daten für ${user.email} (Zeitraum: ${dateRange})`);

    // Parallele API-Calls (bleibt gleich)
    const [gscCurrent, gscPrevious, gaCurrent, gaPrevious, topQueries, aiTraffic] = await Promise.all([
      getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getTopQueries(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAiTrafficData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent))
    ]);

    console.log(`[getDashboardDataForUser] ✅ Daten erfolgreich geladen für ${user.email}`);

    // Datenverarbeitung (bleibt gleich)
    const totalSessions = gaCurrent.sessions.total ?? 0;
    const aiSessionsPercentage = totalSessions > 0
      ? (aiTraffic.totalSessions / totalSessions) * 100
      : 0;

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
    console.error(`[getDashboardDataForUser] Fehler beim Abrufen der Google-Daten für ${user.email}:`, error);
    // Wichtig: Wir werfen den Fehler weiter, damit der Haupt-Handler ihn fangen kann
    throw error;
  }
}

/**
 * GET /api/data
 * Hauptendpoint für Dashboard-Daten - unterstützt alle Rollen
 * Query-Parameter: dateRange (optional) - '30d' | '3m' | '6m' | '12m'
 * ✅ NEU: Implementiert Vercel Data Cache mit 48h Gültigkeit
 */
export async function GET(request: Request) {
  // --- Standard Caching Header ---
  const cacheHeaders = {
    // Vercel Data Cache: 48 Stunden (172800 Sekunden)
    // stale-while-revalidate: Zeigt alte Daten, während im Hintergrund aktualisiert wird
    'Cache-Control': 's-maxage=172800, stale-while-revalidate',
  };

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      // Nicht authentifizierte Anfragen sollten nicht gecacht werden
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d'; // Default 30 Tage

    console.log('[/api/data] GET Request (mit Caching)');
    console.log('[/api/data] User:', session.user.email, 'Role:', role, 'ID:', id);
    console.log('[/api/data] DateRange:', dateRange);

    // ========================================
    // SUPERADMIN: Sieht alle Benutzer-Projekte
    // (Diese Daten ändern sich seltener, könnten länger gecacht werden, aber 48h ist ok)
    // ========================================
    if (role === 'SUPERADMIN') {
      console.log('[/api/data] Loading projects for SUPERADMIN');
      const { rows: projects } = await sql<User>`
        SELECT id::text as id, email, domain, gsc_site_url, ga4_property_id
        FROM users
        WHERE role = 'BENUTZER'
        ORDER BY email ASC;
      `;
      console.log('[/api/data] Found', projects.length, 'projects for SUPERADMIN');
      // ✅ Caching Header hinzufügen
      return NextResponse.json({ role, projects }, { headers: cacheHeaders });
    }

    // ========================================
    // ADMIN: Sieht nur zugewiesene Projekte
    // (Daten ändern sich potenziell durch Zuweisung, aber 48h Cache ist meist ok)
    // ========================================
    if (role === 'ADMIN') {
      console.log('[/api/data] Loading projects for ADMIN:', id);
      const { rows: projects } = await sql<User>`
        SELECT
          u.id::text as id,
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
      // ✅ Caching Header hinzufügen
      return NextResponse.json({ role, projects }, { headers: cacheHeaders });
    }

    // ========================================
    // BENUTZER: Sieht sein eigenes Dashboard
    // (Diese Daten sollen gecacht werden)
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
        // Benutzer nicht gefunden -> 404, kein Cache sinnvoll
        return NextResponse.json({ message: 'Benutzer nicht gefunden.' }, { status: 404 });
      }

      const dashboardData = await getDashboardDataForUser(user, dateRange);

      if (!dashboardData) {
        // Konfiguration fehlt -> 404, kein Cache sinnvoll
        return NextResponse.json({
          message: 'Für diesen Benutzer sind keine Google-Properties konfiguriert.'
        }, { status: 404 });
      }

      console.log('[/api/data] ✅ Dashboard-Daten erfolgreich geladen');
      const response = {
        role: 'BENUTZER',
        ...dashboardData
      };
      // ✅ Caching Header hinzufügen
      return NextResponse.json(response, { headers: cacheHeaders });
    }

    // Unbekannte Rolle -> 403, kein Cache
    return NextResponse.json({ message: 'Unbekannte Benutzerrolle.' }, { status: 403 });

  } catch (error) {
    console.error('[/api/data] Fehler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    // Fehler -> 500, kein Cache
    return NextResponse.json({
      message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
