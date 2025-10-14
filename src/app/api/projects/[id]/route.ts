// src/app/api/projects/[id]/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';
import { User } from '@/types';
import bcrypt from 'bcryptjs';

// --- HILFSFUNKTIONEN (aus /api/data/route.ts übernommen) ---

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

// Diese Funktion holt alle Google-Daten (KPIs und Charts) für einen bestimmten Benutzer
async function getProjectDashboardData(user: Partial<User>) {
  if (!user.gsc_site_url || !user.ga4_property_id) {
    console.warn(`[API /projects/${user.id}] Benutzer ${user.email} hat keine GSC/GA4-Daten konfiguriert.`);
    // Leere Datenstruktur zurückgeben, damit das Frontend Platzhalter anzeigen kann
    return { kpis: {}, charts: {} };
  }

  // Datumsbereiche definieren
  const endDateCurrent = new Date();
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
      getAnalyticsData(user.ga4_property_id, formatDate(startDatePrevious), formatDate(endDatePrevious)),
    ]);

    // Daten für das Frontend aufbereiten (KPIs und Chart-Daten)
    return {
      kpis: {
        clicks: {
          value: gscCurrent.clicks.total,
          change: calculateChange(gscCurrent.clicks.total, gscPrevious.clicks.total),
        },
        impressions: {
          value: gscCurrent.impressions.total,
          change: calculateChange(gscCurrent.impressions.total, gscPrevious.impressions.total),
        },
        sessions: {
          value: gaCurrent.sessions.total,
          change: calculateChange(gaCurrent.sessions.total, gaPrevious.sessions.total),
        },
        totalUsers: {
          value: gaCurrent.totalUsers.total,
          change: calculateChange(gaCurrent.totalUsers.total, gaPrevious.totalUsers.total),
        },
      },
      charts: {
        clicks: gscCurrent.clicks.daily,
        impressions: gscCurrent.impressions.daily,
        sessions: gaCurrent.sessions.daily,
        totalUsers: gaCurrent.totalUsers.daily,
      },
    };
  } catch (error) {
    console.error(`[API /projects/${user.id}] Fehler beim Abrufen der Google-Daten für ${user.email}:`, error);
    // Bei Fehler leere Daten zurückgeben, um einen Crash zu vermeiden
    return { kpis: {}, charts: {}, error: (error as Error).message };
  }
}


// --- API ROUTE HANDLER ---

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role: sessionRole, id: sessionUserId } = session.user;

    let targetUser: User | undefined;

    // Admin/Superadmin: Holen den ZIEL-Benutzer
    if (sessionRole === 'SUPERADMIN' || sessionRole === 'ADMIN') {
      let query;
      if (sessionRole === 'SUPERADMIN') {
        query = sql<User>`
          SELECT * FROM users WHERE id = ${projectId} AND role = 'BENUTZER'
        `;
      } else { // ADMIN
        query = sql<User>`
          SELECT * FROM users WHERE id = ${projectId} AND role = 'BENUTZER' AND "createdByAdminId" = ${sessionUserId}
        `;
      }
      const { rows } = await query;
      targetUser = rows[0];

    // Benutzer: Darf nur seine eigenen Daten sehen
    } else if (sessionRole === 'BENUTZER') {
      if (projectId !== sessionUserId) {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }
      const { rows } = await sql<User>`
        SELECT * FROM users WHERE id = ${projectId}
      `;
      targetUser = rows[0];
    }

    if (!targetUser) {
      return NextResponse.json({ message: 'Projekt nicht gefunden oder keine Berechtigung' }, { status: 404 });
    }

    // *** NEU: Google Dashboard-Daten für den Zielbenutzer abrufen ***
    const dashboardData = await getProjectDashboardData(targetUser);

    // Die kompletten Dashboard-Daten (KPIs + Charts) zurückgeben
    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error(`[API /projects/${(await params).id}] Fehler:`, error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// PUT und DELETE bleiben unverändert...
// (Code für PUT und DELETE hier einfügen, wie in deiner Originaldatei)
// Handler zum Aktualisieren eines "Projekts" (= Benutzer)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Nur Admins und Superadmins dürfen bearbeiten
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const body = await request.json();
    const { email, domain, gsc_site_url, ga4_property_id, password } = body;

    // Validierung
    if (!email || !domain) {
      return NextResponse.json({ message: 'E-Mail und Domain sind erforderlich' }, { status: 400 });
    }

    // Prüfen ob Projekt dem Admin gehört (oder Superadmin ist)
    if (session.user.role === 'ADMIN') {
      const { rows: existingProject } = await sql`
        SELECT * FROM users 
        WHERE id = ${id} AND role = 'BENUTZER' AND "createdByAdminId" = ${session.user.id}
      `;

      if (existingProject.length === 0) {
        return NextResponse.json({ message: 'Projekt nicht gefunden oder keine Berechtigung' }, { status: 404 });
      }
    }

    // Update Query vorbereiten - role wird NICHT geändert (bleibt BENUTZER)
    let updateQuery;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery = sql`
        UPDATE users
        SET 
          email = ${email},
          domain = ${domain},
          gsc_site_url = ${gsc_site_url},
          ga4_property_id = ${ga4_property_id},
          password = ${hashedPassword}
        WHERE id = ${id} AND role = 'BENUTZER'
        RETURNING id, email, role, domain, gsc_site_url, ga4_property_id;
      `;
    } else {
      updateQuery = sql`
        UPDATE users
        SET 
          email = ${email},
          domain = ${domain},
          gsc_site_url = ${gsc_site_url},
          ga4_property_id = ${ga4_property_id}
        WHERE id = ${id} AND role = 'BENUTZER'
        RETURNING id, email, role, domain, gsc_site_url, ga4_property_id;
      `;
    }

    const { rows } = await updateQuery;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Projekts:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}

// Handler zum Löschen eines "Projekts" (= Benutzer)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Nur Admins und Superadmins dürfen löschen
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    // Prüfen ob Projekt dem Admin gehört (oder Superadmin ist)
    let deleteQuery;
    if (session.user.role === 'SUPERADMIN') {
      deleteQuery = sql`
        DELETE FROM users 
        WHERE id = ${id} AND role = 'BENUTZER';
      `;
    } else {
      deleteQuery = sql`
        DELETE FROM users 
        WHERE id = ${id} AND role = 'BENUTZER' AND "createdByAdminId" = ${session.user.id};
      `;
    }

    const result = await deleteQuery;

    if (result.rowCount === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden oder keine Berechtigung' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Projekt erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Projekts:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
