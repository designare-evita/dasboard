// src/app/api/semrush/keywords/route.ts (KORRIGIERT - Version 7.0 - Mit v2 API)
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { User } from '@/types';
import { getSemrushKeywordsV2Only } from '@/lib/semrush-api-v2-only';

interface UserWithSemrush extends User {
  semrush_project_id: string | null;
  semrush_tracking_id: string | null;
  semrush_tracking_id_02: string | null;
}

/**
 * GET /api/semrush/keywords
 * Lädt Semrush Keywords für Kampagne 1 oder Kampagne 2
 * 
 * Parameter:
 * - projectId: Optional - Projekt-ID für Admin-Zugriff
 * - campaign: Optional - 'kampagne_1' (default) oder 'kampagne_2'
 * - forceRefresh: Optional - true um Cache zu umgehen
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
    const campaign = searchParams.get('campaign') || 'kampagne_1'; // Default: Kampagne 1
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // Validiere Kampagnen-Parameter
    if (campaign !== 'kampagne_1' && campaign !== 'kampagne_2') {
      return NextResponse.json({ 
        message: 'Ungültiger Kampagnen-Parameter. Erwartet: kampagne_1 oder kampagne_2' 
      }, { status: 400 });
    }

    console.log('[/api/semrush/keywords] ==================== START ====================');
    console.log('[/api/semrush/keywords] User:', session.user.email, 'Role:', role);
    console.log('[/api/semrush/keywords] ProjectId:', projectId || 'none');
    console.log('[/api/semrush/keywords] Campaign:', campaign);
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
          console.warn('[/api/semrush/keywords] ⚠️ Admin hat keinen Zugriff auf Projekt:', projectId);
          return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
        }
      }

      targetUserId = projectId;
    } else {
      // User greift auf eigene Daten zu
      targetUserId = id;
    }

    console.log('[/api/semrush/keywords] Target User ID:', targetUserId);

    // Lade User-Daten mit ALLEN Semrush-Konfigurationen
    const { rows } = await sql<UserWithSemrush>`
      SELECT 
        email,
        domain,
        semrush_project_id,
        semrush_tracking_id,
        semrush_tracking_id_02
      FROM users 
      WHERE id::text = ${targetUserId}
    `;

    if (rows.length === 0) {
      console.error('[/api/semrush/keywords] ❌ User nicht gefunden:', targetUserId);
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = rows[0];

    console.log('[/api/semrush/keywords] User gefunden:');
    console.log('[/api/semrush/keywords] - Domain:', user.domain);
    console.log('[/api/semrush/keywords] - Project ID:', user.semrush_project_id);
    console.log('[/api/semrush/keywords] - Tracking ID (Kampagne 1):', user.semrush_tracking_id);
    console.log('[/api/semrush/keywords] - Tracking ID 02 (Kampagne 2):', user.semrush_tracking_id_02);

    // Validierung: Project ID muss vorhanden sein
    if (!user.semrush_project_id) {
      console.error('[/api/semrush/keywords] ❌ Keine Semrush Project ID konfiguriert');
      return NextResponse.json({
        keywords: [],
        lastFetched: null,
        fromCache: false,
        error: 'Keine Semrush Project ID konfiguriert. Bitte in den Einstellungen hinterlegen.'
      });
    }

    // ========== KAMPAGNEN-ROUTING ==========
    if (campaign === 'kampagne_2') {
      console.log('[/api/semrush/keywords] 📌 Flow: Kampagne 2');
      
      if (!user.semrush_tracking_id_02) {
        console.warn('[/api/semrush/keywords] ⚠️ Keine tracking_id_02 konfiguriert');
        return NextResponse.json({
          keywords: [],
          lastFetched: null,
          fromCache: false,
          error: 'Keine Semrush Tracking ID 02 (Kampagne 2) konfiguriert. Bitte in den Einstellungen hinterlegen.'
        });
      }

      return await handleTrackingId(
        targetUserId,
        user.domain,
        user.semrush_tracking_id_02,
        'kampagne_2',
        forceRefresh
      );
    }

    // ========== KAMPAGNE 1 (Standard) ==========
    console.log('[/api/semrush/keywords] 📌 Flow: Kampagne 1 (Standard)');

    if (!user.semrush_tracking_id) {
      console.warn('[/api/semrush/keywords] ⚠️ Keine Semrush Tracking ID (Kampagne 1) konfiguriert');
      return NextResponse.json({
        keywords: [],
        lastFetched: null,
        fromCache: false,
        error: 'Keine Semrush Tracking ID konfiguriert. Bitte in den Einstellungen eine Tracking-ID hinterlegen.'
      });
    }

    return await handleTrackingId(
      targetUserId,
      user.domain,
      user.semrush_tracking_id,
      'kampagne_1',
      forceRefresh
    );

  } catch (error) {
    console.error('[/api/semrush/keywords] Fehler:', error);
    return NextResponse.json({ 
      message: 'Fehler beim Abrufen der Keywords',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Lädt Keywords für eine spezifische Kampagne mit v2 API
 * Nutzt Cache mit 14-Tage Gültigkeit
 */
