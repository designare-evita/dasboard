// src/app/api/landingpages/refresh-gsc/route.ts (KORRIGIERT)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { User } from '@/types';
import { DateRangeOption } from '@/components/DateRangeSelector';

// Importiere die NEUE Funktion
import { getGscDataForPagesWithComparison } from '@/lib/google-api';

// --- Datumsberechnung (identisch zur Cron-Route) ---
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

function calculateDateRanges(range: DateRangeOption = '30d') {
  const GSC_DATA_DELAY_DAYS = 2;
  const endDateCurrent = new Date();
  endDateCurrent.setDate(endDateCurrent.getDate() - GSC_DATA_DELAY_DAYS);
  let daysToSubtract = 29; // Default '30d'
  switch (range) {
    case '3m': daysToSubtract = 89; break;
    case '6m': daysToSubtract = 179; break;
    case '12m': daysToSubtract = 364; break;
  }
  const startDateCurrent = new Date(endDateCurrent);
  startDateCurrent.setDate(startDateCurrent.getDate() - daysToSubtract);
  const endDatePrevious = new Date(startDateCurrent);
  endDatePrevious.setDate(endDatePrevious.getDate() - 1);
  const startDatePrevious = new Date(endDatePrevious);
  startDatePrevious.setDate(startDatePrevious.getDate() - daysToSubtract);
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
// --- Ende Datumsberechnung ---

/**
 * POST /api/landingpages/refresh-gsc
 * Führt einen manuellen GSC-Abgleich für alle Landingpages eines Projekts durch.
 */
export async function POST(request: NextRequest) {
  const client = await sql.connect();
  
  try {
    // 1. Sicherheit: Nur Admins und Superadmins
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: "Zugriff verweigert" }, { status: 403 });
    }

    // 2. Request Body validieren
    const body = await request.json();
    const { projectId, dateRange } = body as { projectId: string; dateRange: DateRangeOption };

    if (!projectId || !dateRange) {
      return NextResponse.json({ message: "projectId und dateRange sind erforderlich" }, { status: 400 });
    }

    console.log(`[GSC REFRESH] Start für Projekt: ${projectId}, Zeitraum: ${dateRange}`);

    // 3. Lade GSC Site URL des Projekts
    const { rows: users } = await sql<User>`
      SELECT gsc_site_url FROM users WHERE id::text = ${projectId}
    `;
    const gscSiteUrl = users[0]?.gsc_site_url;

    if (!gscSiteUrl) {
      return NextResponse.json({ message: "Für dieses Projekt ist keine GSC Site URL konfiguriert." }, { status: 400 });
    }

    // 4. Lade alle Landingpages für das Projekt
    const { rows: pages } = await client.query<{ id: number; url: string }>(
      `SELECT id, url FROM landingpages WHERE user_id::text = $1`,
      [projectId]
    );
    
    if (pages.length === 0) {
      return NextResponse.json({ message: "Keine Landingpages zum Abgleichen gefunden." });
    }

    // 5. Berechne Zeiträume
    const { currentRange, previousRange } = calculateDateRanges(dateRange);
    const pageUrls = pages.map(p => p.url);

    console.log(`[GSC REFRESH] Rufe GSC API für ${pageUrls.length} URLs ab...`);

    // 6. Rufe die GSC-Daten ab (Map hat lowercase-Schlüssel)
    const gscDataMap = await getGscDataForPagesWithComparison(
      gscSiteUrl,
      pageUrls,
      currentRange,
      previousRange
    );

    console.log(`[GSC REFRESH] ${gscDataMap.size} URLs mit Daten von GSC empfangen.`);

    // 7. Datenbank-Update in einer Transaktion
    let updatedCount = 0;
    
    await client.query('BEGIN');

    const updatePromises = pages.map(page => {
      const gscData = gscDataMap.get(normalizeGscUrl(page.url)); // Normalisierung beim Abruf

      if (gscData) {
        updatedCount++;
        // ✅ KORREKTUR: client.query mit Text und Array-Argumenten
        return client.query(
          `UPDATE landingpages
           SET 
             gsc_klicks = $1,
             gsc_klicks_change = $2,
             gsc_impressionen = $3,
             gsc_impressionen_change = $4,
             gsc_position = $5,
             gsc_position_change = $6
           WHERE id = $7;`,
          [
            gscData.clicks,
            gscData.clicks_change,
            gscData.impressions,
            gscData.impressions_change,
            gscData.position === 0 ? null : gscData.position,
            gscData.position_change,
            page.id
          ]
        );
      } else {
        // ✅ KORREKTUR: client.query mit Text und Array-Argumenten
        return client.query(
          `UPDATE landingpages
           SET gsc_klicks = 0, gsc_klicks_change = 0, gsc_impressionen = 0, gsc_impressionen_change = 0, gsc_position = null, gsc_position_change = 0
           WHERE id = $1;`,
          [page.id]
        );
      }
    });

    await Promise.all(updatePromises);
    
    // ✅ KORREKTUR: client.query mit Text und Array-Argumenten
    await client.query(
      `UPDATE landingpages
       SET 
         gsc_last_updated = NOW(),
         gsc_last_range = $1
       WHERE user_id::text = $2;`,
      [dateRange, projectId]
    );

    await client.query('COMMIT');
    
    console.log(`[GSC REFRESH] ✅ Transaktion erfolgreich. ${updatedCount} Seiten aktualisiert.`);

    // 8. Erfolgs-Response
    return NextResponse.json({
      message: `✅ Abgleich erfolgreich. ${updatedCount} von ${pages.length} Landingpages mit GSC-Daten (${dateRange}) aktualisiert.`,
      updatedCount,
      totalCount: pages.length,
      dateRange,
    });

  } catch (error) {
    // Bei Fehler -> Rollback
    await client.query('ROLLBACK');
    console.error('[GSC REFRESH] ❌ Fehler während der Transaktion (Rollback durchgeführt):', error);
    
    return NextResponse.json(
      { 
        message: 'Fehler beim Abgleich der GSC-Daten', 
        error: error instanceof Error ? error.message : 'Unbekannter Fehler' 
      }, 
      { status: 500 }
    );
  } finally {
    // Wichtig: Client-Verbindung freigeben
    client.release();
    console.log('[GSC REFRESH] Datenbank-Client freigegeben.');
  }
}

/**
 * ✅ NEU: Robuste Normalisierungsfunktion (wie in der Cron-Datei)
 */
function normalizeGscUrl(url: string): string {
  try {
    if (url.startsWith('/')) {
      let path = url.endsWith('/') && url.length > 1 ? url.slice(0, -1) : url;
      return path.toLowerCase();
    }
    const parsedUrl = new URL(url);
    let host = parsedUrl.hostname;
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    let path = parsedUrl.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.substring(0, path.length - 1);
    }
    const fullPath = host + path + parsedUrl.search;
    return fullPath.toLowerCase();
  } catch (e) {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
  }
}
