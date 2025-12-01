// src/app/api/admin/system-status/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Security Check
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const status = {
      database: { status: 'pending', message: '', latency: 0 },
      google: { status: 'pending', message: '' },
      semrush: { status: 'pending', message: '' },
      cache: { count: 0, size: 'Unknown' },
      // ✅ NEU: Cron Status Objekt
      cron: { status: 'pending', message: '', lastRun: null as string | null } 
    };

    // --- TEST 1: DATENBANK ---
    const startDb = performance.now();
    try {
      await sql`SELECT 1`; 
      status.database.status = 'ok';
      status.database.latency = Math.round(performance.now() - startDb);
      status.database.message = 'Verbindung stabil.';
    } catch (e: any) {
      status.database.status = 'error';
      status.database.message = e.message;
    }

    // --- TEST 2: GOOGLE API ---
    try {
      if (!process.env.GOOGLE_CREDENTIALS && !process.env.GOOGLE_PRIVATE_KEY_BASE64) {
        throw new Error('Keine Credentials in ENV gefunden.');
      }
      status.google.status = 'ok';
      status.google.message = 'Credentials konfiguriert.';
    } catch (e: any) {
      status.google.status = 'error';
      status.google.message = e.message;
    }

    // --- TEST 3: SEMRUSH CONFIG ---
    try {
      if (!process.env.SEMRUSH_API_KEY) {
        status.semrush.status = 'warning';
        status.semrush.message = 'Kein API Key.';
      } else {
        status.semrush.status = 'ok';
        status.semrush.message = 'API Key vorhanden.';
      }
    } catch (e: any) {
      status.semrush.status = 'error';
      status.semrush.message = e.message;
    }

    // --- TEST 4: CACHE STATS ---
    try {
        const { rows } = await sql`SELECT COUNT(*) as count FROM google_data_cache`;
        status.cache.count = rows[0].count;
    } catch (e) {
        console.error('Cache count failed', e);
    }

    // --- ✅ TEST 5: CRON JOB / UPDATE STATUS ---
    try {
      // Wir holen das NEUESTE Aktualisierungsdatum aller Landingpages
      const { rows } = await sql`SELECT MAX(gsc_last_updated) as last_update FROM landingpages`;
      const lastUpdate = rows[0]?.last_update;

      if (lastUpdate) {
        status.cron.lastRun = lastUpdate;
        
        // Prüfen, wie viele Stunden das her ist
        const lastDate = new Date(lastUpdate);
        const now = new Date();
        const diffInHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

        // Wir geben 50 Stunden Toleranz (48h Zyklus + Puffer)
        if (diffInHours < 50) {
           status.cron.status = 'ok';
           status.cron.message = 'Daten aktuell (innerhalb 48h).';
        } else {
           status.cron.status = 'warning';
           status.cron.message = `Update überfällig (${Math.round(diffInHours)}h alt).`;
        }
      } else {
        status.cron.status = 'warning';
        status.cron.message = 'Noch keine GSC Daten vorhanden.';
      }
    } catch (e: any) {
       status.cron.status = 'error';
       status.cron.message = 'Prüfung fehlgeschlagen: ' + e.message;
    }

    return NextResponse.json(status);

  } catch (error: any) {
    return NextResponse.json({ message: 'System Check Failed', error: error.message }, { status: 500 });
  }
}
