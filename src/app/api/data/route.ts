// src/app/api/data/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';
import { sql } from '@vercel/postgres';
import { User } from '@/types';

// Hilfsfunktionen (unverändert)
function formatDate(date: Date): string { return date.toISOString().split('T')[0]; }
function calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    const change = ((current - previous) / previous) * 100;
    return Math.round(change * 10) / 10;
}

// Neue, saubere Funktion, um die KPI-Daten für EINEN Benutzer abzurufen
async function getDashboardDataForUser(user: Partial<User>) {
    if (!user.gsc_site_url || !user.ga4_property_id) {
        // Dies ist kein Fehler, sondern bedeutet nur, dass für diesen User nichts konfiguriert ist.
        return null;
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

    const [gscCurrent, gscPrevious, gaCurrent, gaPrevious] = await Promise.all([
        getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
        getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
        getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
        getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious))
    ]);
    
    return {
        searchConsole: {
            clicks: { value: gscCurrent.clicks ?? 0, change: calculateChange(gscCurrent.clicks ?? 0, gscPrevious.clicks ?? 0) },
            impressions: { value: gscCurrent.impressions ?? 0, change: calculateChange(gscCurrent.impressions ?? 0, gscPrevious.impressions ?? 0) },
        },
        analytics: {
            sessions: { value: gaCurrent.sessions ?? 0, change: calculateChange(gaCurrent.sessions ?? 0, gaPrevious.sessions ?? 0) },
            totalUsers: { value: gaCurrent.totalUsers ?? 0, change: calculateChange(gaCurrent.totalUsers ?? 0, gaPrevious.totalUsers ?? 0) },
        },
    };
}


export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { role, id } = session.user;

    // Fall 1: Super Admin
    if (role === 'SUPERADMIN') {
      const { rows: projects } = await sql<User>`
        SELECT id, email, domain FROM users WHERE role = 'USER'
      `;
      return NextResponse.json(projects);
    }

    // Fall 2: Admin
    if (role === 'ADMIN') {
        const { rows: projects } = await sql<User>`
            SELECT id, email, domain FROM users WHERE role = 'USER' AND created_by = ${id}
        `;
        return NextResponse.json(projects);
    }
    
    // Fall 3: Kunde (USER)
    if (role === 'BENUTZER') {
        const { rows } = await sql<User>`
            SELECT gsc_site_url, ga4_property_id FROM users WHERE id = ${id}
        `;
        const user = rows[0];
        if (!user) {
            return NextResponse.json({ message: 'Benutzer nicht gefunden.' }, { status: 404 });
        }
        const dashboardData = await getDashboardDataForUser(user);
        if (!dashboardData) {
            return NextResponse.json({ message: 'Für diesen Benutzer sind keine Google-Properties konfiguriert.' }, { status: 404 });
        }
        return NextResponse.json(dashboardData);
    }

    // Fallback, falls die Rolle unbekannt ist
    return NextResponse.json({ message: 'Unbekannte Benutzerrolle.' }, { status: 403 });

  } catch (error) {
    console.error('Fehler in der /api/data Route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({ message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}` }, { status: 500 });
  }
}
