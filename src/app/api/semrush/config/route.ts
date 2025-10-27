// src/app/api/semrush/config/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * GET /api/semrush/config
 * Lädt die Semrush-Konfiguration (Project ID, Tracking ID) für einen User
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Bestimme welcher User geladen werden soll
    let targetUserId: string;

    if (projectId) {
      // Admin greift auf anderes Projekt zu
      if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }

      if (role === 'ADMIN') {
        // Prüfe ob Admin Zugriff auf dieses Projekt hat
        const { rows: assignments } = await sql`
          SELECT 1 
          FROM project_assignments 
          WHERE user_id::text = ${id} 
          AND project_id::text = ${projectId}
        `;

        if (assignments.length === 0) {
          return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
        }
      }

      targetUserId = projectId;
    } else {
      // User greift auf eigene Daten zu
      targetUserId = id;
    }

    // Lade Config aus DB
    const { rows } = await sql`
      SELECT 
        semrush_project_id,
        semrush_tracking_id,
        updated_at
      FROM users 
      WHERE id::text = ${targetUserId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = rows[0];

    return NextResponse.json({
      semrushProjectId: user.semrush_project_id,
      semrushTrackingId: user.semrush_tracking_id,
      lastUpdated: user.updated_at
    });

  } catch (error) {
    console.error('[/api/semrush/config] GET Error:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Laden der Konfiguration',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * PUT /api/semrush/config
 * Aktualisiert die Semrush-Konfiguration (Project ID, Tracking ID)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Bestimme welcher User aktualisiert werden soll
    let targetUserId: string;

    if (projectId) {
      // Admin aktualisiert anderes Projekt
      if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }

      if (role === 'ADMIN') {
        // Prüfe ob Admin Zugriff auf dieses Projekt hat
        const { rows: assignments } = await sql`
          SELECT 1 
          FROM project_assignments 
          WHERE user_id::text = ${id} 
          AND project_id::text = ${projectId}
        `;

        if (assignments.length === 0) {
          return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
        }
      }

      targetUserId = projectId;
    } else {
      // User aktualisiert eigene Daten
      targetUserId = id;
    }

    // Parse Request Body
    const body = await request.json();
    const { semrushProjectId, semrushTrackingId } = body;

    console.log('[/api/semrush/config] Updating config for user:', targetUserId);
    console.log('[/api/semrush/config] New values:', { semrushProjectId, semrushTrackingId });

    // Update in DB
    const { rows } = await sql`
      UPDATE users 
      SET 
        semrush_project_id = ${semrushProjectId || null},
        semrush_tracking_id = ${semrushTrackingId || null},
        updated_at = NOW()
      WHERE id::text = ${targetUserId}
      RETURNING semrush_project_id, semrush_tracking_id, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const updatedUser = rows[0];

    // WICHTIG: Invalidiere Semrush-Caches nach Konfigurationsänderung
    try {
      // Lösche alten Cache damit neue Daten mit neuer Config abgerufen werden
      await sql`
        DELETE FROM semrush_data_cache 
        WHERE user_id::text = ${targetUserId}
      `;
      
      await sql`
        DELETE FROM semrush_keywords_cache 
        WHERE user_id::text = ${targetUserId}
      `;
      
      console.log('[/api/semrush/config] ✅ Caches invalidiert');
    } catch (cacheError) {
      console.error('[/api/semrush/config] Fehler beim Invalidieren des Cache:', cacheError);
      // Nicht kritisch, weiter machen
    }

    console.log('[/api/semrush/config] ✅ Config gespeichert');

    return NextResponse.json({
      semrushProjectId: updatedUser.semrush_project_id,
      semrushTrackingId: updatedUser.semrush_tracking_id,
      lastUpdated: updatedUser.updated_at
    });

  } catch (error) {
    console.error('[/api/semrush/config] PUT Error:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Speichern der Konfiguration',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
