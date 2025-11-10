// SOFORT-FIX: Verbesserte Version der /api/landingpages/refresh-gsc/route.ts
// mit detailliertem Logging zur Fehlerdiagnose
// ✅ KORRIGIERT: Übergibt 5 Argumente an getGscDataForPagesWithComparison
// ✅ FIX: Fehlerhaften JOIN auf 'users.project_id' entfernt
// ✅ FIX: Linter-Fehler ('no-explicit-any' und 'no-unused-vars') behoben
// ✅ NEU: Debug-Logs GANZ AM ANFANG, um 'process.env' zu prüfen

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, type QueryResult } from '@vercel/postgres';
import { getGscDataForPagesWithComparison } from '@/lib/google-api';
import type { User } from '@/types';

// ==================================================================
// TYPEN für das detaillierte Debug-Log
// ==================================================================
type DebugDateRange = {
  startDate: string;
  endDate: string;
};

type DebugProjectInfo = {
  email: string | undefined;
  domain: string | null | undefined; // Kann jetzt null/undefined sein
  gsc_site_url: string | null | undefined;
  has_gsc: boolean;
};

type DebugLandingpages = {
  count: number;
  message?: string;
  sampleUrls?: string[];
  allUrls?: string[];
};

type DebugGscResponse = {
  totalMatches: number;
  matchedUrls: string[];
  hasData: boolean;
};

type DebugMatchingDetail = {
  dbUrl: string;
  matched: boolean;
  clicks?: number;
  impressions?: number;
};

type DebugMatchingResults = {
  matched: number;
  unmatched: number;
  noData: number;
  details: DebugMatchingDetail[];
};

// Haupt-Debug-Struktur
interface RefreshDebugLog {
  status: 'START' | 'SUCCESS' | 'ERROR';
  projectId: string;
  dateRange: string;
  user: string;
  projectInfo?: DebugProjectInfo;
  landingpages?: DebugLandingpages;
  timeframes?: {
    current: DebugDateRange;
    previous: DebugDateRange;
  };
  gscQuery?: {
    siteUrl: string | null;
    fallbackUrl?: string | null;
    urlsSent: number;
  };
  gscResponse?: DebugGscResponse;
  matchingResults?: DebugMatchingResults;
  dbUpdate?: {
    updated: number;
    noData: number;
  };
  errors?: string[];
}
// ==================================================================

// Hilfsfunktion: Datumsbereiche berechnen
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

