// src/app/api/test-gsc-raw/route.ts (bereits vorhanden - modifizieren)

export async function GET() {
  try {
    const auth = createAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // ✅ KORRIGIERTER Zeitraum mit GSC-Delay
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3); // 3 Tage zurück
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const siteUrl = 'https://www.lehner-lifttechnik.com/'; // ⚠️ MIT Slash testen
    
    console.log('Testing dates:', formatDate(startDate), 'to', formatDate(endDate));

    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['page'],
        type: 'web',
        aggregationType: 'byPage',
        rowLimit: 100, // Erhöht für mehr Ergebnisse
      },
    });

    const rows = response.data.rows || [];
    
    return NextResponse.json({
      message: 'GSC Raw Test',
      siteUrl,
      dateRange: {
        start: formatDate(startDate),
        end: formatDate(endDate),
      },
      rowCount: rows.length,
      firstRows: rows.slice(0, 20).map(row => ({
        url: row.keys?.[0],
        clicks: row.clicks,
        impressions: row.impressions,
        position: row.position
      })),
      // ✅ Zeige auch URL-Muster
      urlPatterns: {
        withDe: rows.filter(r => r.keys?.[0]?.includes('/de/')).length,
        withoutDe: rows.filter(r => r.keys?.[0] && !r.keys[0].includes('/de/')).length,
        withTrailingSlash: rows.filter(r => r.keys?.[0]?.endsWith('/')).length,
        withoutTrailingSlash: rows.filter(r => r.keys?.[0] && !r.keys[0].endsWith('/')).length,
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
