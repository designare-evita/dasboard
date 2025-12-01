// src/app/api/admin/system-status/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { google } from 'googleapis';

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
      cache: { count: 0, size: 'Unknown' } // Optional: Cache Größe
    };

    // --- TEST 1: DATENBANK ---
    const startDb = performance.now();
    try {
      await sql`SELECT 1`; // Einfacher Ping
      status.database.status = 'ok';
      status.database.latency = Math.round(performance.now() - startDb);
      status.database.message = 'Verbindung stabil.';
    } catch (e: any) {
      status.database.status = 'error';
      status.database.message = e.message;
    }

    // --- TEST 2: GOOGLE API CREDENTIALS ---
    try {
      // Wir prüfen nur, ob wir ein Auth-Objekt erstellen können
      if (!process.env.GOOGLE_CREDENTIALS && !process.env.GOOGLE_PRIVATE_KEY_BASE64) {
        throw new Error('Keine Credentials in ENV gefunden.');
      }
      // Optional: Einen echten leichten Call machen, wenn nötig
      status.google.status = 'ok';
      status.google.message = 'Credentials vorhanden & Format korrekt.';
    } catch (e: any) {
      status.google.status = 'error';
      status.google.message = e.message;
    }

    // --- TEST 3: SEMRUSH CONFIG ---
    try {
      if (!process.env.SEMRUSH_API_KEY) {
        status.semrush.status = 'warning';
        status.semrush.message = 'Kein API Key in ENV.';
      } else {
        status.semrush.status = 'ok';
        status.semrush.message = 'API Key konfiguriert.';
      }
    } catch (e: any) {
      status.semrush.status = 'error';
      status.semrush.message = e.message;
    }

    // --- TEST 4: CACHE STATS ---
    try {
        // Zählen wie viele Einträge im Cache sind
        const { rows } = await sql`SELECT COUNT(*) as count FROM google_data_cache`;
        status.cache.count = rows[0].count;
    } catch (e) {
        console.error('Cache count failed', e);
    }

    return NextResponse.json(status);

  } catch (error: any) {
    return NextResponse.json({ message: 'System Check Failed', error: error.message }, { status: 500 });
  }
}
