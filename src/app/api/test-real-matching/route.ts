// src/app/api/test-real-matching/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
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

function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    let host = urlObj.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    let path = urlObj.pathname.toLowerCase();
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    const params = Array.from(urlObj.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    const search = new URLSearchParams(params).toString();
    return `${host}${path}${search ? '?' + search : ''}`;
  } catch (error) {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .toLowerCase()
      .replace(/\/+$/, '')
      .split('#')[0];
  }
}

export async function GET() {
  try {
    // 1. Hole DB-URLs
    const { rows: dbUrls } = await sql`
      SELECT url FROM landingpages 
      WHERE user_id = (SELECT id FROM users WHERE email = 'testkunde@gmail.com')
      LIMIT 20;
    `;

    // 2. Hole GSC-URLs
    const auth = createAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7); // Nur 7 Tage für schnelleres Testen

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const response = await searchconsole.searchanalytics.query({
      siteUrl: 'https://www.lehner-lifttechnik.com/',
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['page'],
        type: 'web',
        aggregationType: 'byPage',
        rowLimit: 100,
      },
    });

    const gscUrls = (response.data.rows || []).map(row => ({
      original: row.keys?.[0] || '',
      normalized: normalizeUrl(row.keys?.[0] || ''),
      clicks: row.clicks || 0,
    }));

    // 3. Matching-Test
    const dbUrlsWithMatches = dbUrls.map(dbRow => {
      const dbNormalized = normalizeUrl(dbRow.url);
      const match = gscUrls.find(gsc => gsc.normalized === dbNormalized);
      
      return {
        dbUrl: dbRow.url,
        dbNormalized,
        matched: !!match,
        gscMatch: match ? {
          url: match.original,
          clicks: match.clicks,
        } : null,
      };
    });

    const matchCount = dbUrlsWithMatches.filter(u => u.matched).length;

    return NextResponse.json({
      summary: {
        dbUrlCount: dbUrls.length,
        gscUrlCount: gscUrls.length,
        matchCount,
        matchRate: `${((matchCount / dbUrls.length) * 100).toFixed(1)}%`,
      },
      dbUrls: dbUrlsWithMatches,
      topGscUrls: gscUrls.slice(0, 10),
      // ✅ Sprachmuster
      languagePatterns: {
        db: {
          withDe: dbUrls.filter(u => u.url.includes('/de/')).length,
          withEn: dbUrls.filter(u => u.url.includes('/en/')).length,
          withFr: dbUrls.filter(u => u.url.includes('/fr/')).length,
          noLang: dbUrls.filter(u => !u.url.match(/\/(de|en|fr|es|it)\//)).length,
        },
        gsc: {
          withDe: gscUrls.filter(u => u.original.includes('/de/')).length,
          withEn: gscUrls.filter(u => u.original.includes('/en/')).length,
          withFr: gscUrls.filter(u => u.original.includes('/fr/')).length,
          noLang: gscUrls.filter(u => !u.original.match(/\/(de|en|fr|es|it)\//)).length,
        },
      },
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
