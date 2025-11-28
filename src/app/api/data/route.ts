// src/app/api/data/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth'; // KORRIGIERT: Import von auth
import { sql } from '@vercel/postgres';
import { UserSchema } from '@/lib/schemas';
// ✅ NEU: Importiere unseren Caching-Loader
import { getOrFetchGoogleData } from '@/lib/google-data-loader';

export async function GET(request: Request) {
  try {
    const session = await auth(); // KORRIGIERT: auth() aufgerufen

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id } = session.user;
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30d';
    const projectId = searchParams.get('projectId'); 

    console.log('[/api/data] GET Request');
    console.log('[/api/data] User:', session.user.email, 'Role:', role, 'ID:', id);
    console.log('[/api/data] DateRange:', dateRange, 'ProjectId:', projectId || 'none');

    // ========================================
    // ADMIN/SUPERADMIN mit projectId
    // ========================================
    if ((role === 'ADMIN' || role === 'SUPERADMIN') && projectId) {
      console.log('[/api/data] Admin/Superadmin lädt Dashboard für Projekt:', projectId);

      // (Berechtigungsprüfung bleibt gleich)
     const { rows } = await sql`
        SELECT *
        FROM users
        WHERE id::text = ${projectId}
        AND role = 'BENUTZER'
      `;
      
      if (rows.length === 0) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });

      // HIER PASSIERT DIE MAGIE: Zod repariert 'permissions: null' zu '[]'
      const parseResult = UserSchema.safeParse(rows[0]);
      
      if (!parseResult.success) {
        console.error("User Data Invalid:", parseResult.error);
        return NextResponse.json({ message: 'Projektdaten fehlerhaft' }, { status: 500 });
      }
      
      const project = parseResult.data;

      if (role === 'ADMIN') {
        const { rows: assignments } = await sql`
          SELECT 1 FROM project_assignments
          WHERE user_id::text = ${id} AND project_id::text = ${projectId}
        `;
        if (assignments.length === 0) return NextResponse.json({ message: 'Zugriff verweigert.' }, { status: 403 });
      }
      
      // ✅ AUFRUF AN CACHING-FUNKTION
      const dashboardData = await getOrFetchGoogleData(project, dateRange);

      if (!dashboardData) {
        return NextResponse.json({
          message: 'Für dieses Projekt sind weder GSC noch GA4 konfiguriert.'
        }, { status: 404 });
      }
      return NextResponse.json(dashboardData);
    }

    // ========================================
    // SUPERADMIN ohne projectId (Übersicht)
    // ========================================
    if (role === 'SUPERADMIN' && !projectId) {
      // (Diese Logik bleibt unverändert, da sie keine Google-Daten lädt)
      console.log('[/api/data] Lade Projektliste für SUPERADMIN');
      const { rows: projects } = await sql<User>`
        SELECT id::text AS id, email, domain
        FROM users WHERE role = 'BENUTZER' ORDER BY email ASC;
      `;
      return NextResponse.json({ role, projects });
    }

    // ========================================
    // ADMIN ohne projectId (Übersicht)
    // ========================================
    if (role === 'ADMIN' && !projectId) {
      // (Diese Logik bleibt unverändert, da sie keine Google-Daten lädt)
      console.log('[/api/data] Lade zugewiesene Projekte für ADMIN:', id);
      const { rows: projects } = await sql<User>`
        SELECT u.id::text AS id, u.email, u.domain
        FROM users u
        INNER JOIN project_assignments pa ON u.id = pa.project_id
        WHERE pa.user_id::text = ${id} AND u.role = 'BENUTZER'
        ORDER BY u.email ASC;
      `;
      return NextResponse.json({ role, projects });
    }

    // ========================================
    // BENUTZER (Eigenes Dashboard)
    // ========================================
    if (role === 'BENUTZER') {
      console.log('[/api/data] Lade Dashboard für BENUTZER');
      const { rows } = await sql`
        SELECT *
        FROM users WHERE id::text = ${id}
      `;
      
      if (rows.length === 0) return NextResponse.json({ message: 'Benutzer nicht gefunden.' }, { status: 404 });

      const parseResult = UserSchema.safeParse(rows[0]);
      
      if (!parseResult.success) {
        console.error("User Data Invalid:", parseResult.error);
        return NextResponse.json({ message: 'Benutzerdaten fehlerhaft' }, { status: 500 });
      }
      
      const user = parseResult.data;

      // ✅ AUFRUF AN CACHING-FUNKTION
      const dashboardData = await getOrFetchGoogleData(user, dateRange);

      if (!dashboardData) {
        return NextResponse.json({
          message: 'Für diesen Benutzer sind keine Google-Properties konfiguriert.'
        }, { status: 404 });
      }
      return NextResponse.json(dashboardData);
    }

    return NextResponse.json({ message: 'Unbekannte Benutzerrolle.' }, { status: 403 });

  } catch (error) {
    console.error('[/api/data] Schwerwiegender Fehler im Handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler.';
    return NextResponse.json({
      message: `Fehler beim Abrufen der Dashboard-Daten: ${errorMessage}`,
    }, { status: 500 });
  }
}
