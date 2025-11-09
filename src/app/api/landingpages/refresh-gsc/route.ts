// src/app/api/landingpages/refresh-gsc/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, type QueryResult } from '@vercel/postgres';
import { getGscDataForPagesWithComparison } from '@/lib/google-api';
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
  currentRange: { startDate: string; endDate: string };
  previousRange: { startDate: string; endDate: string };
} {
  const today = new Date();
  // GSC-Daten sind oft 2-3 Tage verzögert. Wir nehmen 2 Tage als Standard.
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 2);

  const startDateCurrent = new Date(endDateCurrent);
  let daysBack: number;

  switch (dateRange) {
    case '3m':
      daysBack = 89;
      break; // 90 Tage total
    case '6m':
      daysBack = 179;
      break; // 180 Tage total
    case '12m':
      daysBack = 364;
      break; // 365 Tage total
    case '30d':
    default:
      daysBack = 29;
      break; // 30 Tage total
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

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && user.role !== 'BENUTZER')) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // 2. Request Body validieren
    const body = await request.json();
    const { projectId, dateRange } = body as { projectId: string; dateRange: string };

    if (!projectId || !dateRange) {
      return NextResponse.json(
        { message: 'projectId und dateRange sind erforderlich' },
        { status: 400 }
      );
    }

    console.log(`[GSC Refresh] Start für Projekt ${projectId}, Zeitraum: ${dateRange}`);

    // 3. Berechtigungsprüfung
    if (user.role === 'BENUTZER') {
      // Benutzer darf nur eigene Daten aktualisieren
      if (user.id !== projectId) {
        return NextResponse.json(
          { message: 'Sie dürfen nur Ihre eigenen Landingpages aktualisieren' },
          { status: 403 }
        );
      }
    } else if (user.role === 'ADMIN') {
      // Admin muss Zugriff auf Projekt haben
      const { rows: accessCheck } = await sql`
        SELECT 1 
        FROM project_assignments 
        WHERE user_id::text = ${user.id} 
        AND project_id::text = ${projectId};
      `;
      if (accessCheck.length === 0) {
        return NextResponse.json(
          { message: 'Zugriff auf dieses Projekt verweigert' },
          { status: 403 }
        );
      }
    }
    // SUPERADMIN hat automatisch Zugriff

    // 4. Benötigte Daten laden (GSC Site URL und Landingpage-URLs)
    const { rows: projectRows } = await sql<Pick<User, 'gsc_site_url' | 'email'>>`
      SELECT gsc_site_url, email 
      FROM users 
      WHERE id::text = ${projectId};
    `;

    if (projectRows.length === 0) {
      return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    }

    const project = projectRows[0];

    if (!project.gsc_site_url) {
      return NextResponse.json(
        { message: 'Keine GSC Site URL für dieses Projekt konfiguriert.' },
        { status: 400 }
      );
    }

    const siteUrl = project.gsc_site_url;

    // Landingpages laden
    const { rows: landingpageRows } = await sql<{ id: number; url: string }>`
      SELECT id, url 
      FROM landingpages 
      WHERE user_id::text = ${projectId}
      ORDER BY id ASC;
    `;

    if (landingpageRows.length === 0) {
      return NextResponse.json({
        message: 'Für dieses Projekt wurden keine Landingpages gefunden.',
        updatedPages: 0,
        totalPages: 0,
      });
    }

    const pageUrls = landingpageRows.map((lp) => lp.url);
    const pageIdMap = new Map<string, number>(landingpageRows.map((lp) => [lp.url, lp.id]));

    console.log(`[GSC Refresh] ${landingpageRows.length} Landingpages gefunden`);
    console.log(`[GSC Refresh] Beispiel URLs:`, pageUrls.slice(0, 3));

    // 5. Zeiträume berechnen
    const { currentRange, previousRange } = calculateDateRanges(dateRange);

    console.log(`[GSC Refresh] Zeiträume:`, {
      current: currentRange,
      previous: previousRange,
    });

    // 6. GSC-Daten abrufen
    console.log(`[GSC Refresh] Starte GSC-Abfrage für ${pageUrls.length} URLs...`);

    const gscDataMap = await getGscDataForPagesWithComparison(
      siteUrl,
      pageUrls,
      currentRange,
      previousRange
    );

    console.log(`[GSC Refresh] GSC-Daten erhalten für ${gscDataMap.size} URLs`);
    
    // Debug: Zeige welche URLs GSC-Daten haben
    if (gscDataMap.size > 0) {
      const sampleGscUrls = Array.from(gscDataMap.keys()).slice(0, 3);
      console.log(`[GSC Refresh] Beispiel GSC URLs:`, sampleGscUrls);
    }

    // 7. Datenbank-Transaktion starten
    await client.query('BEGIN');

    let updatedCount = 0;
    let noDataCount = 0;
    const updatePromises: Promise<QueryResult>[] = [];

    // 8. Daten in die Datenbank schreiben
    for (const page of landingpageRows) {
      const gscData = gscDataMap.get(page.url);

      if (gscData && (gscData.clicks > 0 || gscData.impressions > 0)) {
        // GSC-Daten gefunden und relevant
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
              gscData.clicks,
              gscData.clicks_change,
              gscData.impressions,
              gscData.impressions_change,
              gscData.position === 0 ? null : gscData.position, // 0 = keine Position
              gscData.position_change,
              dateRange,
              page.id,
            ]
          )
        );
        updatedCount++;
      } else {
        // Keine GSC-Daten gefunden → auf 0 setzen
        updatePromises.push(
          client.query(
            `UPDATE landingpages
             SET 
               gsc_klicks = 0,
               gsc_klicks_change = 0,
               gsc_impressionen = 0,
               gsc_impressionen_change = 0,
               gsc_position = NULL,
               gsc_position_change = 0,
               gsc_last_updated = NOW(),
               gsc_last_range = $1
             WHERE id = $2;`,
            [dateRange, page.id]
          )
        );
        noDataCount++;
      }
    }

    // Alle Updates parallel ausführen
    await Promise.all(updatePromises);

    console.log(
      `[GSC Refresh] Updates abgeschlossen: ${updatedCount} mit Daten, ${noDataCount} ohne Daten`
    );

    // 9. Transaktion abschließen
    await client.query('COMMIT');

    console.log(`[GSC Refresh] Transaktion erfolgreich committed`);

    // ✅✅✅ 10. KRITISCH: Cache invalidieren
    try {
      const cacheDeleteResult = await client.query(
        `DELETE FROM google_data_cache 
         WHERE user_id::text = $1;`,
        [projectId]
      );

      console.log(
        `[GSC Refresh] ✅ Cache invalidiert: ${cacheDeleteResult.rowCount || 0} Einträge gelöscht`
      );
    } catch (cacheError) {
      console.warn(
        '[GSC Refresh] ⚠️ Cache-Invalidierung fehlgeschlossen (nicht kritisch):',
        cacheError
      );
      // Nicht kritisch - weiter machen
    }

    // 11. Erfolgs-Response
    const successMessage =
      updatedCount > 0
        ? `✅ ${updatedCount} von ${pageUrls.length} Landingpages erfolgreich mit GSC-Daten synchronisiert.`
        : `⚠️ Keine GSC-Daten für die ${pageUrls.length} Landingpages gefunden. Überprüfen Sie die GSC-Konfiguration.`;

    console.log(`[GSC Refresh] Erfolgreich abgeschlossen für Projekt ${project.email}`);

    return NextResponse.json({
      message: successMessage,
      dateRange: dateRange,
      currentPeriod: currentRange,
      previousPeriod: previousRange,
      updatedPages: updatedCount,
      noDataPages: noDataCount,
      totalPages: pageUrls.length,
      cacheInvalidated: true,
    });
  } catch (error) {
    // 12. Fehlerbehandlung (Rollback)
    try {
      await client.query('ROLLBACK');
      console.log('[GSC Refresh] Rollback durchgeführt');
    } catch (rollbackError) {
      console.error('[GSC Refresh] Fehler beim Rollback:', rollbackError);
    }

    console.error('[GSC Refresh] ❌ Fehler:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';

    return NextResponse.json(
      {
        message: 'Fehler beim Synchronisieren der GSC-Daten.',
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  } finally {
    // 13. Client-Verbindung freigeben
    client.release();
    console.log('[GSC Refresh] Client-Verbindung freigegeben');
  }
}
