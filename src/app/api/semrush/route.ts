// src/app/api/semrush/route.ts (VOLLSTÄNDIG mit Auto-Refresh)
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { User } from '@/types';
import { getSemrushData } from '@/lib/semrush-api';

interface UserWithSemrush extends User {
  semrush_organic_keywords?: number;
  semrush_organic_traffic?: number;
}

// Cache-Gültigkeit: 14 Tage in Millisekunden
const CACHE_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Prüft ob gecachte Daten noch gültig sind (< 14 Tage alt)
 */
function isCacheValid(lastFetched: Date): boolean {
  const now = new Date();
  const timeDiff = now.getTime() - new Date(lastFetched).getTime();
  const isValid = timeDiff < CACHE_DURATION_MS;
  const daysOld = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  console.log(`[/api/semrush] Cache ist ${daysOld} Tage alt, gültig: ${isValid}`);
  return isValid;
}

/**
 * GET /api/semrush
 * Lädt Semrush-Daten für einen Benutzer (mit 14-Tage Cache und Auto-Refresh)
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
      if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }

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
      targetUserId = id;
    }

    console.log('[/api/semrush] Lade Semrush-Daten für User:', targetUserId);

    // 1. LADE DATEN AUS BEIDEN TABELLEN
    const { rows } = await sql<UserWithSemrush & {
      cache_keywords?: number | null;
      cache_traffic?: number | null;
      cache_last_fetched?: string | null;
    }>`
      SELECT 
        u.email,
        u.domain,
        u.semrush_project_id,
        u.semrush_tracking_id,
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

    console.log('[/api/semrush] ==================== DEBUG ====================');
    console.log('[/api/semrush] Domain:', user.domain);
    console.log('[/api/semrush] Project ID:', user.semrush_project_id);
    console.log('[/api/semrush] users.semrush_organic_keywords:', user.semrush_organic_keywords);
    console.log('[/api/semrush] cache.organic_keywords:', user.cache_keywords);
    console.log('[/api/semrush] cache.last_fetched:', user.cache_last_fetched);

    // 2. PRÜFE OB CACHE GÜLTIG IST
    let needsRefresh = forceRefresh;
    
    if (!forceRefresh && user.cache_last_fetched) {
      const cacheValid = isCacheValid(new Date(user.cache_last_fetched));
      if (!cacheValid) {
        console.log('[/api/semrush] ⏰ Cache abgelaufen (> 14 Tage), Refresh nötig');
        needsRefresh = true;
      } else {
        console.log('[/api/semrush] ✅ Cache noch gültig (< 14 Tage)');
      }
    } else if (!user.cache_last_fetched) {
      console.log('[/api/semrush] 🆕 Kein Cache vorhanden, Refresh nötig');
      needsRefresh = true;
    }

    // 3. WENN REFRESH NÖTIG: RUFE SEMRUSH API AUF
    if (needsRefresh && (user.domain || user.semrush_project_id)) {
      console.log('[/api/semrush] 🔄 Starte API-Refresh...');

      // Bestimme Datenbank basierend auf Domain-Endung
      let database = 'de';
      if (user.domain) {
        if (user.domain.endsWith('.at')) database = 'at';
        else if (user.domain.endsWith('.ch')) database = 'ch';
        else if (user.domain.endsWith('.com')) database = 'us';
      }

      console.log('[/api/semrush] API-Parameter: domain=' + user.domain + ', projectId=' + user.semrush_project_id + ', db=' + database);

      // Rufe Semrush API auf
      const semrushData = await getSemrushData({
        domain: user.domain || undefined,
        projectId: user.semrush_project_id || undefined,
        trackingId: user.semrush_tracking_id || undefined,
        database: database
      });

      // Prüfe ob API-Call erfolgreich war
      if ('error' in semrushData) {
        console.error('[/api/semrush] ❌ API-Call fehlgeschlagen:', semrushData.error);
        
        // Fallback auf gecachte/users Daten
        if (user.cache_keywords !== null && user.cache_keywords !== undefined) {
          console.log('[/api/semrush] 💾 Verwende alten Cache als Fallback');
          return NextResponse.json({
            organicKeywords: user.cache_keywords,
            organicTraffic: user.cache_traffic,
            lastFetched: user.cache_last_fetched,
            fromCache: true,
            error: 'Konnte nicht aktualisiert werden'
          });
        } else if (user.semrush_organic_keywords !== null) {
          console.log('[/api/semrush] 💾 Verwende users-Tabelle als Fallback');
          return NextResponse.json({
            organicKeywords: user.semrush_organic_keywords,
            organicTraffic: user.semrush_organic_traffic,
            lastFetched: null,
            fromCache: false,
            error: 'Konnte nicht aktualisiert werden'
          });
        }
        
        return NextResponse.json({
          organicKeywords: null,
          organicTraffic: null,
          lastFetched: null,
          fromCache: false
        });
      }

      console.log('[/api/semrush] ✅ API-Call erfolgreich - Keywords:', semrushData.organicKeywords, 'Traffic:', semrushData.organicTraffic);

      // 4. SPEICHERE NEUE DATEN IM CACHE
      const now = new Date();
      try {
        await sql`
          INSERT INTO semrush_data_cache (user_id, organic_keywords, organic_traffic, last_fetched)
          VALUES (${targetUserId}::uuid, ${semrushData.organicKeywords}, ${semrushData.organicTraffic}, ${now.toISOString()})
          ON CONFLICT (user_id) 
          DO UPDATE SET 
            organic_keywords = ${semrushData.organicKeywords},
            organic_traffic = ${semrushData.organicTraffic},
            last_fetched = ${now.toISOString()},
            updated_at = NOW()
        `;
        console.log('[/api/semrush] 💾 Neue Daten im Cache gespeichert');
      } catch (cacheError) {
        console.error('[/api/semrush] Fehler beim Speichern im Cache:', cacheError);
      }

      // 5. RETURN FRISCHE DATEN
      return NextResponse.json({
        organicKeywords: semrushData.organicKeywords,
        organicTraffic: semrushData.organicTraffic,
        lastFetched: now.toISOString(),
        fromCache: false
      });
    }

    // 6. RETURN GECACHTE DATEN (Kein Refresh nötig)
    console.log('[/api/semrush] ============================================');
    
    if (user.cache_keywords !== null && user.cache_keywords !== undefined) {
      console.log('[/api/semrush] ✅ Verwende gültigen Cache');
      return NextResponse.json({
        organicKeywords: user.cache_keywords,
        organicTraffic: user.cache_traffic,
        lastFetched: user.cache_last_fetched,
        fromCache: true
      });
    } else if (user.semrush_organic_keywords !== null) {
      console.log('[/api/semrush] ✅ Verwende Daten aus users-Tabelle');
      return NextResponse.json({
        organicKeywords: user.semrush_organic_keywords,
        organicTraffic: user.semrush_organic_traffic,
        lastFetched: user.cache_last_fetched,
        fromCache: false
      });
    } else {
      console.log('[/api/semrush] ⚠️ Keine Semrush-Daten vorhanden');
      return NextResponse.json({
        organicKeywords: null,
        organicTraffic: null,
        lastFetched: null,
        fromCache: false
      });
    }

  } catch (error) {
    console.error('[/api/semrush] Fehler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interner Serverfehler';
    return NextResponse.json({ 
      message: `Fehler beim Abrufen der Semrush-Daten: ${errorMessage}`,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
