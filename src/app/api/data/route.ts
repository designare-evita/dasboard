// src/app/api/data/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';
import { sql } from '@vercel/postgres';
import { User } from '@/types';

// Hilfsfunktionen (unverändert)
function formatDate(date: Date): string { 
  return date.toISOString().split('T')[0]; 
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

// *** HIER IST DIE ANPASSUNG ***
// Die Funktion gibt jetzt KPIs UND Charts zurück
async function getDashboardDataForUser(user: Partial<User>) {
  if (!user.gsc_site_url || !user.ga4_property_id) {
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

  try {
    const [gscCurrent, gscPrevious, gaCurrent, gaPrevious] = await Promise.all([
      getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious))
    ]);
    
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
          change: calculateChange(gaCurrent.sessions.total ?? 0, gaPrevious.sessions.total ?? 0) 
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
      }
    };
  } catch (error) {
    console.error('[getDashboardDataForUser] Fehler beim Abrufen der Google-Daten:', error);
    throw error;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;

    // Admins sehen die Projektliste
    if (role === 'SUPERADMIN' || role === 'ADMIN') {
      const query = role === 'SUPERADMIN'
        ? sql<User>`SELECT id, email, domain, gsc_site_url, ga4_property_id FROM users WHERE role = 'BENUTZER'`
        : sql<User>`SELECT id, email, domain, gsc_site_url, ga4_property_id FROM users WHERE role = 'BENUTZER' AND "createdByAdminId" = ${id}`;
      
      const { rows: projects } = await query;
      return NextResponse.json({ role, projects });
    }
    
    // Benutzer (BENUTZER) sieht sein Dashboard
    if (role === 'BENUTZER') {
      const { rows } = await sql<User>`
        SELECT gsc_site_url, ga4_property_id, email FROM users WHERE id = ${id}
      `;
      
      const user = rows[0];
      if (!user) {
        return NextResponse.json({ message: 'Benutzer nicht gefunden.' }, { status: 404 });
      }
      
      const dashboardData = await getDashboardDataForUser(user);
      if (!dashboardData) {
        return NextResponse.json({ message: 'Für diesen Benutzer sind keine Google-Properties konfiguriert.' }, { status: 404 });
      }
      
      // *** HIER IST DIE ANPASSUNG ***
      // Die komplette Datenstruktur (kpis + charts) wird zurückgegeben
      const response = {
        role: 'BENUTZER',
        ...dashboardData 
      };
      return NextResponse.json(response);
    }

    return NextResponse.json({ message: 'Unbekannte Benutzerrolle.' }, { status: 403 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({ 
      message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
