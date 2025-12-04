// src/app/api/cron/refresh-dashboard-cache/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getOrFetchGoogleData } from '@/lib/google-data-loader';
import type { User } from '@/lib/schemas'; // Pfad ggf. anpassen

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro Limit

const BATCH_SIZE = 3; // Kleinerer Batch, da Dashboard-Daten schwerer sind als reine GSC-Daten
const MAX_EXECUTION_TIME_MS = 50 * 1000; 

// Welche Zeiträume sollen vorgehalten werden?
const RANGES_TO_PREFILL = ['30d']; // Starten Sie erst mal nur mit 30d, um Timeouts zu vermeiden

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // 1. Auth Check
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Aktive User laden (die Google verbunden haben)
    // Wir nehmen nur User, die entweder GSC oder GA4 haben
    const { rows } = await sql`
      SELECT * FROM users 
      WHERE (gsc_site_url IS NOT NULL OR ga4_property_id IS NOT NULL)
      AND role != 'SUPERADMIN' 
      ORDER BY updated_at DESC; -- Aktive User zuerst
    `;
    
    // Cast zu User Type
    const users = rows as unknown as User[];

    console.log(`[CRON Cache] Starte Refresh für ${users.length} User.`);

    let processedCount = 0;
    let successfulRefreshes = 0;

    // 3. Batch-Verarbeitung
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.warn('[CRON Cache] ⚠️ Zeitlimit erreicht. Stoppe.');
        break; 
      }

      const batch = users.slice(i, i + BATCH_SIZE);
      
      // Parallelverarbeitung innerhalb des Batches
      await Promise.allSettled(
        batch.map(async (user) => {
          // Wir iterieren durch die gewünschten Zeiträume
          for (const range of RANGES_TO_PREFILL) {
            try {
              // forceRefresh = true zwingt den Loader, die API zu fragen und DB zu updaten
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
      refreshes: successfulRefreshes
    });

  } catch (error: any) {
    console.error('[CRON Cache] Fatal:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
