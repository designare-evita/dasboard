// src/app/api/project-timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';
import { getSearchConsoleData, getAiTrafficData } from '@/lib/google-api'; // getAiTrafficData hinzugefügt

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const userId = projectId || session.user.id;
    
    if (!userId) {
      return NextResponse.json({ message: 'User-ID fehlt' }, { status: 400 });
    }

    // 1. Lade User-Daten (inkl. GA4 ID)
    const { rows: userRows } = await sql`
      SELECT 
        project_start_date,
        project_duration_months,
        project_timeline_active,
        gsc_site_url,
        ga4_property_id
      FROM users
      WHERE id::text = ${userId}
    `;

    if (userRows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = userRows[0];

    if (!user.project_timeline_active) {
      return NextResponse.json({ message: 'Timeline deaktiviert' }, { status: 403 });
    }

    // 2. Landingpage-Status
    const { rows: lpRows } = await sql`
      SELECT status, COUNT(*) as count
      FROM landingpages
      WHERE user_id::text = ${userId}
      GROUP BY status
    `;

    const counts = { 'Offen': 0, 'In Prüfung': 0, 'Gesperrt': 0, 'Freigegeben': 0, 'Total': 0 };
    for (const row of lpRows) {
      const status = row.status as keyof typeof counts;
      const count = parseInt(row.count, 10);
      if (status in counts) counts[status] = count;
      counts.Total += count;
    }
    const percentage = counts.Total > 0 ? Math.round((counts.Freigegeben / counts.Total) * 100) : 0;

    // 3. Zeiträume & Daten-Abruf (GSC + AI)
    let gscImpressionTrend: Array<{ date: number; value: number }> = []; // ✅ Timestamp
    let aiTrafficTrend: Array<{ date: number; value: number }> = []; // ✅ Timestamp

    // Zeitraum bestimmen: Vom Projektstart bis heute
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 2); // 2 Tage Puffer für Datenverfügbarkeit
    
    let startDate = new Date();
    if (user.project_start_date) {
      startDate = new Date(user.project_start_date);
    } else {
      startDate.setDate(startDate.getDate() - 90); // Fallback
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Cache prüfen
    let useCache = false;
    const cacheKey = 'timeline_project'; // Neuer Key für Projekt-Zeitraum
    
    try {
      const { rows: cacheRows } = await sql`
        SELECT data, last_fetched FROM google_data_cache
        WHERE user_id::text = ${userId} AND date_range = ${cacheKey}
      `;

      if (cacheRows.length > 0) {
        const cache = cacheRows[0];
        const ageInHours = (new Date().getTime() - new Date(cache.last_fetched).getTime()) / (1000 * 60 * 60);
        
        if (ageInHours < 24) { // 24h Cache
          console.log('[project-timeline] ✅ Cache HIT');
          gscImpressionTrend = cache.data.gscImpressionTrend || [];
          aiTrafficTrend = cache.data.aiTrafficTrend || [];
          useCache = true;
        }
      }
    } catch (e) { console.error('Cache Read Error', e); }

    // Live Fetch wenn kein Cache
    if (!useCache) {
      console.log(`[project-timeline] 🔄 Live Fetch (${startDateStr} bis ${endDateStr})`);
      
      const promises = [];

      // GSC Fetch
      if (user.gsc_site_url) {
        promises.push(
          getSearchConsoleData(user.gsc_site_url, startDateStr, endDateStr)
            .then(data => {
              gscImpressionTrend = data.impressions.daily.map(p => ({ date: p.date, value: p.value }));
            })
            .catch(err => console.error('GSC Fetch Error:', err))
        );
      }

      // GA4 AI-Traffic Fetch
      if (user.ga4_property_id) {
        promises.push(
          getAiTrafficData(user.ga4_property_id, startDateStr, endDateStr)
            .then(data => {
              aiTrafficTrend = data.trend.map(p => ({ date: p.date, value: p.sessions }));
            })
            .catch(err => console.error('AI Fetch Error:', err))
        );
      }

      await Promise.all(promises);

      // Cache schreiben
      try {
        const cacheData = { gscImpressionTrend, aiTrafficTrend };
        await sql`
          INSERT INTO google_data_cache (user_id, date_range, data, last_fetched)
          VALUES (${userId}::uuid, ${cacheKey}, ${JSON.stringify(cacheData)}::jsonb, NOW())
          ON CONFLICT (user_id, date_range)
          DO UPDATE SET data = ${JSON.stringify(cacheData)}::jsonb, last_fetched = NOW()
        `;
      } catch (e) { console.error('Cache Write Error', e); }
    }

    // 4. Top Movers
    const { rows: topMoversRows } = await sql`
      SELECT url, haupt_keyword, gsc_impressionen, gsc_impressionen_change
      FROM landingpages
      WHERE user_id::text = ${userId} AND gsc_impressionen_change > 0
      ORDER BY gsc_impressionen_change DESC LIMIT 5
    `;

    return NextResponse.json({
      project: { startDate: user.project_start_date, durationMonths: user.project_duration_months },
      progress: { counts, percentage },
      gscImpressionTrend,
      aiTrafficTrend, // Neu im Response
      topMovers: topMoversRows
    });

  } catch (error) {
    console.error('[project-timeline] Error:', error);
    return NextResponse.json({ message: 'Serverfehler', error: String(error) }, { status: 500 });
  }
}
