// src/app/api/cron/refresh-all-gsc/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getGscDataForPagesWithComparison } from '@/lib/google-api';
import type { User } from '@/types';

// Konfiguration
const BATCH_SIZE = 5; // Anzahl der User, die gleichzeitig verarbeitet werden
const MAX_EXECUTION_TIME_MS = 50 * 1000; // 50 Sekunden (Sicherheitsabstand zu Vercel 60s Limit)

// === Hilfsfunktionen ===

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateDateRanges() {
  const today = new Date();
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 2); // GSC Verzögerung
  
  const startDateCurrent = new Date(endDateCurrent);
  const daysBack = 29; 
  startDateCurrent.setDate(startDateCurrent.getDate() - daysBack);
  
  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - daysBack);
  
  return {
    currentRange: { startDate: formatDate(startDateCurrent), endDate: formatDate(endDateCurrent) },
    previousRange: { startDate: formatDate(startDatePrevious), endDate: formatDate(endDatePrevious) },
  };
}

// Verarbeitet EINEN einzelnen User
async function processUser(
  user: Pick<User, 'id' | 'email' | 'gsc_site_url'>, 
  ranges: ReturnType<typeof calculateDateRanges>
) {
  const logPrefix = `[User ${user.email}]`;
  let updatedCount = 0;

  try {
    const client = await sql.connect();
    
    try {
      // 1. Landingpages laden
      const { rows: landingpageRows } = await client.query<{ id: number; url: string }>(
        `SELECT id, url FROM landingpages WHERE user_id::text = $1;`,
        [user.id]
      );

      if (landingpageRows.length === 0) {
        return { success: true, count: 0, msg: 'Keine Landingpages' };
      }

      const pageUrls = landingpageRows.map(lp => lp.url);
      const pageIdMap = new Map(landingpageRows.map(lp => [lp.url, lp.id]));

      // 2. GSC Daten holen
      // (Hinweis: GSC API Limits beachten, aber bei 5 parallelen Usern meist OK)
      const gscDataMap = await getGscDataForPagesWithComparison(
        user.gsc_site_url!,
        pageUrls,
        ranges.currentRange,
        ranges.previousRange
      );

      // 3. Batch Update in Transaktion
      await client.query('BEGIN');
      
      for (const [url, data] of gscDataMap.entries()) {
        const landingpageId = pageIdMap.get(url);
        if (landingpageId) {
          await client.query(
            `UPDATE landingpages
             SET 
               gsc_klicks = $1, gsc_klicks_change = $2,
               gsc_impressionen = $3, gsc_impressionen_change = $4,
               gsc_position = $5, gsc_position_change = $6,
               gsc_last_updated = NOW(), gsc_last_range = '30d'
             WHERE id = $7;`,
            [
              data.clicks, data.clicks_change,
              data.impressions, data.impressions_change,
              data.position, data.position_change,
              landingpageId
            ]
          );
          updatedCount++;
        }
      }

      await client.query('COMMIT');
      return { success: true, count: updatedCount };

    } catch (innerErr) {
      await client.query('ROLLBACK');
      throw innerErr;
    } finally {
      client.release();
    }

  } catch (err: any) {
    console.error(`${logPrefix} Fehler:`, err.message);
    return { success: false, error: err.message };
  }
}

// === MAIN ROUTE ===
export const dynamic = 'force-dynamic'; // Wichtig für Cron

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // 1. Auth Check
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { currentRange, previousRange } = calculateDateRanges();
  const ranges = { currentRange, previousRange };

  try {
    // 2. User laden
    const { rows: users } = await sql<Pick<User, 'id' | 'email' | 'gsc_site_url'>>`
      SELECT id, email, gsc_site_url 
      FROM users 
      WHERE role = 'BENUTZER' AND gsc_site_url IS NOT NULL AND gsc_site_url != '';
    `;

    console.log(`[CRON] Starte Batch-Verarbeitung für ${users.length} User.`);

    let processedCount = 0;
    let totalUpdatedPages = 0;
    const errors: string[] = [];

    // 3. Batch-Verarbeitung (Parallelisierung)
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      
      // Zeit-Check: Haben wir noch genug Zeit für den nächsten Batch?
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.warn('[CRON] ⚠️ Zeitlimit fast erreicht. Stoppe vorzeitig.');
        errors.push('Zeitlimit erreicht - Job unvollständig');
        break; 
      }

      const batch = users.slice(i, i + BATCH_SIZE);
      console.log(`[CRON] Verarbeite Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} User)...`);

      // Promise.allSettled sorgt dafür, dass ein Fehler nicht den ganzen Batch stoppt
      const results = await Promise.allSettled(
        batch.map(user => processUser(user, ranges))
      );

      // Ergebnisse auswerten
      results.forEach((res, idx) => {
        const user = batch[idx];
        if (res.status === 'fulfilled') {
          const val = res.value;
          if (val.success) {
            totalUpdatedPages += val.count || 0;
          } else {
            errors.push(`User ${user.email}: ${val.error}`);
          }
        } else {
          errors.push(`User ${user.email}: Kritischer Fehler (Promise rejected)`);
        }
      });

      processedCount += batch.length;
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[CRON] ✅ Fertig in ${duration}s. Seiten: ${totalUpdatedPages}. Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      processedUsers: processedCount,
      totalUsers: users.length,
      pagesUpdated: totalUpdatedPages,
      durationSeconds: duration,
      errors: errors.length > 0 ? errors : undefined,
      incomplete: processedCount < users.length
    });

  } catch (error: any) {
    console.error('[CRON] Fataler Fehler:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
