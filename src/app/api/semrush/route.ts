// src/app/api/semrush/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { User } from '@/types';
import { getSemrushData } from '@/lib/semrush-api';

/**
 * GET /api/semrush
 * Lädt Semrush-Daten für einen Benutzer
 * Query-Parameter: 
 *   - projectId (optional): Für Admins um spezifisches Projekt zu laden
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

    console.log('[/api/semrush] GET Request');
    console.log('[/api/semrush] User:', session.user.email, 'Role:', role, 'ProjectId:', projectId || 'none');

    // Bestimme welcher User geladen werden soll
    let targetUserId: string;

    if (projectId) {
      // Admin/Superadmin lädt Daten für ein spezifisches Projekt
      if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }

      // Wenn ADMIN: Prüfe ob Zugriff erlaubt ist
      if (role === 'ADMIN') {
        const { rows: assignments } = await sql`
          SELECT 1 
          FROM project_assignments 
          WHERE user_id::text = ${id} 
          AND project_id::text = ${projectId}
        `;

        if (assignments.length === 0) {
          console.warn('[/api/semrush] ⚠️ Admin hat keinen Zugriff auf dieses Projekt');
          return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
        }
      }

      targetUserId = projectId;
    } else {
      // Benutzer lädt seine eigenen Daten
      targetUserId = id;
    }

    console.log('[/api/semrush] Lade Semrush-Daten für User:', targetUserId);

    // Lade User-Konfiguration aus der Datenbank (inkl. Semrush IDs)
    const { rows } = await sql<User>`
      SELECT 
        domain,
        email,
        semrush_project_id,
        semrush_tracking_id
      FROM users 
      WHERE id::text = ${targetUserId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = rows[0];

    // Prüfe ob mindestens Domain oder Semrush Project ID konfiguriert ist
    if (!user.domain && !user.semrush_project_id) {
      console.log('[/api/semrush] Keine Domain oder Semrush Project ID für User:', user.email);
      return NextResponse.json({
        organicKeywords: null,
        organicTraffic: null,
        lastFetched: null
      });
    }

    // Bestimme Datenbank basierend auf Domain-Endung
    let database = 'de'; // Standard: Deutschland
    if (user.domain) {
      if (user.domain.endsWith('.at')) {
        database = 'at'; // Österreich
      } else if (user.domain.endsWith('.ch')) {
        database = 'ch'; // Schweiz
      } else if (user.domain.endsWith('.com')) {
        database = 'us'; // USA/International
      }
    }

    console.log('[/api/semrush] Rufe Semrush-Daten ab mit:');
    console.log('[/api/semrush] - Domain:', user.domain || 'keine');
    console.log('[/api/semrush] - Project ID:', user.semrush_project_id || 'keine');
    console.log('[/api/semrush] - Tracking ID:', user.semrush_tracking_id || 'keine');
    console.log('[/api/semrush] - Database:', database);

    // Abrufen der Semrush-Daten über die intelligente Funktion
    // Priorität: 1. Project ID, 2. Domain
    const semrushData = await getSemrushData({
      domain: user.domain || undefined,
      projectId: user.semrush_project_id || undefined,
      trackingId: user.semrush_tracking_id || undefined,
      database: database
    });

    // Prüfe ob ein Fehler aufgetreten ist
    if ('error' in semrushData) {
      console.warn('[/api/semrush] Fehler beim Abrufen der Semrush-Daten:', semrushData.error);
      return NextResponse.json({
        organicKeywords: null,
        organicTraffic: null,
        lastFetched: new Date().toISOString()
      });
    }

    console.log('[/api/semrush] ✅ Semrush-Daten erfolgreich geladen');
    console.log('[/api/semrush] Keywords:', semrushData.organicKeywords, 'Traffic:', semrushData.organicTraffic);

    // Response mit lastFetched Timestamp
    return NextResponse.json({
      organicKeywords: semrushData.organicKeywords,
      organicTraffic: semrushData.organicTraffic,
      lastFetched: new Date().toISOString()
    });

  } catch (error) {
    console.error('[/api/semrush] Fehler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ 
      message: `Fehler beim Abrufen der Semrush-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