async function handleTrackingId(
  userId: string,
  domain: string | null,
  trackingId: string | null,
  campaign: 'kampagne_1' | 'kampagne_2',
  forceRefresh: boolean
): Promise<NextResponse> {
  
  // Validierung
  if (!trackingId) {
    console.error(`[handleTrackingId] ❌ Keine Tracking-ID für ${campaign}`);
    return NextResponse.json({
      keywords: [],
      lastFetched: null,
      fromCache: false,
      error: `Keine Tracking-ID für ${campaign} konfiguriert`
    });
  }

  if (!domain) {
    console.error(`[handleTrackingId] ❌ Keine Domain konfiguriert`);
    return NextResponse.json({
      keywords: [],
      lastFetched: null,
      fromCache: false,
      error: 'Keine Domain konfiguriert'
    });
  }

  console.log(`[handleTrackingId] ========== ${campaign.toUpperCase()} ==========`);
  console.log('[handleTrackingId] UserId (UUID):', userId);
  console.log('[handleTrackingId] Domain:', domain);
  console.log('[handleTrackingId] Campaign:', campaign);

  // Lade Cache
  const { rows: cachedData } = await sql`
    SELECT keywords_data, last_fetched 
    FROM semrush_keywords_cache 
    WHERE user_id = ${userId} AND campaign = ${campaign}
  `;

  // Prüfe Cache-Gültigkeit (14 Tage)
  const cacheValidDays = 14;
  let cacheIsValid = false;

  if (cachedData.length > 0 && cachedData[0].last_fetched) {
    const lastFetched = new Date(cachedData[0].last_fetched);
    const now = new Date();
    const diffMs = now.getTime() - lastFetched.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    cacheIsValid = diffDays < cacheValidDays;
    console.log('[handleTrackingId] Cache ist', Math.floor(diffDays), 'Tage alt, gültig:', cacheIsValid);
  } else {
    console.log('[handleTrackingId] Kein Cache vorhanden');
  }

  // Nutze Cache wenn gültig und kein Force Refresh
  if (cacheIsValid && !forceRefresh && cachedData.length > 0) {
    console.log('[handleTrackingId] ✅ Nutze Cache');
    return NextResponse.json({
      keywords: cachedData[0].keywords_data || [],
      lastFetched: new Date(cachedData[0].last_fetched).toISOString(),
      fromCache: true
    });
  }

  // Refresh: Lade von Semrush v2 API
  console.log('[handleTrackingId] 🔄 Fetching from Semrush v2 API...');
  console.log('[handleTrackingId] Domain:', domain);
  
  // ✅ WICHTIG: Nutze v2 API statt v1
  const keywordsData = await getSemrushKeywordsV2Only(domain, 'de');

  if (!keywordsData || keywordsData.keywords.length === 0) {
    console.error('[handleTrackingId] ❌ API-Fehler:', keywordsData?.error);
    
    // Fallback auf alten Cache
    if (cachedData.length > 0) {
      console.log('[handleTrackingId] 💾 Verwende alten Cache als Fallback');
      return NextResponse.json({
        keywords: cachedData[0].keywords_data || [],
        lastFetched: new Date(cachedData[0].last_fetched).toISOString(),
        fromCache: true,
        error: 'Konnte nicht aktualisiert werden: ' + keywordsData?.error
      });
    }

    return NextResponse.json({
      keywords: [],
      lastFetched: null,
      fromCache: false,
      error: keywordsData?.error || 'Unbekannter Fehler'
    });
  }

  // API-Daten erfolgreich geladen
  const keywords = keywordsData.keywords || [];
  console.log('[handleTrackingId] ✅ Fetched', keywords.length, 'keywords from v2 API');

  // Speichere im Cache
  const now = new Date().toISOString();
  
  try {
    await sql`
      INSERT INTO semrush_keywords_cache (user_id, campaign, keywords_data, last_fetched)
      VALUES (${userId}, ${campaign}, ${JSON.stringify(keywords)}::jsonb, ${now})
      ON CONFLICT (user_id, campaign)
      DO UPDATE SET 
        keywords_data = ${JSON.stringify(keywords)}::jsonb,
        last_fetched = ${now}
    `;
    console.log('[handleTrackingId] 💾 Cache gespeichert');
  } catch (cacheError) {
    console.error('[handleTrackingId] Cache-Fehler:', cacheError);
  }

  return NextResponse.json({
    keywords: keywords,
    lastFetched: now,
    fromCache: false
  });
}
