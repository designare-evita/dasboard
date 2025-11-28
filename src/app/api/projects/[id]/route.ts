// src/app/api/projects/[id]/route.ts (KORRIGIERT - Mit Google Cache)

import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { sql } from '@vercel/postgres';
import { User } from '@/types';
// ✅ WICHTIG: Nutze die Caching-Funktion
import { getOrFetchGoogleData } from '@/lib/google-data-loader';

interface UserRow {
  id: string;
  email: string;
  role: 'BENUTZER' | 'ADMIN' | 'SUPERADMIN';
  domain: string | null;
  gsc_site_url: string | null;
  ga4_property_id: string | null;
  semrush_project_id: string | null;
  semrush_tracking_id: string | null;
  semrush_tracking_id_02: string | null;
}

/**
 * GET /api/projects/[id]
 * Hauptendpoint für Projekt-Dashboard-Daten mit Google Cache
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id: userId } = session.user;
    const resolvedParams = await context.params;
    const projectId = resolvedParams.id;

    // DateRange-Parameter aus URL extrahieren
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';

    console.log('[/api/projects/[id]] GET Request');
    console.log('[/api/projects/[id]] User:', session.user.email, 'Role:', role);
    console.log('[/api/projects/[id]] Project ID:', projectId);
    console.log('[/api/projects/[id]] DateRange:', dateRange);

    // ========== BERECHTIGUNGSPRÜFUNG ==========
    let hasAccess = false;
    
    if (role === 'SUPERADMIN') {
      hasAccess = true;
      console.log('[/api/projects/[id]] ✅ Superadmin-Zugriff gewährt');
    } else if (role === 'ADMIN') {
      const { rows: accessCheck } = await sql`
        SELECT 1
        FROM project_assignments
        WHERE user_id::text = ${userId}
        AND project_id::text = ${projectId}
        LIMIT 1;
      `;
      hasAccess = accessCheck.length > 0;
      
      if (hasAccess) {
        console.log('[/api/projects/[id]] ✅ Admin-Zugriff gewährt (Zuweisung vorhanden)');
      } else {
        console.warn(`[/api/projects/[id]] ⚠️ Admin ${userId} hat keine Zuweisung für Projekt ${projectId}`);
      }
    } else if (role === 'BENUTZER') {
      hasAccess = userId === projectId;
      
      if (hasAccess) {
        console.log('[/api/projects/[id]] ✅ Benutzer-Zugriff gewährt (eigenes Projekt)');
      }
    }

    if (!hasAccess) {
      console.warn(`[/api/projects/[id]] ❌ Zugriff verweigert für User ${userId} auf Projekt ${projectId}`);
      return NextResponse.json({
        message: 'Sie haben keine Berechtigung, dieses Projekt anzusehen.'
      }, { status: 403 });
    }

    // ========== PROJEKT-DATEN LADEN ==========
    console.log('[/api/projects/[id]] Lade Projekt-Daten aus DB...');
    
    const { rows } = await sql<UserRow>`
      SELECT
        id::text as id,
        email,
        role,
        domain,
        gsc_site_url,
        ga4_property_id,
        semrush_project_id,
        semrush_tracking_id,
        semrush_tracking_id_02
      FROM users
      WHERE id::text = ${projectId}
    `;

    if (rows.length === 0) {
      console.error('[/api/projects/[id]] ❌ Projekt nicht gefunden:', projectId);
      return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    }

    const project = rows[0];
    console.log('[/api/projects/[id]] ✅ Projekt gefunden:', project.email);

    // ========== GOOGLE-DATEN MIT CACHE LADEN ==========
    console.log('[/api/projects/[id]] Rufe Google-Daten mit Cache-Logik ab...');
    
    try {
      // Konvertiere null zu undefined für User-Typ-Kompatibilität
      const projectData: Partial<User> = {
        ...project,
        domain: project.domain ?? undefined,
        gsc_site_url: project.gsc_site_url ?? undefined,
        ga4_property_id: project.ga4_property_id ?? undefined,
        semrush_project_id: project.semrush_project_id ?? undefined,
        semrush_tracking_id: project.semrush_tracking_id ?? undefined,
        semrush_tracking_id_02: project.semrush_tracking_id_02 ?? undefined,
      };
      
      const dashboardData = await getOrFetchGoogleData(projectData, dateRange);

      if (!dashboardData) {
        console.warn('[/api/projects/[id]] ⚠️ Keine Google-Daten verfügbar (weder GSC noch GA4 konfiguriert)');
        return NextResponse.json({
          message: 'Für dieses Projekt sind weder GSC noch GA4 konfiguriert.',
          kpis: {},
          charts: {},
          topQueries: [],
          aiTraffic: undefined
        }, { status: 200 }); // Status 200, aber leere Daten
      }

      console.log('[/api/projects/[id]] ✅ Dashboard-Daten erfolgreich geladen');
      console.log('[/api/projects/[id]] Cache-Status:', dashboardData.fromCache ? 'HIT' : 'MISS/FETCH');

      return NextResponse.json(dashboardData);

    } catch (googleError) {
      console.error('[/api/projects/[id]] ❌ Fehler beim Laden der Google-Daten:', googleError);
      
      // Bei Google-API-Fehlern: Gebe trotzdem eine valide Antwort zurück
      return NextResponse.json({
        message: 'Fehler beim Laden der Google-Daten',
        error: googleError instanceof Error ? googleError.message : 'Unbekannter Fehler',
        kpis: {},
        charts: {},
        topQueries: [],
        aiTraffic: undefined
      }, { status: 200 }); // Status 200, damit Frontend nicht crasht
    }

  } catch (error) {
    console.error('[/api/projects/[id]] ❌ Schwerwiegender Fehler im Handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    
    return NextResponse.json({
      message: `Fehler beim Abrufen der Projekt-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
