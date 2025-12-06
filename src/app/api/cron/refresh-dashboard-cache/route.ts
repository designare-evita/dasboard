// src/app/api/cron/refresh-dashboard-cache/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import type { User } from '@/lib/schemas'; 

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro Limit

const BATCH_SIZE = 3; 
const MAX_EXECUTION_TIME_MS = 50 * 1000; 

const RANGES_TO_PREFILL = ['30d']; 

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ✅ FIX: Wir sortieren zufällig (RANDOM()), damit User am Ende der Liste 
    // nicht permanent durch das 50s-Zeitlimit ignoriert werden.
    const { rows } = await sql`
      SELECT * FROM users 
      WHERE (gsc_site_url IS NOT NULL OR ga4_property_id IS NOT NULL)
      AND role != 'SUPERADMIN' 
      ORDER BY RANDOM(); 
    `;
    
    const users = rows as unknown as User[];

    console.log(`[CRON Cache] Starte Refresh für ${users.length} User.`);

    let processedCount = 0;
    let successfulRefreshes = 0;
    let timeoutReached = false; // Neu: Flag für sauberen Log

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      // Check Time Limit
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.warn('[CRON Cache] ⚠️ Zeitlimit (50s) erreicht. Stoppe Batch-Verarbeitung.');
        timeoutReached = true;
        break; 
      }

      const batch = users.slice(i, i + BATCH_SIZE);
      
      await Promise.allSettled(
        batch.map(async (user) => {
          for (const range of RANGES_TO_PREFILL) {
            try {
              // forceRefresh = true zwingt Update
              await getOrFetchGoogleData(user, range, true);
              successfulRefreshes++;
            } catch (e) {
              console.error(`[CRON Cache] Fehler bei User ${user.email} (${range}):`, e);
            }
          }
        })
      );

      processedCount += batch.length;
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: users.length,
      refreshes: successfulRefreshes,
      didTimeout: timeoutReached // Info für Monitoring
    });

  } catch (error: any) {
    console.error('[CRON Cache] Fatal:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
