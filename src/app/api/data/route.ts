// src/app/api/data/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
// HIER IST DIE KORREKTUR: getGa4Data -> getAnalyticsData
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api'; 
import { sql } from '@vercel/postgres';
import { User } from '@/types';

// Hilfsfunktion zur Datumsformatierung (YYYY-MM-DD)
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Hilfsfunktion zur Berechnung der prozentualen Veränderung
function calculateChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { rows } = await sql<User>`
      SELECT gsc_site_url, ga4_property_id 
      FROM users 
      WHERE email = ${session.user.email}
    `;
    const userData = rows[0];

    if (!userData?.gsc_site_url || !userData?.ga4_property_id) {
      return NextResponse.json({ message: 'Google-Properties nicht für diesen Benutzer konfiguriert.' }, { status: 404 });
    }

    const today = new Date();
    const endDateCurrent = new Date(today);
    endDateCurrent.setDate(endDateCurrent.getDate() - 1);
    const startDateCurrent = new Date(endDateCurrent);
    startDateCurrent.setDate(startDateCurrent.getDate() - 29);

    const endDatePrevious = new Date(startDateCurrent);
    endDatePrevious.setDate(endDatePrevious.getDate() - 1);
    const startDatePrevious = new Date(endDatePrevious);
    startDatePrevious.setDate(startDatePrevious.getDate() - 29);

    const [
      gscCurrent,
      gscPrevious,
      gaCurrent,
      gaPrevious
    ] = await Promise.all([
      getSearchConsoleData(userData.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getSearchConsoleData(userData.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      // HIER IST DIE KORREKTUR: getGa4Data -> getAnalyticsData
      getAnalyticsData(userData.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAnalyticsData(userData.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious))
    ]);

    const data = {
      searchConsole: {
        clicks: {
          value: gscCurrent.clicks ?? 0,
          change: calculateChange(gscCurrent.clicks ?? 0, gscPrevious.clicks ?? 0),
        },
        impressions: {
          value: gscCurrent.impressions ?? 0,
          change: calculateChange(gscCurrent.impressions ?? 0, gscPrevious.impressions ?? 0),
        },
      },
      analytics: {
        sessions: {
          value: gaCurrent.sessions ?? 0,
          change: calculateChange(gaCurrent.sessions ?? 0, gaPrevious.sessions ?? 0),
        },
        totalUsers: {
          value: gaCurrent.totalUsers ?? 0,
          change: calculateChange(gaCurrent.totalUsers ?? 0, gaPrevious.totalUsers ?? 0),
        },
      },
    };

    return NextResponse.json(data);

  } catch (error) {
    console.error('Fehler in der /api/data Route:', error);
    return NextResponse.json({ message: 'Interner Serverfehler beim Abrufen der Dashboard-Daten.' }, { status: 500 });
  }
}
