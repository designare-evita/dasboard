// src/app/api/cron/refresh-all-gsc/route.ts (KORRIGIERT)

import { NextResponse } from 'next/server';
import { sql, type QueryResult } from '@vercel/postgres'; // QueryResult importiert
import { getGscDataForPagesWithComparison } from '@/lib/google-api';
import type { User } from '@/types';
import { DateRangeOption } from '@/components/DateRangeSelector';

// (Typdefinitionen und Datumsfunktionen)
type LandingpageDbRow = {
  id: number;
  url: string;
};
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
// ---

export async function POST(request: Request) {
  // 1. Sicherheit: Cron-Geheimnis prüfen
  const { searchParams } = new URL(request.url);
  const cronSecret = searchParams.get('cron_secret');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    console.warn('[CRON GSC] ❌ Zugriff verweigert - Ungültiges Geheimnis');
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  console.log('[CRON GSC] 🚀 Starte automatischen GSC-Abgleich...');
  const cronDateRange: DateRangeOption = '30d'; // Cron-Job läuft immer für 30 Tage
  
  const client = await sql.connect();
  let totalProjectsProcessed = 0;
  let totalPagesUpdated = 0;
  const errors: string[] = [];

  try {
    // 2. Alle Benutzer mit GSC-Konfiguration laden
    const { rows: users } = await sql<User>`
      SELECT id::text, email, gsc_site_url 
      FROM users 
      WHERE gsc_site_url IS NOT NULL AND gsc_site_url != '';
    `;

    console.log(`[CRON GSC] ℹ️ ${users.length} Projekte mit GSC-Konfiguration gefunden.`);

    // 3. Jedes Projekt durchlaufen
    for (const user of users) {
      const projectId = user.id;
      const gscSiteUrl = user.gsc_site_url;
      
      if (!gscSiteUrl) continue;

      console.log(`[CRON GSC] 🔄 Verarbeite Projekt: ${user.email} (${projectId})`);

      try {
        // 4. Alle Landingpages für das Projekt laden
        const { rows: pages } = await client.query<LandingpageDbRow>(
          `SELECT id, url FROM landingpages WHERE user_id::text = $1`,
          [projectId]
        );
        
        if (pages.length === 0) {
          console.log(`[CRON GSC] ⏩ Projekt ${user.email} übersprungen (keine Landingpages).`);
          continue;
        }

        // 5. Zeiträume berechnen & GSC-Daten abrufen
        const { currentRange, previousRange } = calculateDateRanges(cronDateRange);
        const pageUrls = pages.map(p => p.url);

        const gscDataMap = await getGscDataForPagesWithComparison(
          gscSiteUrl,
          pageUrls,
          currentRange,
          previousRange
        );

        console.log(`[CRON GSC] 📊 ${gscDataMap.size} GSC-Datenpunkte für ${user.email} empfangen.`);

        // 6. Datenbank-Update in einer Transaktion
        let updatedCountInProject = 0;
        await client.query('BEGIN');

        const updatePromises: Promise<QueryResult>[] = []; // Korrekter Typ für die Promises

        pages.forEach(page => { // Verwende forEach statt map, wenn das Ergebnis nicht benötigt wird
          // === KORREKTUR: Direkter Zugriff mit der Original-URL ===
          const gscData = gscDataMap.get(page.url);

          if (gscData) {
            updatedCountInProject++;
            updatePromises.push(client.query(
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
            ));
          } else {
            // Setze auf 0, wenn keine Daten gefunden wurden
            updatePromises.push(client.query(
              `UPDATE landingpages
               SET gsc_klicks = 0, gsc_klicks_change = 0, gsc_impressionen = 0, gsc_impressionen_change = 0, gsc_position = null, gsc_position_change = 0
               WHERE id = $1;`,
              [page.id]
            ));
          }
        });
        
        await Promise.all(updatePromises);

        // Setze den Zeitstempel für alle Seiten dieses Benutzers
        await client.query(
          `UPDATE landingpages
           SET 
             gsc_last_updated = NOW(),
             gsc_last_range = $1
           WHERE user_id::text = $2;`,
          [cronDateRange, projectId]
        );

        await client.query('COMMIT');
        
        console.log(`[CRON GSC] ✅ Projekt ${user.email} erfolgreich: ${updatedCountInProject} Seiten aktualisiert.`);
        totalProjectsProcessed++;
        totalPagesUpdated += updatedCountInProject;

      } catch (projectError) {
        await client.query('ROLLBACK');
        const errorMessage = projectError instanceof Error ? projectError.message : 'Unbekannter Fehler';
        console.error(`[CRON GSC] ❌ Fehler bei Projekt ${user.email}: ${errorMessage}`);
        errors.push(`Projekt ${user.email}: ${errorMessage}`);
      }
    } // Ende der for-Schleife

    // 7. Erfolgs-Response für den Cron-Job
    console.log(`[CRON GSC] 🎉 Cron-Job beendet. ${totalProjectsProcessed} Projekte verarbeitet, ${totalPagesUpdated} Seiten aktualisiert.`);
    return NextResponse.json({
      message: `Cron-Job erfolgreich. ${totalProjectsProcessed} von ${users.length} Projekten verarbeitet.`,
      totalPagesUpdated,
      errors,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error(`[CRON GSC] ❌ Schwerwiegender Fehler (Rollback): ${errorMessage}`);
    return NextResponse.json({ message: `Fehler: ${errorMessage}` }, { status: 500 });
  } finally {
    client.release();
    console.log('[CRON GSC] Datenbank-Client freigegeben.');
  }
}

// === KORREKTUR: Fehlerhafte, lokale normalizeGscUrl-Funktion wurde entfernt ===
