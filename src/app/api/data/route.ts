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
  const currentNum = typeof current === 'number' && !isNaN(current) ? current : 0;
  const previousNum = typeof previous === 'number' && !isNaN(previous) ? previous : 0;
  if (previousNum === 0) return currentNum > 0 ? 100 : 0;
  
  const change = ((currentNum - previousNum) / previousNum) * 100;
  return Math.round(change * 10) / 10;
}

/**
 * Lädt vollständige Dashboard-Daten für einen Benutzer inkl. KI-Traffic
 */
async function getDashboardDataForUser(user: Partial<User>, dateRange: string = '30d') {
  console.log('[getDashboardDataForUser] START für User:', user.email);
  console.log('[getDashboardDataForUser] GSC Site URL:', user.gsc_site_url);
  console.log('[getDashboardDataForUser] GA4 Property ID:', user.ga4_property_id);
  
  if (!user.gsc_site_url || !user.ga4_property_id) {
    console.warn(`[getDashboardDataForUser] ⚠️ Benutzer ${user.email} hat keine GSC/GA4-Daten konfiguriert.`);
    console.warn(`[getDashboardDataForUser] gsc_site_url: ${user.gsc_site_url}, ga4_property_id: ${user.ga4_property_id}`);
    
    // ✅ WICHTIG: Gibt ein leeres Dashboard zurück statt null
    return {
      kpis: {
        clicks: { value: 0, change: 0 },
        impressions: { value: 0, change: 0 },
        sessions: { 
          value: 0, 
          change: 0,
          aiTraffic: { value: 0, percentage: 0 }
        },
        totalUsers: { value: 0, change: 0 }
      },
      charts: {
        clicks: [],
        impressions: [],
        sessions: [],
        totalUsers: []
      },
      topQueries: [],
      aiTraffic: {
        totalSessions: 0,
        sources: []
      },
      configurationMissing: true // ✅ Flag für Frontend
    };
  }

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
    console.log(`[getDashboardDataForUser] 📊 Lade Daten für ${user.email} (Zeitraum: ${dateRange})`);
    console.log(`[getDashboardDataForUser] Zeitraum: ${formatDate(startDateCurrent)} bis ${formatDate(endDateCurrent)}`);

    // Parallele API-Calls mit individueller Fehlerbehandlung
    const [gscCurrent, gscPrevious, gaCurrent, gaPrevious, topQueries, aiTraffic] = await Promise.allSettled([
      getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getTopQueries(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAiTrafficData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent))
    ]);

    // ✅ Prüfe, ob alle Requests erfolgreich waren
    const hasErrors = [gscCurrent, gscPrevious, gaCurrent, gaPrevious, topQueries, aiTraffic]
      .some(result => result.status === 'rejected');

    if (hasErrors) {
      console.error('[getDashboardDataForUser] ❌ Fehler bei API-Aufrufen:');
      [gscCurrent, gscPrevious, gaCurrent, gaPrevious, topQueries, aiTraffic].forEach((result, index) => {
        const names = ['GSC Current', 'GSC Previous', 'GA Current', 'GA Previous', 'Top Queries', 'AI Traffic'];
        if (result.status === 'rejected') {
          console.error(`  - ${names[index]}: ${result.reason}`);
        }
      });
      
      // ✅ Werfe detaillierten Fehler
      throw new Error('Fehler beim Abrufen der Google-Daten. Bitte prüfe die API-Konfiguration und Berechtigungen.');
    }

    // ✅ Extrahiere erfolgreiche Werte
    const gscCurrentData = gscCurrent.status === 'fulfilled' ? gscCurrent.value : null;
    const gscPreviousData = gscPrevious.status === 'fulfilled' ? gscPrevious.value : null;
    const gaCurrentData = gaCurrent.status === 'fulfilled' ? gaCurrent.value : null;
    const gaPreviousData = gaPrevious.status === 'fulfilled' ? gaPrevious.value : null;
    const topQueriesData = topQueries.status === 'fulfilled' ? topQueries.value : [];
    const aiTrafficData = aiTraffic.status === 'fulfilled' ? aiTraffic.value : { totalSessions: 0, sources: [] };

    console.log(`[getDashboardDataForUser] ✅ Daten erfolgreich geladen für ${user.email}`);
    console.log(`[getDashboardDataForUser] GSC Clicks: ${gscCurrentData?.clicks?.total ?? 0}`);
    console.log(`[getDashboardDataForUser] GA Sessions: ${gaCurrentData?.sessions?.total ?? 0}`);

    const totalSessions = gaCurrentData?.sessions?.total ?? 0;
    const aiSessionsPercentage = totalSessions > 0
      ? (aiTrafficData.totalSessions / totalSessions) * 100
      : 0;

    return {
      kpis: {
        clicks: {
          value: gscCurrentData?.clicks?.total ?? 0,
          change: calculateChange(
            gscCurrentData?.clicks?.total ?? 0, 
            gscPreviousData?.clicks?.total ?? 0
          )
        },
        impressions: {
          value: gscCurrentData?.impressions?.total ?? 0,
          change: calculateChange(
            gscCurrentData?.impressions?.total ?? 0, 
            gscPreviousData?.impressions?.total ?? 0
          )
        },
        sessions: {
          value: gaCurrentData?.sessions?.total ?? 0,
          change: calculateChange(
            gaCurrentData?.sessions?.total ?? 0, 
            gaPreviousData?.sessions?.total ?? 0
          ),
          aiTraffic: {
            value: aiTrafficData.totalSessions,
            percentage: aiSessionsPercentage
          }
        },
        totalUsers: {
          value: gaCurrentData?.totalUsers?.total ?? 0,
          change: calculateChange(
            gaCurrentData?.totalUsers?.total ?? 0, 
            gaPreviousData?.totalUsers?.total ?? 0
          )
        },
      },
      charts: {
        clicks: gscCurrentData?.clicks?.daily ?? [],
        impressions: gscCurrentData?.impressions?.daily ?? [],
        sessions: gaCurrentData?.sessions?.daily ?? [],
        totalUsers: gaCurrentData?.totalUsers?.daily ?? [],
      },
      topQueries: topQueriesData,
      aiTraffic: aiTrafficData
    };
  } catch (error) {
    console.error(`[getDashboardDataForUser] ❌ FEHLER beim Abrufen der Google-Daten für ${user.email}:`, error);
    console.error(`[getDashboardDataForUser] Error Stack:`, error instanceof Error ? error.stack : 'Kein Stack verfügbar');
    throw error;
  }
}

