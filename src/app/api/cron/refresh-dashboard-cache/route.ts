// src/app/api/cron/refresh-dashboard-cache/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import type { User } from '@/lib/schemas'; 

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro Limit (Free = 10s!)

const BATCH_SIZE = 3; 
const MAX_EXECUTION_TIME_MS = 8000; // ⚠️ WICHTIG: Vercel Free = 10s Limit!

// ✅ FIX: Nur die wichtigsten Ranges vorberechnen
const RANGES_TO_PREFILL = ['30d']; // Bei Free Plan: NUR 30d, sonst Timeout

// ✅ NEU: Cache-Alter für Refresh (in Stunden)
const CACHE_REFRESH_THRESHOLD_HOURS = 20; // Cache älter als 20h wird refresht

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ✅ STRATEGIE 1: Nur User mit "altem" Cache laden
    // Findet User, deren Cache älter als CACHE_REFRESH_THRESHOLD_HOURS ist
    const { rows } = await sql`
      SELECT DISTINCT u.* 
      FROM users u
      LEFT JOIN google_data_cache c ON u.id = c.user_id AND c.date_range = '30d'
      WHERE (u.gsc_site_url IS NOT NULL OR u.ga4_property_id IS NOT NULL)
        AND u.role != 'SUPERADMIN'
        AND (
          c.last_fetched IS NULL 
          OR c.last_fetched < NOW() - INTERVAL '${CACHE_REFRESH_THRESHOLD_HOURS} hours'
        )
      ORDER BY COALESCE(c.last_fetched, '1970-01-01') ASC -- Älteste zuerst
      LIMIT 50; -- Max 50 User pro Run (Free Plan Schutz)
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

    // ✅ STRATEGIE 2: Sequenziell statt parallel (bei Free Plan stabiler)
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
