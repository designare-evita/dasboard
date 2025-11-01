// src/app/api/semrush/keywords/route.ts (FINALE VERSION FÜR 2 KAMPAGNEN)
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getSemrushKeywordsWithFallback } from '@/lib/semrush-api-handler';

interface UserRow {
  id: string;
  domain: string | null;
  semrush_project_id: string | null;
  semrush_tracking_id: string | null; // Für Kampagne 1
  semrush_tracking_id_02: string | null; // NEU: Für Kampagne 2
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

    const { role, id: adminOrUserId } = session.user;
    const { searchParams } = new URL(request.url);
    
    // Dieser Parameter ist jetzt entscheidend
    const campaign = searchParams.get('campaign') || 'kampagne_1'; 
    
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    const projectIdParam = searchParams.get('projectId');
    let targetUserId: string;

    if (projectIdParam) {
      if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
        return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
      }
      targetUserId = projectIdParam;
      console.log(`[API] Admin ${adminOrUserId} greift auf Daten von User ${targetUserId} zu (Kampagne: ${campaign})`);
    } else {
      targetUserId = adminOrUserId;
      console.log(`[API] User ${targetUserId} greift auf eigene Daten zu (Kampagne: ${campaign})`);
    }

    // User daten laden (erweitert, um semrush_tracking_id_02)
    const { rows } = await sql<UserRow>`
      SELECT 
        id,
        domain, 
        semrush_project_id, 
        semrush_tracking_id,
        semrush_tracking_id_02 
      FROM users 
      WHERE id::text = ${targetUserId} 
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ keywords: [], error: 'User not found' }, { status: 404 });
    }

    const userData = rows[0];

    if (!userData.domain) {
      return NextResponse.json({ keywords: [], error: 'Domain not configured' });
    }
    
    // --- NEUE LOGIK ZUR KAMPAGNEN-AUSWAHL ---
    
    const projectId = userData.semrush_project_id;
    let trackingId: string | null = null;
    
    if (campaign === 'kampagne_2') {
      console.log('[API] Kampagne 2 ausgewählt.');
      trackingId = userData.semrush_tracking_id_02;
    } else {
      console.log('[API] Kampagne 1 (Standard) ausgewählt.');
      trackingId = userData.semrush_tracking_id;
    }

    if (!projectId || !trackingId) {
      const errorMsg = `Semrush Konfiguration für ${campaign} unvollständig. (ProjectID: ${projectId}, TrackingID: ${trackingId})`;
      console.error(`[API] ${errorMsg} für User: ${targetUserId}`);
      return NextResponse.json({
        keywords: [],
        error: errorMsg
      }, { status: 400 });
    }
    
    // Die korrekte, dynamische campaignId
    const campaignId = `${projectId}_${trackingId}`;
    const domain = userData.domain;

    console.log('[API] Domain:', domain);
    console.log(`[API] Rufe API ab mit Campaign ID: ${campaignId}`);
    
    // --- ENDE NEUE LOGIK ---


    // Cache check (der 'campaign' key hier ist wichtig, um die Caches zu trennen)
    const { rows: cachedData } = await sql<CacheRow>`
      SELECT keywords_data, last_fetched 
      FROM semrush_keywords_cache 
      WHERE user_id = ${targetUserId} AND campaign = ${campaign}
    `;

    if (!forceRefresh && cachedData && cachedData.length > 0) {
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
      campaignId: campaignId, // (jetzt dynamisch)
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

    // Save to cache (wird korrekt unter 'kampagne_1' or 'kampagne_2' gespeichert)
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
      console.log('[API] Cache saved for', campaign);
    } catch (error) {
      console.error('[API] Cache error:', error);
    }

    // Sende die erfolgreiche Antwort zurück
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
