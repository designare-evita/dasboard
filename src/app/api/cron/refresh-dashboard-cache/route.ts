// src/app/api/cron/refresh-dashboard-cache/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import type { User } from '@/lib/schemas'; 

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro Limit

const MAX_EXECUTION_TIME_MS = 50000; // 50s Safety-Buffer
const CACHE_REFRESH_THRESHOLD_HOURS = 20;

// ✅ GET statt POST - Vercel Cron sendet GET-Requests!
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Auth Check - Vercel sendet Authorization Header automatisch
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[CRON Cache] ❌ Unauthorized - Invalid or missing CRON_SECRET');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON Cache] ✅ Authentifizierung erfolgreich, starte Job...');

  try {
    // User mit altem/fehlendem Cache laden
    const { rows } = await sql`
      SELECT DISTINCT u.* 
      FROM users u
      LEFT JOIN google_data_cache c ON u.id = c.user_id AND c.date_range = '30d'
      WHERE (u.gsc_site_url IS NOT NULL OR u.ga4_property_id IS NOT NULL)
        AND u.role != 'SUPERADMIN'
        AND (
          c.last_fetched IS NULL 
          OR c.last_fetched < NOW() - INTERVAL '20 hours'
        )
      ORDER BY COALESCE(c.last_fetched, '1970-01-01') ASC
      LIMIT 50;
    `;
    
    const users = rows as unknown as User[];

    console.log(`[CRON Cache] Gefunden: ${users.length} User mit altem/fehlendem Cache (älter als ${CACHE_REFRESH_THRESHOLD_HOURS}h)`);

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Alle Caches sind aktuell',
        processed: 0,
        total: 0,
        refreshes: 0
      });
    }

    let processedCount = 0;
    let successfulRefreshes = 0;
    let failedRefreshes = 0;
    let timeoutReached = false;

    // Sequenzielle Verarbeitung (stabiler bei Vercel)
    for (const user of users) {
      // Zeit-Check vor jedem User
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.warn('[CRON Cache] ⚠️ Zeitlimit erreicht. Stoppe.');
        timeoutReached = true;
        break; 
      }

      try {
        // forceRefresh = true erzwingt API-Call trotz Cache
        await getOrFetchGoogleData(user, '30d', true);
        successfulRefreshes++;
        console.log(`[CRON Cache] ✅ User ${user.email} refreshed`);
      } catch (e: any) {
        failedRefreshes++;
        console.error(`[CRON Cache] ❌ User ${user.email}: ${e.message}`);
      }

      processedCount++;
    }

    const duration = (Date.now() - startTime) / 1000;

    console.log(`[CRON Cache] 🏁 Fertig in ${duration.toFixed(1)}s - Erfolg: ${successfulRefreshes}, Fehler: ${failedRefreshes}`);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: users.length,
      refreshes: successfulRefreshes,
      failed: failedRefreshes,
      didTimeout: timeoutReached,
      durationSeconds: duration,
      cacheThresholdHours: CACHE_REFRESH_THRESHOLD_HOURS
    });

  } catch (error: any) {
    console.error('[CRON Cache] Fatal:', error);
    return NextResponse.json({ 
      success: false,
      message: error.message 
    }, { status: 500 });
  }
}
