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

// ========================================================================
// KORRIGIERTE TYPEN
// ========================================================================

// NEU: Definition für die täglichen Chart-Datenpunkte, um 'any' zu vermeiden
interface DailyDataPoint {
  date: string;
  value: number;
}

// Typen für Standard-Daten (wichtig für optionale Ladung)
type GscData = { clicks: { total: number, daily: DailyDataPoint[] }, impressions: { total: number, daily: DailyDataPoint[] } };
type GaData = { sessions: { total: number, daily: DailyDataPoint[] }, totalUsers: { total: number, daily: DailyDataPoint[] } };
type TopQueryData = Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number; }>;

// Standard/Fallback-Werte
const DEFAULT_GSC_DATA: GscData = { clicks: { total: 0, daily: [] }, impressions: { total: 0, daily: [] } };
// Der 'previous' Typ braucht nur 'total', da 'daily' nicht verwendet wird
const DEFAULT_GSC_PREVIOUS = { clicks: { total: 0 }, impressions: { total: 0 } };
const DEFAULT_GA_DATA: GaData = { sessions: { total: 0, daily: [] }, totalUsers: { total: 0, daily: [] } };
const DEFAULT_GA_PREVIOUS = { sessions: { total: 0 }, totalUsers: { total: 0 } };
const DEFAULT_TOP_QUERIES: TopQueryData = [];
const DEFAULT_AI_TRAFFIC: AiTrafficData = {
  totalSessions: 0,
  totalUsers: 0,
  sessionsBySource: {},
  topAiSources: [],
  trend: [],
};


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
 * Lädt GSC- und GA4-Daten unabhängig voneinander.
 */
async function getDashboardDataForUser(user: Partial<User>, dateRange: string = '30d') {
  
  // Nur abbrechen, wenn BEIDE IDs fehlen
  if (!user.gsc_site_url && !user.ga4_property_id) {
    console.warn(`[getDashboardDataForUser] Benutzer ${user.email} hat WEDER GSC noch GA4-Daten konfiguriert.`);
    return null; // Hier ist der Abbruch korrekt
  }

  // --- Datumsberechnungen ---
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

  // --- Formatierte Daten ---
  const sDateCurrent = formatDate(startDateCurrent);
  const eDateCurrent = formatDate(endDateCurrent);
  const sDatePrevious = formatDate(startDatePrevious);
  const eDatePrevious = formatDate(endDatePrevious);

  // --- Daten-Initialisierung ---
  let gscCurrent: GscData = DEFAULT_GSC_DATA;
  let gscPrevious: { clicks: { total: number }, impressions: { total: number } } = DEFAULT_GSC_PREVIOUS;
  let topQueries: TopQueryData = DEFAULT_TOP_QUERIES;
  
  let gaCurrent: GaData = DEFAULT_GA_DATA;
  let gaPrevious: { sessions: { total: number }, totalUsers: { total: number } } = DEFAULT_GA_PREVIOUS;
  let aiTraffic: AiTrafficData = DEFAULT_AI_TRAFFIC;

  try {
    console.log(`[getDashboardDataForUser] Lade Daten für ${user.email} (${dateRange})`);

    // --- Promise-Arrays für GSC und GA4 ---
    const gscPromises = [];
    const ga4Promises = [];

    // GSC-Daten HINZUFÜGEN, WENN VORHANDEN
    if (user.gsc_site_url) {
      console.log(`[DEBUG] Lade GSC-Daten für: ${user.gsc_site_url}`);
      gscPromises.push(getSearchConsoleData(user.gsc_site_url, sDateCurrent, eDateCurrent));
      gscPromises.push(getSearchConsoleData(user.gsc_site_url, sDatePrevious, eDatePrevious));
      gscPromises.push(getTopQueries(user.gsc_site_url, sDateCurrent, eDateCurrent));
    } else {
      console.warn(`[DEBUG] Überspringe GSC-Daten, da gsc_site_url fehlt.`);
    }

    // GA4-Daten HINZUFÜGEN, WENN VORHANDEN
    if (user.ga4_property_id) {
      console.log(`[DEBUG] Lade GA4-Daten für Property: ${user.ga4_property_id}`);
      ga4Promises.push(getAnalyticsData(user.ga4_property_id, sDateCurrent, eDateCurrent));
      ga4Promises.push(getAnalyticsData(user.ga4_property_id, sDatePrevious, eDatePrevious));
      ga4Promises.push(getAiTrafficData(user.ga4_property_id, sDateCurrent, eDateCurrent));
    } else {
      console.warn(`[DEBUG] Überspringe GA4-Daten, da ga4_property_id fehlt.`);
    }

    // Beide Gruppen parallel ausführen
    const [gscResults, ga4Results] = await Promise.all([
      Promise.all(gscPromises),
      Promise.all(ga4Promises)
    ]);

    // Ergebnisse zuweisen, falls sie geladen wurden
    if (gscResults.length > 0) {
      [gscCurrent, gscPrevious, topQueries] = gscResults as [GscData, typeof gscPrevious, TopQueryData];
    }
    if (ga4Results.length > 0) {
      [gaCurrent, gaPrevious, aiTraffic] = ga4Results as [GaData, typeof gaPrevious, AiTrafficData];
    }
    
    console.log(`[getDashboardDataForUser] ✅ Daten erfolgreich geladen (GSC: ${gscResults.length > 0}, GA4: ${ga4Results.length > 0})`);

    // --- Aufbereitung ---
    const totalSessions = gaCurrent.sessions.total ?? 0;
    const aiSessionsPercentage = totalSessions > 0
      ? (aiTraffic.totalSessions / totalSessions) * 100
      : 0;

    console.log(`[getDashboardDataForUser] KI-Traffic: ${aiTraffic.totalSessions} Sitzungen`);
    console.log(`[getDashboardDataForUser] KI-Traffic-Anteil: ${aiSessionsPercentage.toFixed(2)}%`);

    // --- Rückgabeobjekt (funktioniert jetzt auch mit Teildaten) ---
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
        clicks: gscCurrent.clicks.daily ?? [],
        impressions: gscCurrent.impressions.daily ?? [],
        sessions: gaCurrent.sessions.daily ?? [],
        totalUsers: gaCurrent.totalUsers.daily ?? [],
      },
      topQueries,
      aiTraffic
    };
  } catch (error) {
    console.error('[getDashboardDataForUser] Fehler beim Abrufen der Google-Daten:', error);
    // Wenn hier ein Fehler auftritt, ist es ein ECHTER API-Fehler (z.B. Berechtigungen)
    throw error;
  }
}

