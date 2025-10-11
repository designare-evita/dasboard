// src/app/api/projects/[id]/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';
import { sql } from '@vercel/postgres';
import { User } from '@/types';

// Hilfsfunktion: Formatiert ein Datum in 'YYYY-MM-DD'
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Hilfsfunktion: Berechnet die prozentuale Veränderung
function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

// Ruft die vollständigen Dashboard-Daten (KPIs + Chart-Daten) für einen Benutzer ab
async function getDashboardDataForUser(user: Partial<User>) {
  if (!user.gsc_site_url || !user.ga4_property_id) {
    throw new Error('Für diesen Benutzer sind keine Google-Properties konfiguriert.');
  }

  // Definiert die Zeiträume
  const today = new Date();
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 1);
  const startDateCurrent = new Date(endDateCurrent);
  startDateCurrent.setDate(startDateCurrent.getDate() - 29);

  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - 29);

  // Ruft die Daten von den Google-APIs ab
  const [
    gscCurrent,
    gscPrevious,
    gaCurrent,
    gaPrevious
  ] = await Promise.all([
    getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
    getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
    getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
    getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious))
  ]);

  // Baut die finale Datenstruktur für die Antwort auf
  return {
    kpis: {
      clicks: { value: gscCurrent.clicks.total, change: calculateChange(gscCurrent.clicks.total, gscPrevious.clicks.total) },
      impressions: { value: gscCurrent.impressions.total, change: calculateChange(gscCurrent.impressions.total, gscPrevious.impressions.total) },
      sessions: { value: gaCurrent.sessions.total, change: calculateChange(gaCurrent.sessions.total, gaPrevious.sessions.total) },
      totalUsers: { value: gaCurrent.totalUsers.total, change: calculateChange(gaCurrent.totalUsers.total, gaPrevious.totalUsers.total) },
    },
    charts: {
      clicks: gscCurrent.clicks.daily,
      impressions: gscCurrent.impressions.daily,
      sessions: gaCurrent.sessions.daily,
      totalUsers: gaCurrent.totalUsers.daily,
    }
  };
}

// Der GET-Handler für die API-Route
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const { id: projectId } = params;

  try {
    const { rows } = await sql<User>`
        SELECT gsc_site_url, ga4_property_id FROM users WHERE id = ${projectId} AND role = 'BENUTZER'
    `;
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ message: 'Projekt nicht gefunden oder kein Kundenprojekt.' }, { status: 404 });
    }

    const dashboardData = await getDashboardDataForUser(user);
    
    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error("Fehler in /api/projects/[id]:", error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({ message: `Fehler beim Abrufen der Projektdaten: ${errorMessage}` }, { status: 500 });
  }
}