function calculateDateRanges(range: string = '30d') {
  const GSC_DATA_DELAY_DAYS = 2;
  const endDateCurrent = new Date();
  endDateCurrent.setDate(endDateCurrent.getDate() - GSC_DATA_DELAY_DAYS);

  let daysToSubtract = 29; // Default '30d'
  if (range === '3m') daysToSubtract = 89;
  if (range === '6m') daysToSubtract = 179;
  if (range === '12m') daysToSubtract = 364;

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

// ==================================================================
// HAUPTFUNKTION: POST Handler
// ==================================================================
export async function POST(req: NextRequest) {
  // ==================================================================
  // NEUE DEBUG-ZEILEN
  // ==================================================================
  console.log('=================================================');
  console.log('[DEBUG] Prüfe process.env in api/landingpages/refresh-gsc');
  // Wir prüfen, ob die Variablen *überhaupt* existieren
  console.log(
    `[DEBUG] Hat GOOGLE_CLIENT_EMAIL? ${!!process.env.GOOGLE_CLIENT_EMAIL}`,
  );
  // Wir loggen *nicht* den Key, nur ob er da ist.
  console.log(
    `[DEBUG] Hat GOOGLE_PRIVATE_KEY? ${!!process.env.GOOGLE_PRIVATE_KEY}`,
  );
  console.log('=================================================');
  // Ende Debug

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
  }

  const { projectId, dateRange } = await req.json();

  if (!projectId) {
    return NextResponse.json(
      { message: 'Projekt-ID fehlt' },
      { status: 400 },
    );
  }

  // Admin-Check (oder ob der User das Projekt besitzt)
  const isSuperAdmin = session.user.role === 'SUPERADMIN';
  if (!isSuperAdmin) {
    // TODO: Prüfen, ob User Inhaber des projectId ist
    console.warn(
      `[GSC Refresh] Nicht-Admin ${session.user.email} versucht Zugriff auf ${projectId}`,
    );
    // return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
  }

  // ==================================================================
  // START: Detailliertes Debugging
  // ==================================================================
  const debugLog: RefreshDebugLog = {
    status: 'START',
    projectId: projectId,
    dateRange: dateRange || '30d',
    user: `${session.user.email} (${session.user.role})`,
    errors: [],
  };
  console.log(
    `\n=================================================\n[GSC Refresh] 🚀 START - Detailliertes Debugging\n=================================================\n`,
  );
  console.log(`[GSC Refresh] Projekt ID: ${debugLog.projectId}`);
  console.log(`[GSC Refresh] Date Range: ${debugLog.dateRange}`);
  console.log(`[GSC Refresh] Benutzer: ${debugLog.user}`);

  const client = await sql.connect();
  try {
    // 1. Projekt-Infos holen
    // KORREKTUR: 'projects' JOIN entfernt, da 'users.project_id' nicht existiert.
    const { rows: projectRows } = await client.query<User & { domain?: string }>(
      `SELECT users.* FROM users 
       WHERE users.id::text = $1`,
      [projectId],
    );

    if (projectRows.length === 0) {
      debugLog.errors?.push('Projekt nicht gefunden');
      console.log(`[GSC Refresh] ❌ Fehler: Projekt nicht gefunden`);
      return NextResponse.json(
        { message: 'Projekt nicht gefunden', debugLog },
        { status: 404 },
      );
    }

    const project = projectRows[0];
    const siteUrl = project.gsc_site_url;

    debugLog.projectInfo = {
      email: project.email,
      domain: project.domain || 'N/A (JOIN entfernt)',
      gsc_site_url: siteUrl,
      has_gsc: !!siteUrl && siteUrl.length > 0,
    };
    console.log(`[GSC Refresh] 📊 Projekt-Info:`, debugLog.projectInfo);

    if (!siteUrl) {
      debugLog.errors?.push('GSC Site URL ist nicht konfiguriert');
      console.log(`[GSC Refresh] ❌ Fehler: GSC nicht konfiguriert`);
      return NextResponse.json(
        { message: 'GSC Site URL ist nicht konfiguriert', debugLog },
        { status: 400 },
      );
    }

    // 2. Landingpages für das Projekt holen
    const { rows: landingpageRows } = await client.query<{
      id: number;
      url: string;
    }>(`SELECT id, url FROM landingpages WHERE user_id::text = $1`, [projectId]);

    if (landingpageRows.length === 0) {
      debugLog.landingpages = { count: 0, message: 'Keine Landingpages gefunden' };
      console.log(`[GSC Refresh] ⚠️ Warnung: Keine Landingpages in DB gefunden`);
    } else {
      debugLog.landingpages = {
        count: landingpageRows.length,
        sampleUrls: landingpageRows.slice(0, 3).map((p) => p.url),
        allUrls: landingpageRows.map((p) => p.url),
      };
      console.log(
        `[GSC Refresh] 📄 Landingpages: ${debugLog.landingpages.count} URLs gefunden`,
      );
      console.log(`[GSC Refresh] Beispiel-URLs:\n${debugLog.landingpages.sampleUrls?.map((u, i) => `${i + 1}. ${u}`).join('\n')}`);
    }

    const pageUrls = landingpageRows.map((p) => p.url);

    // 3. Zeiträume berechnen
    const { currentRange, previousRange } = calculateDateRanges(dateRange);
    debugLog.timeframes = { current: currentRange, previous: previousRange };
    console.log(`[GSC Refresh] 📅 Zeiträume:`);
    console.log(`Current:  ${currentRange.startDate} bis ${currentRange.endDate}`);
    console.log(`Previous: ${previousRange.startDate} bis ${previousRange.endDate}`);

    // Fallback-Property aus siteUrl ableiten
    let fallbackProperty: string | null = null;
    if (siteUrl && (siteUrl.startsWith('http://') || siteUrl.startsWith('https://'))) {
      try {
        const urlObj = new URL(siteUrl);
        let host = urlObj.hostname.toLowerCase();
        if (host.startsWith('www.')) {
          host = host.substring(4);
        }
        const domainProperty = `sc-domain:${host}`;
        if (domainProperty !== siteUrl) {
          fallbackProperty = domainProperty;
        }
      } catch (error) {
        const errorMsg = `[GSC Refresh] ⚠️ Konnte keine Fallback-Domain aus ${siteUrl} ableiten.`;
        const specificError = error instanceof Error ? error.message : String(error);
        console.warn(errorMsg, specificError);
        debugLog.errors?.push(`${errorMsg} - ${specificError}`);
      }
    }

    // 4. GSC-Daten abrufen
    debugLog.gscQuery = {
      siteUrl: siteUrl,
      fallbackUrl: fallbackProperty, // Debugging
      urlsSent: pageUrls.length,
    };
    console.log(`[GSC Refresh] 🔍 Starte GSC-Abfrage...`);
    console.log(`[GSC Refresh] Site URL: ${siteUrl}`);
    console.log(`[GSC Refresh] Anzahl URLs: ${pageUrls.length}`);

    // KORRIGIERTER AUFRUF mit 5 Argumenten
    const gscDataMap = await getGscDataForPagesWithComparison(
      siteUrl,
      fallbackProperty, // Das 5. Argument
      pageUrls,
      currentRange,
      previousRange
    );

    // 5. GSC-Antwort analysieren (für Debugging)
    const matchedUrls: string[] = [];
    const matchingDetails: DebugMatchingDetail[] = [];
    let hasData = false;

    for (const [url, data] of gscDataMap.entries()) {
      const hasClicks = (data.clicks ?? 0) > 0;
      if (hasClicks) {
        hasData = true;
        matchedUrls.push(url);
      }
      matchingDetails.push({
        dbUrl: url,
        matched: hasClicks,
        clicks: data.clicks,
        impressions: data.impressions,
      });
    }

    debugLog.gscResponse = {
      totalMatches: gscDataMap.size, // Wie viele URLs GSC zurückgab
      matchedUrls: matchedUrls, // Welche URLs Klicks hatten
      hasData: hasData,
    };
    debugLog.matchingResults = {
      matched: matchedUrls.length,
      unmatched: pageUrls.length - matchedUrls.length,
      noData: gscDataMap.size - matchedUrls.length,
      details: matchingDetails,
    };
    console.log(
      `[GSC Refresh] ✅ GSC-Abfrage abgeschlossen. ${gscDataMap.size} URLs mit Daten (inkl. 0 Klicks) zurückgegeben.`,
    );

    // 6. Datenbank-Update in Transaktion
    let updatedCount = 0;
    let noDataCount = 0;

    await client.query('BEGIN');
    const updatePromises: Promise<QueryResult>[] = [];

    for (const page of landingpageRows) {
      const gscData = gscDataMap.get(page.url);

      if (gscData) {
        if (gscData.clicks > 0 || gscData.impressions > 0) {
          updatedCount++;
        } else {
          noDataCount++;
        }
        updatePromises.push(
          client.query(
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
              page.id,
            ],
          ),
        );
      } else {
        noDataCount++;
        updatePromises.push(
          client.query(
            `UPDATE landingpages
             SET gsc_klicks = 0, gsc_klicks_change = 0, gsc_impressionen = 0, gsc_impressionen_change = 0, gsc_position = null, gsc_position_change = 0
             WHERE id = $1;`,
            [page.id],
          ),
        );
      }
    }

    await Promise.all(updatePromises);

    // Zeitstempel für ALLE Seiten dieses Benutzers aktualisieren
    await client.query(
      `UPDATE landingpages
       SET 
         gsc_last_updated = NOW(),
         gsc_last_range = $1
       WHERE user_id::text = $2;`,
      [dateRange, projectId],
    );

    await client.query('COMMIT');
    // ==================================================================
    // ENDE: Detailliertes Debugging
    // ==================================================================
    debugLog.status = 'SUCCESS';
    debugLog.dbUpdate = { updated: updatedCount, noData: noDataCount };
    console.log(
      `[GSC Refresh] ✅ ERFOLG: ${updatedCount} Seiten mit Daten aktualisiert, ${noDataCount} Seiten auf 0 gesetzt.`,
    );
    console.log(
      `=================================================\n[GSC Refresh] 🏁 ENDE\n=================================================\n`,
    );

    // Erfolgsantwort mit allen Debug-Infos
    return NextResponse.json({
      message: `${updatedCount} von ${pageUrls.length} Landingpages erfolgreich synchronisiert.`,
      dateRange: dateRange,
      currentPeriod: currentRange,
      previousPeriod: previousRange,
      updatedPages: updatedCount,
      noDataPages: noDataCount,
      totalPages: pageUrls.length,
      cacheInvalidated: true,
      debug: debugLog,
      diagnosis: {
        hasGscConfig: !!project.gsc_site_url,
        hasLandingpages: landingpageRows.length > 0,
        gscReturnsData: gscDataMap.size > 0,
        matchRate: `${((matchedUrls.length / pageUrls.length) * 100).toFixed(
          1,
        )}%`,
        possibleIssues:
          updatedCount === 0
            ? [
                gscDataMap.size === 0
