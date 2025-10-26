// src/app/api/semrush/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { User } from '@/types';
import { getSemrushData } from '@/lib/semrush-api';

// Cache-Gültigkeit: 14 Tage in Millisekunden
const CACHE_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Prüft ob gecachte Daten noch gültig sind (< 14 Tage alt)
 */
function isCacheValid(lastFetched: Date): boolean {
  const now = new Date();
  const timeDiff = now.getTime() - new Date(lastFetched).getTime();
  return timeDiff < CACHE_DURATION_MS;
}

/**
 * GET /api/semrush
 * Lädt Semrush-Daten für einen Benutzer (mit 14-Tage Cache)
 * Query-Parameter: 
 *   - projectId (optional): Für Admins um spezifisches Projekt zu laden
 *   - forceRefresh (optional): true um Cache zu umgehen
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
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    console.log('[/api/semrush] GET Request');
    console.log('[/api/semrush] User:', session.user.email, 'Role:', role, 'ProjectId:', projectId || 'none');
    console.log('[/api/semrush] Force Refresh:', forceRefresh);

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

    // 1. SCHRITT: Prüfe Cache (falls nicht forceRefresh)
    if (!forceRefresh) {
      const { rows: cachedData } = await sql`
        SELECT 
          organic_keywords,
          organic_traffic,
          last_fetched
        FROM semrush_data_cache
        WHERE user_id::text = ${targetUserId}
      `;

      if (cachedData.length > 0) {
        const cache = cachedData[0];
        const lastFetched = new Date(cache.last_fetched);

        if (isCacheValid(lastFetched)) {
          console.log('[/api/semrush] ✅ Cache-Hit! Daten sind', Math.floor((Date.now() - lastFetched.getTime()) / (1000 * 60 * 60 * 24)), 'Tage alt');
          
          return NextResponse.json({
            organicKeywords: cache.organic_keywords,
            organicTraffic: cache.organic_traffic,
            lastFetched: lastFetched.toISOString(),
            fromCache: true
          });
        } else {
          console.log('[/api/semrush] ⏰ Cache abgelaufen (älter als 14 Tage), rufe neue Daten ab');
        }
      } else {
        console.log('[/api/semrush] 🆕 Kein Cache vorhanden, rufe Daten ab');
      }
    } else {
      console.log('[/api/semrush] 🔄 Force Refresh - Cache wird ignoriert');
    }

    // 2. SCHRITT: Lade User-Konfiguration aus der Datenbank
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
        lastFetched: null,
        fromCache: false
      });
    }

    // 3. SCHRITT: Bestimme Datenbank basierend auf Domain-Endung
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

    // 4. SCHRITT: Abrufen der Semrush-Daten über die API
    const semrushData = await getSemrushData({
      domain: user.domain || undefined,
      projectId: user.semrush_project_id || undefined,
      trackingId: user.semrush_tracking_id || undefined,
      database: database
    });

    // Prüfe ob ein Fehler aufgetreten ist
    if ('error' in semrushData) {
      console.warn('[/api/semrush] Fehler beim Abrufen der Semrush-Daten:', semrushData.error);
      
      // Gebe gecachte Daten zurück wenn vorhanden (auch wenn abgelaufen)
      const { rows: fallbackCache } = await sql`
        SELECT organic_keywords, organic_traffic, last_fetched
        FROM semrush_data_cache
        WHERE user_id::text = ${targetUserId}
      `;

      if (fallbackCache.length > 0) {
        console.log('[/api/semrush] 💾 Verwende abgelaufenen Cache als Fallback');
        return NextResponse.json({
          organicKeywords: fallbackCache[0].organic_keywords,
          organicTraffic: fallbackCache[0].organic_traffic,
          lastFetched: new Date(fallbackCache[0].last_fetched).toISOString(),
          fromCache: true,
          error: 'Daten konnten nicht aktualisiert werden'
        });
      }

      return NextResponse.json({
        organicKeywords: null,
        organicTraffic: null,
        lastFetched: new Date().toISOString(),
        fromCache: false
      });
    }

    console.log('[/api/semrush] ✅ Semrush-Daten erfolgreich geladen');
    console.log('[/api/semrush] Keywords:', semrushData.organicKeywords, 'Traffic:', semrushData.organicTraffic);

    // 5. SCHRITT: Speichere Daten im Cache
    const now = new Date();
    try {
      await sql`
        INSERT INTO semrush_data_cache (user_id, organic_keywords, organic_traffic, last_fetched)
        VALUES (${targetUserId}::uuid, ${semrushData.organicKeywords}, ${semrushData.organicTraffic}, ${now.toISOString()})
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          organic_keywords = ${semrushData.organicKeywords},
          organic_traffic = ${semrushData.organicTraffic},
          last_fetched = ${now.toISOString()}
      `;
      console.log('[/api/semrush] 💾 Daten im Cache gespeichert');
    } catch (cacheError) {
      console.error('[/api/semrush] Fehler beim Speichern im Cache:', cacheError);
      // Nicht kritisch - Daten können trotzdem zurückgegeben werden
    }

    // 6. SCHRITT: Response zurückgeben
    return NextResponse.json({
      organicKeywords: semrushData.organicKeywords,
      organicTraffic: semrushData.organicTraffic,
      lastFetched: now.toISOString(),
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
