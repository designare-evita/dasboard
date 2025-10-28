// src/app/api/semrush/keywords/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { User } from '@/types';
import { getSemrushKeywords } from '@/lib/semrush-api';

interface UserWithSemrush extends User {
  semrush_project_id?: string;
}

/**
 * GET /api/semrush/keywords
 * Lädt die Top Keywords aus Semrush Position Tracking
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

    console.log('[/api/semrush/keywords] ==================== START ====================');
    console.log('[/api/semrush/keywords] User:', session.user.email);
    console.log('[/api/semrush/keywords] ProjectId:', projectId || 'none (using session)');
    console.log('[/api/semrush/keywords] Force Refresh:', forceRefresh);

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

    console.log('[/api/semrush/keywords] Target User ID:', targetUserId);

    // Lade User-Daten mit Semrush Config
    const { rows } = await sql<UserWithSemrush>`
      SELECT 
        email,
        domain,
        semrush_project_id
      FROM users 
      WHERE id::text = ${targetUserId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = rows[0];

    console.log('[/api/semrush/keywords] Domain:', user.domain);
    console.log('[/api/semrush/keywords] Project ID:', user.semrush_project_id);

    // Prüfe ob Project ID konfiguriert ist
    if (!user.semrush_project_id) {
      console.warn('[/api/semrush/keywords] ⚠️ Keine Semrush Project ID konfiguriert');
      return NextResponse.json({
        keywords: [],
        lastFetched: null,
        fromCache: false,
        error: 'Keine Semrush Project ID konfiguriert'
      });
    }

    // Lade Cache
    const { rows: cachedData } = await sql`
      SELECT keywords_data, last_fetched 
      FROM semrush_keywords_cache 
      WHERE user_id::text = ${targetUserId}
    `;

    // Prüfe ob Cache gültig ist (14 Tage)
    const cacheValidDays = 14;
    let cacheIsValid = false;

    if (cachedData.length > 0 && cachedData[0].last_fetched) {
      const lastFetched = new Date(cachedData[0].last_fetched);
      const now = new Date();
      const diffMs = now.getTime() - lastFetched.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      cacheIsValid = diffDays < cacheValidDays;

      console.log('[/api/semrush/keywords] Cache ist', Math.floor(diffDays), 'Tage alt, gültig:', cacheIsValid);
    } else {
      console.log('[/api/semrush/keywords] Kein Cache vorhanden');
    }

    // Nutze Cache wenn gültig und kein Force Refresh
    if (cacheIsValid && !forceRefresh && cachedData.length > 0) {
      console.log('[/api/semrush/keywords] ✅ Nutze Cache');
      return NextResponse.json({
        keywords: cachedData[0].keywords_data || [],
        lastFetched: new Date(cachedData[0].last_fetched).toISOString(),
        fromCache: true
      });
    }

    // Refresh: Lade von Semrush API
    console.log('[/api/semrush/keywords] 🔄 Fetching from Semrush API...');

    const keywordsData = await getSemrushKeywords(user.semrush_project_id);

    if ('error' in keywordsData && keywordsData.keywords.length === 0) {
      console.error('[/api/semrush/keywords] ❌ API-Fehler:', keywordsData.error);
      
      // Fallback auf alten Cache
      if (cachedData.length > 0) {
        console.log('[/api/semrush/keywords] 💾 Verwende alten Cache als Fallback');
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
        fromCache: false,
        error: keywordsData.error
      });
    }

    // API-Daten erfolgreich geladen
    const keywords = keywordsData.keywords || [];
    console.log('[/api/semrush/keywords] ✅ Fetched', keywords.length, 'keywords');

    // Speichere im Cache
    const now = new Date().toISOString();
    
    try {
      await sql`
        INSERT INTO semrush_keywords_cache (user_id, keywords_data, last_fetched)
        VALUES (${targetUserId}::uuid, ${JSON.stringify(keywords)}::jsonb, ${now})
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          keywords_data = ${JSON.stringify(keywords)}::jsonb,
          last_fetched = ${now}
      `;
      console.log('[/api/semrush/keywords] 💾 Cache gespeichert');
    } catch (cacheError) {
      console.error('[/api/semrush/keywords] Cache-Fehler:', cacheError);
    }

    return NextResponse.json({
      keywords: keywords,
      lastFetched: now,
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
