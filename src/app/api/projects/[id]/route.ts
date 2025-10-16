// src/app/api/projects/[id]/route.ts

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';
import { User } from '@/types';
import bcrypt from 'bcryptjs';

// --- HILFSFUNKTIONEN ---

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

async function getProjectDashboardData(user: Partial<User>) {
  if (!user.gsc_site_url || !user.ga4_property_id) {
    console.warn(`[getProjectDashboardData] Benutzer ${user.email} hat keine GSC/GA4-Daten konfiguriert.`);
    return { kpis: {}, charts: {} };
  }

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
    console.error(`[getProjectDashboardData] Fehler für ${user.email}:`, error);
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

    console.log('[GET /api/projects/[id]] Start');
    console.log('[GET] Project ID:', projectId);
    console.log('[GET] User:', session?.user?.email, 'Role:', session?.user?.role);

    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role: sessionRole, id: sessionUserId } = session.user;
    let targetUser: User | undefined;

    // SUPERADMIN: Kann alle Benutzer-Projekte sehen
    if (sessionRole === 'SUPERADMIN') {
      console.log('[GET] SUPERADMIN - Lade Projekt:', projectId);
      
      const { rows } = await sql<User>`
        SELECT * FROM users WHERE id::text = ${projectId} AND role = 'BENUTZER'
      `;
      targetUser = rows[0];
      
      if (!targetUser) {
        console.error('[GET] Projekt nicht gefunden für SUPERADMIN');
      }
    } 
    // ADMIN: Kann nur zugewiesene Projekte sehen
    else if (sessionRole === 'ADMIN') {
      console.log('[GET] ADMIN - Prüfe Zugriff auf Projekt:', projectId);
      
      // ✅ KORREKTUR: Prüfe, ob das Projekt dem Admin zugewiesen ist
      const { rows } = await sql<User>`
        SELECT u.* 
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE u.id::text = ${projectId} 
        AND u.role = 'BENUTZER'
        AND pa.user_id::text = ${sessionUserId}
      `;
      
      targetUser = rows[0];
      
      if (!targetUser) {
        console.error('[GET] Projekt nicht gefunden oder nicht zugewiesen an Admin:', sessionUserId);
        
        // Debug: Zeige alle zugewiesenen Projekte für diesen Admin
        const { rows: debugAssignments } = await sql`
          SELECT 
            u.id::text,
            u.email,
            u.domain
          FROM users u
          INNER JOIN project_assignments pa ON u.id = pa.project_id
          WHERE pa.user_id::text = ${sessionUserId}
          AND u.role = 'BENUTZER'
        `;
        
        console.log('[GET] Debug - Zugewiesene Projekte für Admin:', debugAssignments);
      }
    } 
    // BENUTZER: Kann nur sein eigenes Projekt sehen
    else if (sessionRole === 'BENUTZER') {
      console.log('[GET] BENUTZER - Lade eigenes Projekt');
      
      if (projectId !== sessionUserId) {
        console.error('[GET] BENUTZER versucht fremdes Projekt zu laden');
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }
      
      const { rows } = await sql<User>`
        SELECT * FROM users WHERE id::text = ${projectId}
      `;
      targetUser = rows[0];
    }

    if (!targetUser) {
      console.error('[GET] Kein Zugriff auf Projekt oder Projekt nicht gefunden');
      return NextResponse.json({ 
        message: 'Projekt nicht gefunden oder keine Berechtigung',
        details: 'Sie haben keine Berechtigung, dieses Projekt anzusehen, oder das Projekt existiert nicht.'
      }, { status: 404 });
    }

    console.log('[GET] Projekt gefunden:', targetUser.email, '- Lade Dashboard-Daten');

    // Dashboard-Daten für den Zielbenutzer abrufen
    const dashboardData = await getProjectDashboardData(targetUser);

    console.log('[GET] Dashboard-Daten erfolgreich geladen');

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error(`[GET /api/projects/[id]] Fehler:`, error);
    return NextResponse.json({ 
      message: 'Interner Serverfehler',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }, { status: 500 });
  }
}

// PUT - Projekt aktualisieren
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

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const body = await request.json();
    const { email, domain, gsc_site_url, ga4_property_id, password } = body;

    if (!email || !domain) {
      return NextResponse.json({ message: 'E-Mail und Domain sind erforderlich' }, { status: 400 });
    }

    // Admin: Prüfe Zugriff auf Projekt
    if (session.user.role === 'ADMIN') {
      const { rows: accessCheck } = await sql`
        SELECT u.id 
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE u.id::text = ${id} 
        AND u.role = 'BENUTZER'
        AND pa.user_id::text = ${session.user.id}
      `;

      if (accessCheck.length === 0) {
        return NextResponse.json({ message: 'Projekt nicht gefunden oder keine Berechtigung' }, { status: 404 });
      }
    }

    // Update Query
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
        WHERE id::text = ${id} AND role = 'BENUTZER'
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
        WHERE id::text = ${id} AND role = 'BENUTZER'
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

// DELETE - Projekt löschen
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

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    // Admin: Prüfe Zugriff
    let deleteQuery;
    if (session.user.role === 'SUPERADMIN') {
      deleteQuery = sql`
        DELETE FROM users 
        WHERE id::text = ${id} AND role = 'BENUTZER';
      `;
    } else {
      // Admin kann nur zugewiesene Projekte löschen
      deleteQuery = sql`
        DELETE FROM users 
        WHERE id::text = ${id} 
        AND role = 'BENUTZER'
        AND EXISTS (
          SELECT 1 FROM project_assignments 
          WHERE project_id::text = ${id} 
          AND user_id::text = ${session.user.id}
        );
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
