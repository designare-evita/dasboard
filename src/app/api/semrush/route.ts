// src/app/api/semrush/route.ts (Hybrid - liest aus Cache UND users Tabelle)
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
 * Lädt Semrush-Daten für einen Benutzer
 * Priorität: 1. Cache-Tabelle, 2. users-Tabelle als Fallback
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

    // STRATEGIE: Lade aus BEIDEN Tabellen und kombiniere die Daten
    const { rows } = await sql<UserWithSemrush & {
      cache_keywords?: number;
      cache_traffic?: number;
      cache_last_fetched?: string;
    }>`
      SELECT 
        u.email,
        u.domain,
        u.semrush_organic_keywords,
        u.semrush_organic_traffic,
        sdc.organic_keywords as cache_keywords,
        sdc.organic_traffic as cache_traffic,
        sdc.last_fetched as cache_last_fetched
      FROM users u
      LEFT JOIN semrush_data_cache sdc ON u.id = sdc.user_id
      WHERE u.id::text = ${targetUserId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = rows[0];

    console.log('[/api/semrush] Gefundene Daten:');
    console.log('[/api/semrush] - users.semrush_organic_keywords:', user.semrush_organic_keywords);
    console.log('[/api/semrush] - users.semrush_organic_traffic:', user.semrush_organic_traffic);
    console.log('[/api/semrush] - cache.organic_keywords:', user.cache_keywords);
    console.log('[/api/semrush] - cache.organic_traffic:', user.cache_traffic);
    console.log('[/api/semrush] - cache.last_fetched:', user.cache_last_fetched);

    // INTELLIGENTE AUSWAHL:
    // Wenn Cache-Daten vorhanden UND nicht 0/null sind → verwende Cache
    // Sonst → verwende users-Tabelle
    
    let organicKeywords: number | null = null;
    let organicTraffic: number | null = null;
    let lastFetched: string | null = null;
    let fromCache = false;

    // Prüfe Cache zuerst
    if (user.cache_keywords !== null && user.cache_keywords !== undefined) {
      organicKeywords = user.cache_keywords;
      organicTraffic = user.cache_traffic ?? null;
      lastFetched = user.cache_last_fetched ?? null;
      fromCache = true;
      console.log('[/api/semrush] ✅ Verwende Daten aus Cache');
    } 
    // Fallback auf users-Tabelle
    else if (user.semrush_organic_keywords !== null && user.semrush_organic_keywords !== undefined) {
      organicKeywords = user.semrush_organic_keywords;
      organicTraffic = user.semrush_organic_traffic ?? null;
      lastFetched = null; // users-Tabelle hat kein timestamp
      fromCache = false;
      console.log('[/api/semrush] ✅ Verwende Daten aus users-Tabelle (Fallback)');
    }
    // Keine Daten vorhanden
    else {
      console.log('[/api/semrush] ⚠️ Keine Semrush-Daten gefunden');
    }

    // Response zurückgeben
    return NextResponse.json({
      organicKeywords,
      organicTraffic,
      lastFetched,
      fromCache
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
