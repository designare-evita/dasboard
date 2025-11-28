// src/app/api/clear-cache/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    // Auth prüfen
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { dateRange } = body;

    console.log(`[Clear Cache] Request für User ${userId}, dateRange: ${dateRange || 'ALL'}`);

    if (dateRange) {
      // Nur spezifischen Cache löschen
      const result = await sql`
        DELETE FROM google_data_cache 
        WHERE user_id = ${userId}::uuid AND date_range = ${dateRange}
      `;
      console.log(`[Clear Cache] ✅ Cache gelöscht für dateRange: ${dateRange}`);
      return NextResponse.json({ 
        success: true, 
        message: `Cache für ${dateRange} gelöscht`,
        cleared: dateRange,
        rowsDeleted: result.rowCount
      });
    } else {
      // Gesamten User-Cache löschen
      const result = await sql`
        DELETE FROM google_data_cache 
        WHERE user_id = ${userId}::uuid
      `;
      console.log(`[Clear Cache] ✅ Gesamter Cache gelöscht für User ${userId}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Gesamter Cache gelöscht',
        cleared: 'all',
        rowsDeleted: result.rowCount
      });
    }

  } catch (error: any) {
    console.error('[Clear Cache] Error:', error);
    return NextResponse.json(
      { error: 'Cache konnte nicht gelöscht werden', details: error.message },
      { status: 500 }
    );
  }
}

// Optional: GET zum Anzeigen des aktuellen Cache-Status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const userId = session.user.id;

    const { rows } = await sql`
      SELECT date_range, last_fetched, 
             data->'kpis'->'sessions'->>'value' as ga4_sessions,
             data->'kpis'->'clicks'->>'value' as gsc_clicks,
             data->'apiErrors' as api_errors
      FROM google_data_cache 
      WHERE user_id = ${userId}::uuid
      ORDER BY last_fetched DESC
    `;

    const cacheInfo = rows.map(row => {
      const lastFetched = new Date(row.last_fetched);
      const ageHours = (Date.now() - lastFetched.getTime()) / (1000 * 60 * 60);
      
      return {
        dateRange: row.date_range,
        lastFetched: lastFetched.toISOString(),
        ageHours: parseFloat(ageHours.toFixed(1)),
        hasGA4Data: row.ga4_sessions && parseInt(row.ga4_sessions) > 0,
        hasGSCData: row.gsc_clicks && parseInt(row.gsc_clicks) > 0,
        hasErrors: !!row.api_errors,
        ga4Sessions: row.ga4_sessions,
        gscClicks: row.gsc_clicks
      };
    });

    return NextResponse.json({
      success: true,
      userId,
      cacheEntries: cacheInfo,
      totalEntries: cacheInfo.length
    });

  } catch (error: any) {
    console.error('[Cache Info] Error:', error);
    return NextResponse.json(
      { error: 'Cache-Info konnte nicht abgerufen werden', details: error.message },
      { status: 500 }
    );
  }
}
