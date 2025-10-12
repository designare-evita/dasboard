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
  console.log('[getDashboardDataForUser] Start für User:', user.email);
  
  if (!user.gsc_site_url || !user.ga4_property_id) {
    console.log('[getDashboardDataForUser] Fehlende Google-Properties');
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

  console.log('[getDashboardDataForUser] Datumsbereiche:', {
    current: `${formatDate(startDateCurrent)} bis ${formatDate(endDateCurrent)}`,
    previous: `${formatDate(startDatePrevious)} bis ${formatDate(endDatePrevious)}`
  });

  try {
    const [gscCurrent, gscPrevious, gaCurrent, gaPrevious] = await Promise.all([
      getSearchConsoleData(user.gsc_site_url, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getSearchConsoleData(user.gsc_site_url, formatDate(startDatePrevious), formatDate(endDatePrevious)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDateCurrent), formatDate(endDateCurrent)),
      getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious))
    ]);
    
    console.log('[getDashboardDataForUser] Daten erfolgreich abgerufen');
    
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
  } catch (error) {
    console.error('[getDashboardDataForUser] Fehler beim Abrufen der Google-Daten:', error);
    throw error;
  }
}

export async function GET() {
  console.log('[/api/data] GET Request empfangen');
  
  try {
    const session = await getServerSession(authOptions);
    console.log('[/api/data] Session:', {
      hasSession: !!session,
      email: session?.user?.email,
      role: session?.user?.role,
      id: session?.user?.id
    });

    if (!session?.user?.email) {
      console.log('[/api/data] Nicht autorisiert - keine Session');
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;

    // Fall 1: Super Admin - Gibt Liste der Projekte zurück
    if (role === 'SUPERADMIN') {
      console.log('[/api/data] SUPERADMIN - Lade alle BENUTZER');
      const { rows: projects } = await sql<User>`
        SELECT id, email, domain, gsc_site_url, ga4_property_id FROM users WHERE role = 'BENUTZER'
      `;
      console.log('[/api/data] Gefundene Projekte:', projects.length);
      
      // Für Admin/Superadmin: Gebe Projektliste zurück
      return NextResponse.json({ 
        role: 'SUPERADMIN',
        projects: projects 
      });
    }

    // Fall 2: Admin - Gibt Liste seiner Projekte zurück
    if (role === 'ADMIN') {
      console.log('[/api/data] ADMIN - Lade Benutzer mit createdByAdminId =', id);
      const { rows: projects } = await sql<User>`
        SELECT id, email, domain, gsc_site_url, ga4_property_id FROM users WHERE role = 'BENUTZER' AND "createdByAdminId" = ${id}
      `;
      console.log('[/api/data] Gefundene Projekte:', projects.length);
      
      // Für Admin/Superadmin: Gebe Projektliste zurück
      return NextResponse.json({ 
        role: 'ADMIN',
        projects: projects 
      });
    }
    
    // Fall 3: Kunde (BENUTZER) - Gibt Dashboard-KPIs zurück
    if (role === 'BENUTZER') {
      console.log('[/api/data] BENUTZER - Lade Dashboard-Daten für User:', id);
      const { rows } = await sql<User>`
        SELECT gsc_site_url, ga4_property_id, email FROM users WHERE id = ${id}
      `;
      console.log('[/api/data] User gefunden:', rows[0]?.email);
      
      const user = rows[0];
      if (!user) {
        console.log('[/api/data] User nicht in DB gefunden');
        return NextResponse.json({ message: 'Benutzer nicht gefunden.' }, { status: 404 });
      }
      
      console.log('[/api/data] User Properties:', {
        gsc_site_url: user.gsc_site_url,
        ga4_property_id: user.ga4_property_id
      });
      
      const dashboardData = await getDashboardDataForUser(user);
      if (!dashboardData) {
        console.log('[/api/data] Keine Google-Properties konfiguriert');
        return NextResponse.json({ message: 'Für diesen Benutzer sind keine Google-Properties konfiguriert.' }, { status: 404 });
      }
      
      console.log('[/api/data] Dashboard-Daten erfolgreich erstellt:', JSON.stringify(dashboardData, null, 2));
      
      // Für Kunden: Gebe KPIs zurück
      const response = {
        role: 'BENUTZER',
        kpis: dashboardData
      };
      console.log('[/api/data] Finale Response:', JSON.stringify(response, null, 2));
      return NextResponse.json(response);
    }

    console.log('[/api/data] Unbekannte Rolle:', role);
    return NextResponse.json({ message: 'Unbekannte Benutzerrolle.' }, { status: 403 });

  } catch (error) {
    console.error('[/api/data] FEHLER:', error);
    console.error('[/api/data] Error Stack:', error instanceof Error ? error.stack : 'Kein Stack verfügbar');
    
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({ 
      message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