/**
 * ========================================================================
 * GET /api/data (Rest der Datei)
 * ========================================================================
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';
    const projectId = searchParams.get('projectId'); 

    console.log('[/api/data] GET Request');
    console.log('[/api/data] User:', session.user.email, 'Role:', role, 'ID:', id);
    console.log('[/api/data] DateRange:', dateRange, 'ProjectId:', projectId || 'none');

    // ========================================
    // ADMIN/SUPERADMIN mit projectId
    // ========================================
    if ((role === 'ADMIN' || role === 'SUPERADMIN') && projectId) {
      console.log('[/api/data] Admin/Superadmin lädt Dashboard für Projekt:', projectId);

      const { rows } = await sql<User>`
        SELECT id, email, domain, gsc_site_url, ga4_property_id
        FROM users
        WHERE id::text = ${projectId}
        AND role = 'BENUTZER'
      `;

      if (rows.length === 0) {
        return NextResponse.json({ message: 'Projekt nicht gefunden oder kein BENUTZER.' }, { status: 404 });
      }

      const project = rows[0];

      if (role === 'ADMIN') {
        const { rows: assignments } = await sql`
          SELECT 1 FROM project_assignments
          WHERE user_id::text = ${id} AND project_id::text = ${projectId}
        `;
        if (assignments.length === 0) {
          console.warn('[/api/data] ⚠️ Admin hat keinen Zugriff auf dieses Projekt');
          return NextResponse.json({ message: 'Zugriff verweigert.' }, { status: 403 });
        }
      }

      const dashboardData = await getDashboardDataForUser(project, dateRange);

      // Diese Prüfung schlägt jetzt nur noch fehl, wenn BEIDE IDs fehlen
      if (!dashboardData) {
        return NextResponse.json({
          message: 'Für dieses Projekt sind weder Google Search Console noch Google Analytics Properties konfiguriert.'
        }, { status: 404 });
      }

      console.log('[/api/data] ✅ Dashboard-Daten für Projekt erfolgreich geladen');
      return NextResponse.json(dashboardData);
    }

    // ========================================
    // SUPERADMIN ohne projectId (Übersicht)
    // ========================================
    if (role === 'SUPERADMIN' && !projectId) {
      console.log('[/api/data] Lade Projektliste für SUPERADMIN');
      const { rows: projects } = await sql<User>`
        SELECT id::text AS id, email, domain, gsc_site_url, ga4_property_id
        FROM users WHERE role = 'BENUTZER' ORDER BY email ASC;
      `;
      console.log('[/api/data] Gefunden:', projects.length, 'Projekte für SUPERADMIN');
      return NextResponse.json({ role, projects });
    }

    // ========================================
    // ADMIN ohne projectId (Übersicht)
    // ========================================
    if (role === 'ADMIN' && !projectId) {
      console.log('[/api/data] Lade zugewiesene Projekte für ADMIN:', id);
      const { rows: projects } = await sql<User>`
        SELECT u.id::text AS id, u.email, u.domain, u.gsc_site_url, u.ga4_property_id
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${id} AND u.role = 'BENUTZER'
        ORDER BY u.email ASC;
      `;
      console.log('[/api/data] Gefunden:', projects.length, 'zugewiesene Projekte für ADMIN');
      if (projects.length === 0) {
        console.warn('[/api/data] ⚠️ ADMIN hat keine zugewiesenen Projekte');
      }
      return NextResponse.json({ role, projects });
    }

    // ========================================
    // BENUTZER (Eigenes Dashboard)
    // ========================================
    if (role === 'BENUTZER') {
      console.log('[/api/data] Lade Dashboard für BENUTZER');
      const { rows } = await sql<User>`
        SELECT gsc_site_url, ga4_property_id, email
        FROM users WHERE id::text = ${id}
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

    console.error('[/api/data] Unerwarteter Zustand:', role);
    return NextResponse.json({ message: 'Unbekannte Benutzerrolle.' }, { status: 403 });

  } catch (error) {
    console.error('[/api/data] Schwerwiegender Fehler im Handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    
    // Dieser Fehler fängt jetzt die ECHTEN API-Fehler (z.B. Permissions)
    return NextResponse.json({
      message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}`,
    }, { status: 500 });
  }
}
