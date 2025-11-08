// src/app/api/landingpages/refresh-gsc/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres'; // SQL-Client
import { getGscDataForPagesWithComparison, GscPageData } from '@/lib/google-api'; // Unsere GSC-Funktion
import type { User } from '@/types';

// === Hilfsfunktionen zur Datumsberechnung ===

/**
 * Formatiert ein Date-Objekt zu 'YYYY-MM-DD'
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Berechnet Start- und Enddatum für den aktuellen und vorherigen Zeitraum.
 */
function calculateDateRanges(dateRange: string): {
  currentRange: { startDate: string, endDate: string },
  previousRange: { startDate: string, endDate: string }
} {
  const today = new Date();
  // GSC-Daten sind oft 2-3 Tage verzögert. Wir nehmen 2 Tage als Standard.
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 2); 
  
  const startDateCurrent = new Date(endDateCurrent);
  let daysBack: number;
  
  switch (dateRange) {
    case '3m': daysBack = 89; break; // 90 Tage total
    case '6m': daysBack = 179; break; // 180 Tage total
    case '12m': daysBack = 364; break; // 365 Tage total
    case '30d': default: daysBack = 29; break; // 30 Tage total
  }
  
  startDateCurrent.setDate(startDateCurrent.getDate() - daysBack);
  
  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1); // 1 Tag davor
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - daysBack); // Gleiche Dauer
  
  return {
    currentRange: {
      startDate: formatDate(startDateCurrent),
      endDate: formatDate(endDateCurrent),
    },
    previousRange: {
      startDate: formatDate(startDatePrevious),
      endDate: formatDate(endDatePrevious),
    },
  };
}


// === API POST Handler ===

export async function POST(request: NextRequest) {
  // Wir holen uns einen Client aus dem Pool für die Transaktion
  const client = await sql.connect();
  
  try {
    // 1. Authentifizierung und Autorisierung
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // 2. Request Body validieren
    const body = await request.json();
    const { projectId, dateRange } = body as { projectId: string, dateRange: string };

    if (!projectId || !dateRange) {
      return NextResponse.json({ message: 'projectId und dateRange sind erforderlich' }, { status: 400 });
    }

    // 3. Berechtigungsprüfung (Admin muss Zugriff auf Projekt haben)
    if (user.role === 'ADMIN') {
      const { rows: accessCheck } = await sql`
        SELECT 1 
        FROM project_assignments 
        WHERE user_id::text = ${user.id} 
        AND project_id::text = ${projectId};
      `;
      if (accessCheck.length === 0) {
        return NextResponse.json({ message: 'Zugriff auf dieses Projekt verweigert' }, { status: 403 });
      }
    }

    // 4. Benötigte Daten laden (GSC Site URL und Landingpage-URLs)
    const { rows: projectRows } = await sql<Pick<User, 'gsc_site_url'>>`
      SELECT gsc_site_url FROM users WHERE id::text = ${projectId};
    `;

    if (projectRows.length === 0 || !projectRows[0].gsc_site_url) {
      return NextResponse.json({ message: 'Keine GSC Site URL für dieses Projekt konfiguriert.' }, { status: 400 });
    }
    const siteUrl = projectRows[0].gsc_site_url;

    const { rows: landingpageRows } = await sql<{ id: number; url: string }>`
      SELECT id, url FROM landingpages WHERE user_id::text = ${projectId};
    `;

    if (landingpageRows.length === 0) {
      return NextResponse.json({ message: 'Für dieses Projekt wurden keine Landingpages gefunden.' });
    }

    const pageUrls = landingpageRows.map(lp => lp.url);
    const pageIdMap = new Map<string, number>(landingpageRows.map(lp => [lp.url, lp.id]));

    // 5. Zeiträume berechnen
    const { currentRange, previousRange } = calculateDateRanges(dateRange);

    // 6. GSC-Daten abrufen
    const gscDataMap = await getGscDataForPagesWithComparison(
      siteUrl,
      pageUrls,
      currentRange,
      previousRange
    );

    // 7. Datenbank-Transaktion starten
    await client.query('BEGIN');
    
    let updatedCount = 0;
    const updatePromises: Promise<any>[] = [];

    // 8. Daten in die Datenbank schreiben
    for (const [url, data] of gscDataMap.entries()) {
      const landingpageId = pageIdMap.get(url);
      
      if (landingpageId) {
        updatePromises.push(
          client.query(
            `UPDATE landingpages
             SET 
               gsc_klicks = $1,
               gsc_klicks_change = $2,
               gsc_impressionen = $3,
               gsc_impressionen_change = $4,
               gsc_position = $5,
               gsc_position_change = $6,
               gsc_last_updated = NOW(),
               gsc_last_range = $7
             WHERE id = $8;`,
            [
              data.clicks,
              data.clicks_change,
              data.impressions,
              data.impressions_change,
              data.position,
              data.position_change,
              dateRange,
              landingpageId
            ]
          )
        );
        updatedCount++;
      }
    }

    // Alle Updates parallel ausführen
    await Promise.all(updatePromises);

    // 9. Transaktion abschließen
    await client.query('COMMIT');

    console.log(`[GSC Refresh] Erfolgreich ${updatedCount} von ${pageUrls.length} Landingpages aktualisiert.`);

    return NextResponse.json({
      message: `✅ ${updatedCount} von ${pageUrls.length} Landingpages erfolgreich mit GSC-Daten synchronisiert.`,
      dateRange: dateRange,
      currentPeriod: currentRange,
      previousPeriod: previousRange,
      updatedPages: updatedCount,
      totalPages: pageUrls.length
    });

  } catch (error) {
    // 10. Fehlerbehandlung (Rollback)
    await client.query('ROLLBACK');
    console.error('[API /refresh-gsc] Fehler:', error);
    
    return NextResponse.json(
      { 
        message: 'Fehler beim Synchronisieren der GSC-Daten.',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  } finally {
    // 11. Client-Verbindung freigeben
    client.release();
  }
}
