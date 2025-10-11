// src/app/api/data/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';
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

  const [gscCurrent, gscPrevious, gaCurrent, gaPrevious] = await Promise.all([
    getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
    getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
    getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
    getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious))
  ]);
  
  // ✅ KORREKTUR: Zugriff auf .total statt direkten Wert
  return {
    searchConsole: {
      clicks: { 
        value: gscCurrent.clicks.total ?? 0, 
        change: calculateChange(gscCurrent.clicks.total ?? 0, gscPrevious.clicks.total ?? 0) 
      },
      impressions: { 
        value: gscCurrent.impressions.total ?? 0, 
        change: calculateChange(gscCurrent.impressions.total ?? 0, gscPrevious.impressions.total ?? 0) 
      },
    },
    analytics: {
      sessions: { 
        value: gaCurrent.sessions.total ?? 0, 
        change: calculateChange(gaCurrent.sessions.total ?? 0, gaPrevious.sessions.total ?? 0) 
      },
      totalUsers: { 
        value: gaCurrent.totalUsers.total ?? 0, 
        change: calculateChange(gaCurrent.totalUsers.total ?? 0, gaPrevious.totalUsers.total ?? 0) 
      },
    },
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  // --- DIAGNOSE-MODUS ---
  const debugInfo = {
    detectedRole: session.user.role,
    detectedId: session.user.id,
    query: ""
  };

  try {
    const { role, id } = session.user;

    // Fall 1: Super Admin
    if (role === 'SUPERADMIN') {
      debugInfo.query = "SELECT id, email, domain FROM users WHERE role = 'BENUTZER'";
      const { rows: projects } = await sql<User>`
        SELECT id, email, domain FROM users WHERE role = 'BENUTZER'
      `;
      return NextResponse.json({ debugInfo, projects });
    }

    // Fall 2: Admin
    if (role === 'ADMIN') {
      debugInfo.query = `SELECT id, email, domain FROM users WHERE role = 'BENUTZER' AND created_by = ${id}`;
      const { rows: projects } = await sql<User>`
        SELECT id, email, domain FROM users WHERE role = 'BENUTZER' AND created_by = ${id}
      `;
      return NextResponse.json({ debugInfo, projects });
    }
    
    // Fall 3: Kunde (BENUTZER)
    if (role === 'BENUTZER') {
      debugInfo.query = `SELECT gsc_site_url, ga4_property_id FROM users WHERE id = ${id}`;
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

    // Fallback
    return NextResponse.json({ message: 'Unbekannte Benutzerrolle.' }, { status: 403 });

  } catch (error) {
    console.error('Fehler in der /api/data Route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({ message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}` }, { status: 500 });
  }
}
