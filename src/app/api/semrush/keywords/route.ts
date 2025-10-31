// src/app/api/semrush/keywords/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getSemrushKeywordsV2Only } from '@/lib/semrush-api-v2-only';

interface UserRow {
  domain: string | null;
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

    const { id } = session.user;
    const { searchParams } = new URL(request.url);
    const campaign = searchParams.get('campaign') || 'kampagne_1';
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    console.log('[API] Getting keywords for:', campaign);

    // User daten laden
    const { rows } = await sql<UserRow>`
      SELECT domain FROM users WHERE id::text = ${id}
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ 
        keywords: [],
        error: 'User not found'
      }, { status: 404 });
    }

    const domain = rows[0].domain;

    if (!domain) {
      return NextResponse.json({ 
        keywords: [],
        error: 'Domain not configured'
      });
    }

    console.log('[API] Domain:', domain);

    // Cache check
    const { rows: cachedData } = await sql<CacheRow>`
      SELECT keywords_data, last_fetched 
      FROM semrush_keywords_cache 
      WHERE user_id = ${id} AND campaign = ${campaign}
    `;

    // Check if cache valid (14 days)
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

    // Fetch from v2 API
    console.log('[API] Fetching from v2 API...');
    const result = await getSemrushKeywordsV2Only(domain, 'de');

    if (!result || result.keywords.length === 0) {
      console.error('[API] Error:', result?.error);
      return NextResponse.json({
        keywords: [],
        error: result?.error || 'Failed to fetch keywords'
      });
    }

    // Save to cache
    const now = new Date().toISOString();
    try {
      await sql`
        INSERT INTO semrush_keywords_cache (user_id, campaign, keywords_data, last_fetched)
        VALUES (${id}, ${campaign}, ${JSON.stringify(result.keywords)}::jsonb, ${now})
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
