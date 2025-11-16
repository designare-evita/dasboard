// src/app/api/project-timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    
    // Bestimme die User-ID (entweder projectId für Admins oder eigene ID für Kunden)
    const userId = projectId || session.user.id;
    
    if (!userId) {
      return NextResponse.json({ message: 'User-ID fehlt' }, { status: 400 });
    }

    console.log('[project-timeline] Lade Timeline-Daten für User:', userId);

    // 1. Lade User-Daten mit Timeline-Einstellungen
    const { rows: userRows } = await sql`
      SELECT 
        project_start_date,
        project_duration_months,
        project_timeline_active,
        gsc_site_url
      FROM users
      WHERE id::text = ${userId}
    `;

    if (userRows.length === 0) {
      return NextResponse.json({ message: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const user = userRows[0];

    // 2. Prüfe, ob Timeline aktiviert ist
    if (!user.project_timeline_active) {
      console.log('[project-timeline] Timeline ist für diesen User nicht aktiviert');
      return NextResponse.json({ 
        message: 'Timeline-Widget ist für diesen Benutzer nicht aktiviert' 
      }, { status: 403 });
    }

    // 3. Prüfe, ob Startdatum und Dauer gesetzt sind
    if (!user.project_start_date || !user.project_duration_months) {
      console.log('[project-timeline] Projekt-Daten unvollständig');
      return NextResponse.json({ 
        message: 'Projekt-Timeline-Daten sind unvollständig' 
      }, { status: 404 });
    }

    // 4. Lade Landingpage-Status-Counts
    const { rows: lpRows } = await sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM landingpages
      WHERE user_id::text = ${userId}
      GROUP BY status
    `;

    const counts = {
      'Offen': 0,
      'In Prüfung': 0,
      'Gesperrt': 0,
      'Freigegeben': 0,
      'Total': 0
    };

    for (const row of lpRows) {
      const status = row.status as keyof typeof counts;
      const count = parseInt(row.count, 10);
      if (status in counts) {
        counts[status] = count;
      }
      counts.Total += count;
    }

    const percentage = counts.Total > 0 
      ? Math.round((counts.Freigegeben / counts.Total) * 100)
      : 0;

    // 5. GSC-Impressionen-Trend laden (letzte 90 Tage)
    let gscImpressionTrend: Array<{ date: string; value: number }> = [];
    
    if (user.gsc_site_url) {
      try {
        // Hole GSC-Daten aus der Landingpage-Tabelle
        // (Alternative: Direkt von GSC API holen, aber das ist langsamer)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const { rows: gscRows } = await sql`
          SELECT 
            DATE(gsc_last_updated) as date,
            SUM(gsc_impressionen) as impressions
          FROM landingpages
          WHERE user_id::text = ${userId}
            AND gsc_last_updated >= ${ninetyDaysAgo.toISOString()}
            AND gsc_impressionen IS NOT NULL
          GROUP BY DATE(gsc_last_updated)
          ORDER BY date ASC
        `;

        gscImpressionTrend = gscRows.map(row => ({
          date: row.date,
          value: parseInt(row.impressions, 10)
        }));

        console.log('[project-timeline] GSC-Trend-Datenpunkte:', gscImpressionTrend.length);
      } catch (gscError) {
        console.error('[project-timeline] Fehler beim Laden der GSC-Daten:', gscError);
        // Trend bleibt leer, aber Anfrage schlägt nicht fehl
      }
    }

    // 6. Erfolgreiche Antwort
    const response = {
      project: {
        startDate: user.project_start_date,
        durationMonths: user.project_duration_months
      },
      progress: {
        counts,
        percentage
      },
      gscImpressionTrend
    };

    console.log('[project-timeline] ✅ Timeline-Daten erfolgreich geladen');
    return NextResponse.json(response);

  } catch (error) {
    console.error('[project-timeline] ❌ Fehler:', error);
    return NextResponse.json(
      {
        message: 'Fehler beim Laden der Timeline-Daten',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
