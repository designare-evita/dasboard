// src/app/api/clear-cache/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Für NextAuth v4 mit App Router
// Alternative 1: Prüfe deine aktuelle Auth-Implementierung
// import { auth } from '@/lib/auth';

// Alternative 2: Falls du getServerSession verwendest
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // OPTION 1: Falls du auth() verwendest (NextAuth v5 Beta oder custom wrapper)
    // const session = await auth();
    
    // OPTION 2: Falls du getServerSession verwendest (NextAuth v4)
    // Uncomment diese beiden Zeilen und importiere oben:
    // const session = await getServerSession(authOptions);
    
    // TEMPORARY: Für den Build ohne Auth-Check
    // TODO: Ersetze dies mit deiner echten Auth-Methode
    const authHeader = request.headers.get('authorization');
    if (!authHeader && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }
    
    // Temporär: User ID aus Query/Body holen bis Auth funktioniert
    const body = await request.json();
    const { dateRange, userId } = body;
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'userId erforderlich (temporär bis Auth implementiert)' 
      }, { status: 400 });
    }

    console.log(`[Clear Cache] Request für User ${userId}, dateRange: ${dateRange || 'ALL'}`);

    if (dateRange) {
      // Nur spezifischen Cache löschen
      await sql`
        DELETE FROM google_data_cache 
        WHERE user_id = ${userId}::uuid AND date_range = ${dateRange}
      `;
      console.log(`[Clear Cache] ✅ Cache gelöscht für dateRange: ${dateRange}`);
      return NextResponse.json({ 
        success: true, 
        message: `Cache für ${dateRange} gelöscht`,
        cleared: dateRange
      });
    } else {
      // Gesamten User-Cache löschen
      await sql`
        DELETE FROM google_data_cache 
        WHERE user_id = ${userId}::uuid
      `;
      console.log(`[Clear Cache] ✅ Gesamter Cache gelöscht für User ${userId}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Gesamter Cache gelöscht',
        cleared: 'all'
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

// GET zum Anzeigen des aktuellen Cache-Status
export async function GET(request: NextRequest) {
  try {
    // Temporär ohne Auth für Testing
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'userId als Query-Parameter erforderlich' 
      }, { status: 400 });
    }

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
        hasErrors: !!row.api_errors
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