/**
 * GET /api/data
 * Hauptendpoint für Dashboard-Daten - unterstützt alle Rollen
 */
export async function GET(request: Request) {
  const cacheHeaders = {
    'Cache-Control': 's-maxage=172800, stale-while-revalidate',
  };

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      console.warn('[/api/data] ⚠️ Unauthenticated request');
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id, email } = session.user;

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';

    console.log('='.repeat(80));
    console.log('[/api/data] 🔍 GET Request');
    console.log('[/api/data] User:', email, '| Role:', role, '| ID:', id);
    console.log('[/api/data] DateRange:', dateRange);
    console.log('='.repeat(80));

    // SUPERADMIN
    if (role === 'SUPERADMIN') {
      console.log('[/api/data] 👑 Loading projects for SUPERADMIN');
      const { rows: projects } = await sql<User>`
        SELECT id::text as id, email, domain, gsc_site_url, ga4_property_id
        FROM users
        WHERE role = 'BENUTZER'
        ORDER BY email ASC;
      `;
      console.log('[/api/data] ✅ Found', projects.length, 'projects for SUPERADMIN');
      return NextResponse.json({ role, projects }, { headers: cacheHeaders });
    }

    // ADMIN
    if (role === 'ADMIN') {
      console.log('[/api/data] 👔 Loading projects for ADMIN:', id);
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
      console.log('[/api/data] ✅ Found', projects.length, 'assigned projects for ADMIN');
      return NextResponse.json({ role, projects }, { headers: cacheHeaders });
    }

    // BENUTZER
    if (role === 'BENUTZER') {
      console.log('[/api/data] 👤 Loading dashboard for BENUTZER:', email);
      
      const { rows } = await sql<User>`
        SELECT gsc_site_url, ga4_property_id, email, domain
        FROM users
        WHERE id::text = ${id}
      `;
      
      const user = rows[0];
      
      if (!user) {
        console.error('[/api/data] ❌ User not found in database');
        return NextResponse.json({ message: 'Benutzer nicht gefunden.' }, { status: 404 });
      }

      console.log('[/api/data] 📋 User data from DB:', {
        email: user.email,
        domain: user.domain,
        has_gsc: !!user.gsc_site_url,
        has_ga4: !!user.ga4_property_id
      });

      // ✅ WICHTIG: Rufe getDashboardDataForUser auf (gibt jetzt immer ein Objekt zurück)
      const dashboardData = await getDashboardDataForUser(user, dateRange);

      console.log('[/api/data] ✅ Dashboard data loaded successfully');
      console.log('[/api/data] Configuration missing?', dashboardData.configurationMissing || false);

      const response = {
        role: 'BENUTZER',
        ...dashboardData
      };

      return NextResponse.json(response, { headers: cacheHeaders });
    }

    console.error('[/api/data] ❌ Unknown user role:', role);
    return NextResponse.json({ message: 'Unbekannte Benutzerrolle.' }, { status: 403 });

  } catch (error) {
    console.error('='.repeat(80));
    console.error('[/api/data] ❌ FATAL ERROR');
    console.error('[/api/data] Error:', error);
    console.error('[/api/data] Error Type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[/api/data] Error Message:', error instanceof Error ? error.message : String(error));
    console.error('[/api/data] Stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('='.repeat(80));
    
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    
    return NextResponse.json({
      message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error),
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    }, { status: 500 });
  }
}
