// src/app/api/test-gsc-raw/route.ts (ERSETZE KOMPLETT)
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

function createAuth(): JWT {
  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  
  if (!privateKeyBase64 || !clientEmail) {
    throw new Error('Credentials fehlen');
  }

  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
  return new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // ✅ Site URL aus Query-Parameter (oder Default)
    const siteUrl = searchParams.get('siteUrl') || 'https://www.lehner-lifttechnik.com/';
    
    const auth = createAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // ✅ Korrekter Zeitraum (3 Tage Delay)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['page'],
        type: 'web',
        aggregationType: 'byPage',
        rowLimit: 100,
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
      // ✅ URL-Muster-Analyse
      urlPatterns: rows.length > 0 ? {
        withDe: rows.filter(r => r.keys?.[0]?.includes('/de/')).length,
        withoutDe: rows.filter(r => r.keys?.[0] && !r.keys[0].includes('/de/')).length,
        withTrailingSlash: rows.filter(r => r.keys?.[0]?.endsWith('/')).length,
        withoutTrailingSlash: rows.filter(r => r.keys?.[0] && !r.keys[0].endsWith('/')).length,
        rootUrl: rows.filter(r => r.keys?.[0] === siteUrl).length,
      } : null,
      // ✅ Sample URLs für Matching-Tests
      sampleUrls: rows.slice(0, 5).map(r => r.keys?.[0]).filter(Boolean),
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
