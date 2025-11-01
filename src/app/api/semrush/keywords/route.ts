// src/app/api/semrush/keywords/route.ts (KORRIGIERTE VERSION FÜR ADMINS)
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getSemrushKeywordsWithFallback } from '@/lib/semrush-api-handler';

interface UserRow {
  id: string; // Hinzugefügt
  domain: string | null;
  semrush_project_id: string | null;
  semrush_tracking_id: string | null;
}

interface CacheRow {
  keywords_data: unknown;
  last_fetched: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role, id: adminOrUserId } = session.user; // ID des angemeldeten Users
    const { searchParams } = new URL(request.url);
    const campaign = searchParams.get('campaign') || 'kampagne_1';
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    
    // NEU: Admin-Logik (kopiert von /api/semrush/config)
    const projectIdParam = searchParams.get('projectId'); // Das ist die User-ID des Kunden
    let targetUserId: string;

    if (projectIdParam) {
      // Admin greift auf anderes Projekt zu
      if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }
      // TODO: Man könnte hier noch prüfen, ob der Admin Zugriff auf dieses Projekt hat
      targetUserId = projectIdParam;
      console.log(`[API] Admin ${adminOrUserId} greift auf Daten von User ${targetUserId} zu`);
    } else {
      // User greift auf eigene Daten zu
      targetUserId = adminOrUserId;
      console.log(`[API] User ${targetUserId} greift auf eigene Daten zu`);
    }
    // ENDE NEU

    console.log('[API] Getting keywords for:', campaign);

    // User daten laden (jetzt mit targetUserId)
    const { rows } = await sql<UserRow>`
      SELECT 
        id,
        domain, 
        semrush_project_id, 
        semrush_tracking_id 
      FROM users 
      WHERE id::text = ${targetUserId} 
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ 
        keywords: [],
        error: 'User not found'
      }, { status: 404 });
    }

    const userData = rows[0];

    if (!userData.domain) {
      return NextResponse.json({ 
        keywords: [],
        error: 'Domain not configured'
      });
    }
    
    if (!userData.semrush_project_id || !userData.semrush_tracking_id) {
      console.error('[API] Semrush Project ID or Tracking ID not configured for user:', targetUserId);
      return NextResponse.json({
        keywords: [],
        error: 'Semrush Project ID or Tracking ID not configured'
      }, { status: 400 });
    }
    
    const campaignId = `${userData.semrush_project_id}_${userData.semrush_tracking_id}`;
    const domain = userData.domain;

    console.log('[API] Domain:', domain);
    console.log('[API] Campaign ID (für v1 API):', campaignId);

    // Cache check (targetUserId und campaign_key verwenden)
    const { rows: cachedData } = await sql<CacheRow>`
      SELECT keywords_data, last_fetched 
      FROM semrush_keywords_cache 
      WHERE user_id = ${targetUserId} AND campaign = ${campaign}
    `;

    if (!forceRefresh && cachedData && cachedData.length > 0) {
      // (Cache-Logik bleibt gleich)
      const lastFetched = new Date(cachedData[0].last_fetched);
      const now = new Date();
      const ageMs = now.getTime() - lastFetched.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      if (ageDays < 14) {
        console.log('[API] Using cache (age:', Math.floor(ageDays), 'days)');
        return NextResponse.json({
          keywords: cachedData[0].keywords_data || [],
          lastFetched: cachedData[0].last_fetched,
          fromCache: true
        });
      }
    }

    // Rufe den robusten Fallback-Handler auf
    console.log('[API] Fetching from API (v1 with fallback)...');
    const result = await getSemrushKeywordsWithFallback({
      campaignId: campaignId,
      domain: domain,
      userId: targetUserId
    });

    if (!result || result.keywords.length === 0) {
      console.error('[API] Error:', result?.error);
      return NextResponse.json({
        keywords: [],
        error: result?.error || 'Failed to fetch keywords'
      });
    }

    // Save to cache (targetUserId verwenden)
    const now = new Date().toISOString();
    try {
      await sql`
        INSERT INTO semrush_keywords_cache (user_id, campaign, keywords_data, last_fetched)
        VALUES (${targetUserId}, ${campaign}, ${JSON.stringify(result.keywords)}::jsonb, ${now})
        ON CONFLICT (user_id, campaign)
        DO UPDATE SET 
          keywords_data = ${JSON.stringify(result.keywords)}::jsonb,
          last_fetched = ${now}
      `;
      console.log('[API] Cache saved');
    } catch (error) {
      console.error('[API] Cache error:', error);
    }

    return NextResponse.json({
      keywords: result.keywords,
      lastFetched: now,
      fromCache: false
    });

  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ 
      keywords: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
