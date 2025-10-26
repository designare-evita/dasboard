// src/app/api/semrush/route.ts (vereinfacht - nutzt users Tabelle direkt)
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { User } from '@/types';

interface UserWithSemrush extends User {
  semrush_organic_keywords?: number;
  semrush_organic_traffic?: number;
}

/**
 * GET /api/semrush
 * Lädt Semrush-Daten für einen Benutzer (direkt aus users Tabelle)
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

    // Lade Semrush-Daten direkt aus der users Tabelle
    const { rows } = await sql<UserWithSemrush>`
      SELECT 
        email,
        domain,
        semrush_organic_keywords,
        semrush_organic_traffic
      FROM users 
      WHERE id::text = ${targetUserId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = rows[0];

    console.log('[/api/semrush] Gefundene Daten:');
    console.log('[/api/semrush] - Keywords:', user.semrush_organic_keywords);
    console.log('[/api/semrush] - Traffic:', user.semrush_organic_traffic);

    // Response zurückgeben
    return NextResponse.json({
      organicKeywords: user.semrush_organic_keywords ?? null,
      organicTraffic: user.semrush_organic_traffic ?? null,
      lastFetched: null, // Kein Timestamp in alter Struktur
      fromCache: false
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
