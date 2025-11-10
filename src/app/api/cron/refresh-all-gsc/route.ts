// src/app/api/cron/refresh-all-gsc/route.ts

import { NextRequest, NextResponse } from 'next/server';
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
 * (Hardcoded auf '30d' für den Cron-Job)
 */
function calculateDateRanges(): {
  currentRange: { startDate: string, endDate: string },
  previousRange: { startDate: string, endDate: string }
} {
  const today = new Date();
  // GSC-Daten sind oft 2 Tage verzögert.
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(endDateCurrent.getDate() - 2); 
  
  const startDateCurrent = new Date(endDateCurrent);
  const daysBack = 29; // 30 Tage total (Tag 0 bis Tag 29)
  
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


/**
 * POST /api/cron/refresh-all-gsc
 * * Geht alle Benutzer durch, die GSC konfiguriert haben,
 * ruft die GSC-Daten für alle ihre Landingpages ab (Zeitraum 30d)
 * und speichert die Ergebnisse in der 'landingpages'-Tabelle.
 * * Geschützt durch CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  // 1. Sicherheit: Cron-Job absichern
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[CRON GSC] ❌ Nicht autorisierter Zugriff');
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  console.log('[CRON GSC] 🚀 Starte automatischen GSC-Abgleich...');
  const dateRange = '30d';
  const { currentRange, previousRange } = calculateDateRanges();

  let totalUsersProcessed = 0;
  let totalPagesUpdated = 0;
  const errors: string[] = [];

  try {
    // 2. Alle relevanten Benutzer laden (Kunden mit GSC-URL)
    const { rows: users } = await sql<Pick<User, 'id' | 'email' | 'gsc_site_url'>>`
      SELECT id, email, gsc_site_url 
      FROM users 
      WHERE role = 'BENUTZER' AND gsc_site_url IS NOT NULL AND gsc_site_url != '';
    `;

    console.log(`[CRON GSC] 👥 ${users.length} Benutzer mit GSC-Konfiguration gefunden.`);

    // 3. Durch jeden Benutzer loopen
    for (const user of users) {
      if (!user.gsc_site_url) continue; // Sollte nie passieren, aber sicher ist sicher

      console.log(`[CRON GSC] 🔄 Verarbeite User: ${user.email} (ID: ${user.id})`);
      
      // Pro User eine eigene Transaktion starten
      const client = await sql.connect();
      try {
        // 4. Landingpages für diesen User laden
        const { rows: landingpageRows } = await client.query<{ id: number; url: string }>(
          `SELECT id, url FROM landingpages WHERE user_id::text = $1;`,
          [user.id]
        );

        if (landingpageRows.length === 0) {
          console.log(`[CRON GSC] ℹ️ User ${user.email} hat keine Landingpages. Überspringe.`);
          client.release();
          continue; // Nächster User
        }

        const pageUrls = landingpageRows.map(lp => lp.url);
        const pageIdMap = new Map<string, number>(landingpageRows.map(lp => [lp.url, lp.id]));

        // 5. GSC-Daten für alle URLs dieses Users abrufen
        const gscDataMap = await getGscDataForPagesWithComparison(
          user.gsc_site_url,
          pageUrls,
          currentRange,
          previousRange
        );

        // 6. Transaktion starten und Daten aktualisieren
        await client.query('BEGIN');

        const updatePromises: Promise<QueryResult>[] = [];
        let updatedCountForUser = 0;

        for (const [url, data] of gscDataMap.entries()) {
          const landingpageId = pageIdMap.get(url);
          
          if (landingpageId && (data.clicks > 0 || data.impressions > 0 || data.position > 0)) {
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
            updatedCountForUser++;
          }
        }

        await Promise.all(updatePromises);
        await client.query('COMMIT');
        
        console.log(`[CRON GSC] ✅ User ${user.email}: ${updatedCountForUser} von ${pageUrls.length} Seiten aktualisiert.`);
        totalUsersProcessed++;
        totalPagesUpdated += updatedCountForUser;

      } catch (userError) {
        // Fehler bei diesem User -> Rollback und nächsten User versuchen
        await client.query('ROLLBACK');
        const errorMessage = `Fehler bei User ${user.email}: ${userError instanceof Error ? userError.message : 'Unbekannt'}`;
        console.error(`[CRON GSC] ❌ ${errorMessage}`);
        errors.push(errorMessage);
      } finally {
        client.release();
      }
    } // Ende des User-Loops

    console.log(`[CRON GSC] 🎉 Job beendet. ${totalPagesUpdated} Seiten für ${totalUsersProcessed} User aktualisiert.`);
    
    return NextResponse.json({ 
      message: `Cron-Job erfolgreich. ${totalPagesUpdated} Landingpages für ${totalUsersProcessed} Benutzer aktualisiert.`,
      usersProcessed: totalUsersProcessed,
      pagesUpdated: totalPagesUpdated,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[CRON GSC] ❌ Schwerwiegender Fehler im Cron-Job:', error);
    return NextResponse.json(
      { 
        message: 'Fehler beim Ausführen des Cron-Jobs.',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler'
      },
      { status: 500 }
    );
  }
}
