// SOFORT-FIX: Verbesserte Version der /api/landingpages/refresh-gsc/route.ts
// mit detailliertem Logging zur Fehlerdiagnose

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, type QueryResult } from '@vercel/postgres';
import { getGscDataForPagesWithComparison } from '@/lib/google-api';
import type { User } from '@/types';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateDateRanges(range: string) {
  const GSC_DATA_DELAY_DAYS = 2;
  const endDateCurrent = new Date();
  endDateCurrent.setDate(endDateCurrent.getDate() - GSC_DATA_DELAY_DAYS);
  
  let daysToSubtract = 29;
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

export async function POST(request: NextRequest) {
  const client = await sql.connect();
  
  // ✅ NEUES LOGGING-OBJEKT für detaillierte Diagnose
  const debugLog: {
    projectInfo?: any;
    landingpages?: any;
    dateRanges?: any;
    gscResponse?: any;
    matchingResults?: any;
    updateResults?: any;
    errors?: string[];
  } = {
    errors: [],
  };

  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && user.role !== 'BENUTZER')) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, dateRange } = body as { projectId: string; dateRange: string };

    if (!projectId || !dateRange) {
      return NextResponse.json(
        { message: 'projectId und dateRange sind erforderlich' },
        { status: 400 }
      );
    }

    console.log('\n=================================================');
    console.log('[GSC Refresh] 🚀 START - Detailliertes Debugging');
    console.log('=================================================');
    console.log(`[GSC Refresh] Projekt ID: ${projectId}`);
    console.log(`[GSC Refresh] Date Range: ${dateRange}`);
    console.log(`[GSC Refresh] Benutzer: ${user.email} (${user.role})`);

    // Berechtigungsprüfung
    if (user.role === 'BENUTZER' && user.id !== projectId) {
      debugLog.errors?.push('Benutzer darf nur eigene Daten aktualisieren');
      return NextResponse.json(
        { message: 'Sie dürfen nur Ihre eigenen Landingpages aktualisieren' },
        { status: 403 }
      );
    } else if (user.role === 'ADMIN') {
      const { rows: accessCheck } = await sql`
        SELECT 1 FROM project_assignments 
        WHERE user_id::text = ${user.id} AND project_id::text = ${projectId};
      `;
      if (accessCheck.length === 0) {
        debugLog.errors?.push('Admin hat keinen Zugriff auf dieses Projekt');
        return NextResponse.json(
          { message: 'Zugriff auf dieses Projekt verweigert' },
          { status: 403 }
        );
      }
    }

    // Projekt-Daten laden
    const { rows: projectRows } = await sql<Pick<User, 'gsc_site_url' | 'email' | 'domain'>>`
      SELECT gsc_site_url, email, domain FROM users WHERE id::text = ${projectId};
    `;

    if (projectRows.length === 0) {
      debugLog.errors?.push('Projekt nicht gefunden');
      return NextResponse.json({ message: 'Projekt nicht gefunden.' }, { status: 404 });
    }

    const project = projectRows[0];
    
    debugLog.projectInfo = {
      email: project.email,
      domain: project.domain,
      gsc_site_url: project.gsc_site_url,
      has_gsc: !!project.gsc_site_url,
    };

    console.log('[GSC Refresh] 📊 Projekt-Info:', debugLog.projectInfo);

    if (!project.gsc_site_url) {
      debugLog.errors?.push('Keine GSC Site URL konfiguriert');
      return NextResponse.json(
        { message: 'Keine GSC Site URL für dieses Projekt konfiguriert.', debug: debugLog },
        { status: 400 }
      );
    }

    const siteUrl = project.gsc_site_url;

    // Landingpages laden
    const { rows: landingpageRows } = await sql<{ id: number; url: string }>`
      SELECT id, url FROM landingpages 
      WHERE user_id::text = ${projectId}
      ORDER BY id ASC;
    `;

    if (landingpageRows.length === 0) {
      debugLog.landingpages = { count: 0, message: 'Keine Landingpages gefunden' };
      return NextResponse.json({
        message: 'Für dieses Projekt wurden keine Landingpages gefunden.',
        updatedPages: 0,
        totalPages: 0,
        debug: debugLog,
      });
    }

    const pageUrls = landingpageRows.map((lp) => lp.url);
    const pageIdMap = new Map<string, number>(landingpageRows.map((lp) => [lp.url, lp.id]));

    debugLog.landingpages = {
      count: landingpageRows.length,
      sampleUrls: pageUrls.slice(0, 5),
      allUrls: pageUrls,
    };

    console.log(`[GSC Refresh] 📄 Landingpages: ${landingpageRows.length} URLs gefunden`);
    console.log('[GSC Refresh] Beispiel-URLs:');
    pageUrls.slice(0, 3).forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`);
    });

    // Zeiträume berechnen
    const { currentRange, previousRange } = calculateDateRanges(dateRange);
    
    debugLog.dateRanges = {
      current: currentRange,
      previous: previousRange,
    };

    console.log('[GSC Refresh] 📅 Zeiträume:');
    console.log(`  Current:  ${currentRange.startDate} bis ${currentRange.endDate}`);
    console.log(`  Previous: ${previousRange.startDate} bis ${previousRange.endDate}`);

    // GSC-Daten abrufen
    console.log('[GSC Refresh] 🔍 Starte GSC-Abfrage...');
    console.log(`[GSC Refresh] Site URL: ${siteUrl}`);
    console.log(`[GSC Refresh] Anzahl URLs: ${pageUrls.length}`);

    const gscDataMap = await getGscDataForPagesWithComparison(
      siteUrl,
      pageUrls,
      currentRange,
      previousRange
    );

    debugLog.gscResponse = {
      totalMatches: gscDataMap.size,
      matchedUrls: Array.from(gscDataMap.keys()).slice(0, 10),
      hasData: gscDataMap.size > 0,
    };

    console.log(`[GSC Refresh] ✅ GSC-Antwort: ${gscDataMap.size} URLs mit Daten`);

    if (gscDataMap.size === 0) {
      console.log('[GSC Refresh] ⚠️ WARNUNG: Keine GSC-Daten gefunden!');
      console.log('[GSC Refresh] Mögliche Ursachen:');
      console.log('  1. URL-Matching schlägt fehl (Normalisierung)');
      console.log('  2. Keine Daten in GSC für diesen Zeitraum');
      console.log('  3. GSC Site URL ist falsch konfiguriert');
      console.log('  4. Sprachpräfix-Problem (z.B. /de/ vs. /)');
    }

    // Matching-Analyse
    const matchedUrls: string[] = [];
    const unmatchedUrls: string[] = [];
    const matchingDetails: Array<{
      dbUrl: string;
      matched: boolean;
      clicks?: number;
      impressions?: number;
    }> = [];

    for (const dbUrl of pageUrls) {
      const gscData = gscDataMap.get(dbUrl);
      if (gscData && (gscData.clicks > 0 || gscData.impressions > 0)) {
        matchedUrls.push(dbUrl);
        matchingDetails.push({
          dbUrl,
          matched: true,
          clicks: gscData.clicks,
          impressions: gscData.impressions,
        });
      } else {
        unmatchedUrls.push(dbUrl);
        matchingDetails.push({
          dbUrl,
          matched: false,
        });
      }
    }

    debugLog.matchingResults = {
      matched: matchedUrls.length,
      unmatched: unmatchedUrls.length,
      matchRate: `${((matchedUrls.length / pageUrls.length) * 100).toFixed(1)}%`,
      matchedSamples: matchedUrls.slice(0, 5),
      unmatchedSamples: unmatchedUrls.slice(0, 5),
      details: matchingDetails.slice(0, 10),
    };

    console.log('\n[GSC Refresh] 🎯 Matching-Ergebnisse:');
    console.log(`  ✅ Matched:   ${matchedUrls.length} URLs`);
    console.log(`  ❌ Unmatched: ${unmatchedUrls.length} URLs`);
    console.log(`  📊 Match-Rate: ${debugLog.matchingResults.matchRate}`);

    if (matchedUrls.length > 0) {
      console.log('\n[GSC Refresh] ✅ Beispiele erfolgreicher Matches:');
      matchedUrls.slice(0, 3).forEach((url) => {
        const data = gscDataMap.get(url);
        console.log(`  ${url.substring(0, 60)}...`);
        console.log(`    Clicks: ${data?.clicks}, Impressions: ${data?.impressions}`);
      });
    }

    if (unmatchedUrls.length > 0) {
      console.log('\n[GSC Refresh] ❌ Beispiele nicht gematchter URLs:');
      unmatchedUrls.slice(0, 3).forEach((url) => {
        console.log(`  ${url}`);
      });
    }

    // Datenbank-Update
    await client.query('BEGIN');

    let updatedCount = 0;
    let noDataCount = 0;
    const updatePromises: Promise<QueryResult>[] = [];

    for (const page of landingpageRows) {
      const gscData = gscDataMap.get(page.url);

      if (gscData && (gscData.clicks > 0 || gscData.impressions > 0)) {
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
              gscData.position === 0 ? null : gscData.position,
              gscData.position_change,
              dateRange,
              page.id,
            ]
          )
        );
        updatedCount++;
      } else {
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

    await Promise.all(updatePromises);
    await client.query('COMMIT');

    debugLog.updateResults = {
      updatedWithData: updatedCount,
      updatedWithoutData: noDataCount,
      total: landingpageRows.length,
    };

    console.log('\n[GSC Refresh] 💾 Datenbank-Update:');
    console.log(`  ✅ ${updatedCount} URLs mit GSC-Daten aktualisiert`);
    console.log(`  ⚪ ${noDataCount} URLs auf 0 gesetzt (keine Daten)`);

    // Cache invalidieren
    try {
      const cacheResult = await client.query(
        `DELETE FROM google_data_cache WHERE user_id::text = $1;`,
        [projectId]
      );
      console.log(`[GSC Refresh] 🗑️ Cache invalidiert: ${cacheResult.rowCount || 0} Einträge`);
    } catch (cacheError) {
      console.warn('[GSC Refresh] ⚠️ Cache-Invalidierung fehlgeschlagen:', cacheError);
    }

    console.log('\n=================================================');
    console.log('[GSC Refresh] ✅ ERFOLGREICH ABGESCHLOSSEN');
    console.log('=================================================\n');

    const successMessage =
      updatedCount > 0
        ? `✅ ${updatedCount} von ${pageUrls.length} Landingpages erfolgreich mit GSC-Daten synchronisiert.`
        : `⚠️ Keine GSC-Daten für die ${pageUrls.length} Landingpages gefunden. Überprüfen Sie die Konfiguration.`;

    return NextResponse.json({
      message: successMessage,
      dateRange: dateRange,
      currentPeriod: currentRange,
      previousPeriod: previousRange,
      updatedPages: updatedCount,
      noDataPages: noDataCount,
      totalPages: pageUrls.length,
      cacheInvalidated: true,
      debug: debugLog, // ✅ WICHTIG: Debug-Info für Diagnose
      diagnosis: {
        hasGscConfig: !!project.gsc_site_url,
        hasLandingpages: landingpageRows.length > 0,
        gscReturnsData: gscDataMap.size > 0,
        matchRate: `${((matchedUrls.length / pageUrls.length) * 100).toFixed(1)}%`,
        possibleIssues:
          updatedCount === 0
            ? [
                gscDataMap.size === 0 ? 'GSC liefert keine Daten' : null,
                'URL-Normalisierung schlägt fehl',
                'Sprachpräfix-Problem',
                'GSC Site URL falsch konfiguriert',
              ].filter(Boolean)
            : [],
      },
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[GSC Refresh] Rollback-Fehler:', rollbackError);
    }

    console.error('[GSC Refresh] ❌ FEHLER:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    debugLog.errors?.push(errorMessage);

    return NextResponse.json(
      {
        message: 'Fehler beim Synchronisieren der GSC-Daten.',
        error: errorMessage,
        debug: debugLog,
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
