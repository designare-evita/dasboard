// src/app/api/admin/system-status/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
// ✅ NEU: Import der echten Data-Fetcher
import { getSearchConsoleData, getAnalyticsData } from '@/lib/google-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const status = {
      database: { status: 'pending', message: '', latency: 0 },
      google: { status: 'pending', message: '' }, // Auth Check
      semrush: { status: 'pending', message: '' },
      cache: { count: 0, size: 'Unknown' },
      cron: { status: 'pending', message: '', lastRun: null as string | null },
      // ✅ NEU: API Live-Tests
      gscApi: { status: 'pending', message: '' },
      ga4Api: { status: 'pending', message: '' }
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

    // --- TEST 2: GOOGLE API AUTH ---
    try {
      if (!process.env.GOOGLE_CREDENTIALS && !process.env.GOOGLE_PRIVATE_KEY_BASE64) {
        throw new Error('Keine Credentials in ENV.');
      }
      status.google.status = 'ok';
      status.google.message = 'Credentials konfiguriert.';
    } catch (e: any) {
      status.google.status = 'error';
      status.google.message = e.message;
    }

    // --- TEST 3: SEMRUSH ---
    try {
      if (!process.env.SEMRUSH_API_KEY) {
        status.semrush.status = 'warning';
        status.semrush.message = 'Kein API Key.';
      } else {
        status.semrush.status = 'ok';
        status.semrush.message = 'Key vorhanden.';
      }
    } catch (e: any) {
      status.semrush.status = 'error';
      status.semrush.message = e.message;
    }

    // --- TEST 4: CACHE ---
    try {
        const { rows } = await sql`SELECT COUNT(*) as count FROM google_data_cache`;
        status.cache.count = rows[0].count;
    } catch (e) { console.error(e); }

    // --- TEST 5: CRON STATUS ---
    try {
      const { rows } = await sql`SELECT MAX(gsc_last_updated) as last_update FROM landingpages`;
      const lastUpdate = rows[0]?.last_update;
      if (lastUpdate) {
        status.cron.lastRun = lastUpdate;
        const diffInHours = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);
        if (diffInHours < 50) {
           status.cron.status = 'ok';
           status.cron.message = 'Daten aktuell.';
        } else {
           status.cron.status = 'warning';
           status.cron.message = `Überfällig (${Math.round(diffInHours)}h).`;
        }
      } else {
        status.cron.status = 'warning';
        status.cron.message = 'Keine Daten.';
      }
    } catch (e: any) {
       status.cron.status = 'error';
       status.cron.message = e.message;
    }

// --- ✅ TEST 6: LIVE DATEN-FLUSS (GSC & GA4) ---
    // Wir suchen einen ZUFÄLLIGEN User aus der Datenbank, um nicht immer den gleichen zu testen.
    try {
      const { rows } = await sql`
        SELECT gsc_site_url, ga4_property_id 
        FROM users 
        WHERE role = 'BENUTZER' 
          AND (gsc_site_url IS NOT NULL OR ga4_property_id IS NOT NULL)
        ORDER BY RANDOM()  -- << 🎲 WICHTIG: Zufällige Auswahl
        LIMIT 1
      `;
      
      const testUser = rows[0];

      if (!testUser) {
         status.gscApi = { status: 'warning', message: 'Kein User mit GSC gefunden.' };
         status.ga4Api = { status: 'warning', message: 'Kein User mit GA4 gefunden.' };
      } else {
         // Datum berechnen (GSC hat 2 Tage Latenz)
         const today = new Date();
         
         // GSC Datum (vor 4 Tagen, um sicher zu sein)
         const gscDate = new Date(today);
         gscDate.setDate(today.getDate() - 4);
         const gscDateStr = gscDate.toISOString().split('T')[0];

         // GA4 Datum (gestern)
         const gaDate = new Date(today);
         gaDate.setDate(today.getDate() - 1);
         const gaDateStr = gaDate.toISOString().split('T')[0];

         // A) GSC TEST
         if (testUser.gsc_site_url) {
            try {
               await getSearchConsoleData(testUser.gsc_site_url, gscDateStr, gscDateStr);
               status.gscApi = { status: 'ok', message: 'Daten-Abruf erfolgreich.' };
            } catch (e: any) {
               // Wenn ein einzelner User fehlschlägt, ist das eine Warnung, kein Systemausfall
               status.gscApi = { status: 'warning', message: 'Test fehlgeschlagen (User-spezifisch?): ' + e.message };
            }
         } else {
            status.gscApi = { status: 'pending', message: 'Zufalls-User hat kein GSC.' };
         }

         // B) GA4 TEST
         if (testUser.ga4_property_id) {
            try {
               await getAnalyticsData(testUser.ga4_property_id, gaDateStr, gaDateStr);
               status.ga4Api = { status: 'ok', message: 'Daten-Abruf erfolgreich.' };
            } catch (e: any) {
               status.ga4Api = { status: 'warning', message: 'Test fehlgeschlagen (User-spezifisch?): ' + e.message };
            }
         } else {
            status.ga4Api = { status: 'pending', message: 'Zufalls-User hat kein GA4.' };
         }
      }
    } catch (e: any) {
       status.gscApi = { status: 'error', message: 'DB Suche fehlgeschlagen.' };
       status.ga4Api = { status: 'error', message: 'DB Suche fehlgeschlagen.' };
    }

    return NextResponse.json(status);

  } catch (error: any) {
    return NextResponse.json({ message: 'System Check Failed', error: error.message }, { status: 500 });
  }
}
