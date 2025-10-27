// src/app/api/semrush/keywords/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { User } from '@/types';
import { getSemrushKeywords } from '@/lib/semrush-api';

interface UserWithSemrush extends User {
  semrush_project_id?: string;
  semrush_tracking_id?: string;
}

// Cache-Gültigkeit: 14 Tage
const CACHE_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

function isCacheValid(lastFetched: Date): boolean {
  const now = new Date();
  const timeDiff = now.getTime() - new Date(lastFetched).getTime();
  return timeDiff < CACHE_DURATION_MS;
}

/**
 * GET /api/semrush/keywords
 * Lädt Top Keywords von Semrush (mit 14-Tage Cache)
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

    console.log('[/api/semrush/keywords] GET Request');

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
          return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
        }
      }

      targetUserId = projectId;
    } else {
      targetUserId = id;
    }

    // Lade User-Konfiguration
    const { rows } = await sql<UserWithSemrush>`
      SELECT 
        domain,
        semrush_project_id,
        semrush_tracking_id
      FROM users 
      WHERE id::text = ${targetUserId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = rows[0];

    if (!user.domain && !user.semrush_project_id) {
      return NextResponse.json({
        keywords: [],
        lastFetched: null
      });
    }

    // Prüfe Cache
    const { rows: cachedData } = await sql`
      SELECT 
        keywords_data,
        last_fetched
      FROM semrush_keywords_cache
      WHERE user_id::text = ${targetUserId}
    `;

    if (!forceRefresh && cachedData.length > 0) {
      const cache = cachedData[0];
      const lastFetched = new Date(cache.last_fetched);

      if (isCacheValid(lastFetched)) {
        console.log('[/api/semrush/keywords] ✅ Cache-Hit!');
        return NextResponse.json({
          keywords: cache.keywords_data || [],
          lastFetched: lastFetched.toISOString(),
          fromCache: true
        });
      }
    }

    // Rufe Semrush API auf
    console.log('[/api/semrush/keywords] 🔄 Fetching from API...');

    const database = user.domain?.endsWith('.at') ? 'at' 
                   : user.domain?.endsWith('.ch') ? 'ch'
                   : user.domain?.endsWith('.com') ? 'us' : 'de';

    const keywordsData = await getSemrushKeywords({
      domain: user.domain || undefined,
      projectId: user.semrush_project_id || undefined,
      database: database,
      limit: 20 // Top 20 Keywords
    });

    if ('error' in keywordsData) {
      console.error('[/api/semrush/keywords] API-Fehler:', keywordsData.error);
      
      // Fallback auf alten Cache
      if (cachedData.length > 0) {
        return NextResponse.json({
          keywords: cachedData[0].keywords_data || [],
          lastFetched: new Date(cachedData[0].last_fetched).toISOString(),
          fromCache: true,
          error: 'Konnte nicht aktualisiert werden'
        });
      }

      return NextResponse.json({
        keywords: [],
        lastFetched: null,
        fromCache: false
      });
    }

    // Speichere im Cache
    const now = new Date();
    try {
      await sql`
        INSERT INTO semrush_keywords_cache (user_id, keywords_data, last_fetched)
        VALUES (${targetUserId}::uuid, ${JSON.stringify(keywordsData.keywords)}::jsonb, ${now.toISOString()})
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          keywords_data = ${JSON.stringify(keywordsData.keywords)}::jsonb,
          last_fetched = ${now.toISOString()},
          updated_at = NOW()
      `;
      console.log('[/api/semrush/keywords] 💾 Cache gespeichert');
    } catch (cacheError) {
      console.error('[/api/semrush/keywords] Cache-Fehler:', cacheError);
    }

    return NextResponse.json({
      keywords: keywordsData.keywords,
      lastFetched: now.toISOString(),
      fromCache: false
    });

  } catch (error) {
    console.error('[/api/semrush/keywords] Fehler:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Abrufen der Keywords',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
