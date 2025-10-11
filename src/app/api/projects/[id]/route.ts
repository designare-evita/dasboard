// src/app/api/projects/[id]/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';
import { sql } from '@vercel/postgres';
import { User } from '@/types';

/**
 * Formatiert ein Date-Objekt zu einem String im Format YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Berechnet die prozentuale Veränderung zwischen zwei Werten
 */
function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

/**
 * Ruft Dashboard-Daten für einen bestimmten Benutzer ab
 */
async function getDashboardDataForUser(user: Partial<User>) {
  if (!user.gsc_site_url || !user.ga4_property_id) {
    throw new Error('Für diesen Benutzer sind keine Google-Properties konfiguriert.');
  }

  // Zeiträume berechnen
  const today = new Date();
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 1);
  const startDateCurrent = new Date(endDateCurrent);
  startDateCurrent.setDate(startDateCurrent.getDate() - 29);

  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - 29);

  // Alle Daten parallel abrufen
  const [gscCurrent, gscPrevious, gaCurrent, gaPrevious] = await Promise.all([
    getSearchConsoleData(
      user.gsc_site_url,
      formatDate(startDateCurrent),
      formatDate(endDateCurrent)
    ),
    getSearchConsoleData(
      user.gsc_site_url,
      formatDate(startDatePrevious),
      formatDate(endDatePrevious)
    ),
    getAnalyticsData(
      user.ga4_property_id,
      formatDate(startDateCurrent),
      formatDate(endDateCurrent)
    ),
    getAnalyticsData(
      user.ga4_property_id,
      formatDate(startDatePrevious),
      formatDate(endDatePrevious)
    ),
  ]);

  // Dashboard-Daten strukturieren
  return {
    searchConsole: {
      clicks: {
        value: gscCurrent.clicks ?? 0,
        change: calculateChange(
          gscCurrent.clicks ?? 0,
          gscPrevious.clicks ?? 0
        ),
      },
      impressions: {
        value: gscCurrent.impressions ?? 0,
        change: calculateChange(
          gscCurrent.impressions ?? 0,
          gscPrevious.impressions ?? 0
        ),
      },
    },
    analytics: {
      sessions: {
        value: gaCurrent.sessions ?? 0,
        change: calculateChange(
          gaCurrent.sessions ?? 0,
          gaPrevious.sessions ?? 0
        ),
      },
      totalUsers: {
        value: gaCurrent.totalUsers ?? 0,
        change: calculateChange(
          gaCurrent.totalUsers ?? 0,
          gaPrevious.totalUsers ?? 0
        ),
      },
    },
  };
}

/**
 * GET Handler für Projekt-Dashboard-Daten
 * Ruft Google Search Console und Analytics Daten für ein bestimmtes Projekt ab
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Session prüfen
  const session = await getServerSession(authOptions);
  
  if (
    !session?.user ||
    (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')
  ) {
    return NextResponse.json(
      { message: 'Nicht autorisiert' },
      { status: 401 }
    );
  }

  // Params auflösen (Next.js 15+)
  const { id: projectId } = await params;

  try {
    // Benutzer aus Datenbank abrufen
    const { rows } = await sql<User>`
      SELECT gsc_site_url, ga4_property_id 
      FROM users 
      WHERE id = ${projectId} AND role = 'BENUTZER'
    `;
    
    const user = rows[0];

    if (!user) {
      return NextResponse.json(
        { message: 'Projekt nicht gefunden oder kein Kundenprojekt.' },
        { status: 404 }
      );
    }

    // Dashboard-Daten abrufen
    const dashboardData = await getDashboardDataForUser(user);

    return NextResponse.json(dashboardData);
    
  } catch (error) {
    console.error('Fehler beim Abrufen der Projektdaten:', error);
    
    const errorMessage =
      error instanceof Error ? error.message : 'Interner Serverfehler.';
    
    return NextResponse.json(
      { message: `Fehler beim Abrufen der Projektdaten: ${errorMessage}` },
      { status: 500 }
    );
  }
}
