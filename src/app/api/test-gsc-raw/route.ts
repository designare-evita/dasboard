// src/app/api/test-gsc-raw/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export async function GET() {
  try {
    const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    
    if (!privateKeyBase64 || !clientEmail) {
      return NextResponse.json({ error: 'Credentials fehlen' }, { status: 500 });
    }

    const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // ⚠️ WICHTIG: Ersetze mit der echten Site URL aus der DB
    const siteUrl = 'https://www.lehner-lifttechnik.com/';
    
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: '2025-10-01',
        endDate: '2025-11-07',
        dimensions: ['page'],
        type: 'web',
        aggregationType: 'byPage',
        rowLimit: 10, // Nur 10 URLs zum Testen
      },
    });

    const rows = response.data.rows || [];
    
    return NextResponse.json({
      message: 'GSC Raw Test',
      siteUrl,
      rowCount: rows.length,
      firstRows: rows.slice(0, 10).map(row => ({
        url: row.keys?.[0],
        clicks: row.clicks,
        impressions: row.impressions,
        position: row.position
      }))
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
