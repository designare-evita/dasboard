// src/app/api/test-url-matching/route.ts
// Debug-Route um URL-Matching zu testen

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Kopiere diese Funktionen aus google-api.ts
function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    let parsedUrl: URL;
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const dummyBase = 'https://dummy-base.com';
      parsedUrl = new URL(url, dummyBase);
      
      if (parsedUrl.hostname === 'dummy-base.com') {
        let path = parsedUrl.pathname.toLowerCase();
        if (path !== '/' && path.endsWith('/')) {
          path = path.slice(0, -1);
        }
        return path + parsedUrl.search;
      }
    } else {
      parsedUrl = new URL(url);
    }

    let host = parsedUrl.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }

    let path = parsedUrl.pathname.toLowerCase();
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    const params = Array.from(parsedUrl.searchParams.entries())
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

function createUrlVariants(url: string): string[] {
  const variants: Set<string> = new Set();
  
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname;
    const search = urlObj.search;
    
    const hosts: string[] = [];
    if (host.startsWith('www.')) {
      hosts.push(host);
      hosts.push(host.substring(4));
    } else {
      hosts.push(host);
      hosts.push(`www.${host}`);
    }

    const paths: string[] = [];
    paths.push(path);
    
    if (path !== '/' && path.endsWith('/')) {
      paths.push(path.slice(0, -1));
    } else if (path !== '/') {
      paths.push(path + '/');
    }
    
    const langPrefixPattern = /^\/([a-z]{2})(\/|$)/i;
    const langMatch = path.match(langPrefixPattern);
    
    if (langMatch) {
      const pathWithoutLang = path.replace(langPrefixPattern, '/');
      
      if (pathWithoutLang !== path) {
        paths.push(pathWithoutLang);
        
        if (pathWithoutLang !== '/' && pathWithoutLang.endsWith('/')) {
          paths.push(pathWithoutLang.slice(0, -1));
        } else if (pathWithoutLang !== '/') {
          paths.push(pathWithoutLang + '/');
        }
      }
    }

    const protocols = ['https://', 'http://'];

    for (const p of protocols) {
      for (const h of hosts) {
        for (const pa of paths) {
          variants.add(`${p}${h}${pa}${search}`);
        }
      }
    }
  } catch (error) {
    variants.add(url);
  }
  
  return Array.from(variants);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const testDbUrl = searchParams.get('dbUrl') || 'https://www.lehner-lifttechnik.com/de/';
    
    // Erstelle Varianten
    const variants = createUrlVariants(testDbUrl);
    
    // Erstelle Mapping
    const normalizedToOriginal = new Map<string, string>();
    variants.forEach(variant => {
      const normalized = normalizeUrl(variant);
      if (!normalizedToOriginal.has(normalized)) {
        normalizedToOriginal.set(normalized, testDbUrl);
      }
    });
    
    // Teste gegen echte GSC-Daten
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
    const siteUrl = 'https://www.lehner-lifttechnik.com/';
    
    // Hole GSC-Daten
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: '2025-10-01',
        endDate: '2025-11-07',
        dimensions: ['page'],
        type: 'web',
        aggregationType: 'byPage',
        dimensionFilterGroups: [{
          filters: variants.slice(0, 25).map(v => ({
            dimension: 'page',
            operator: 'equals',
            expression: v
          }))
        }],
        rowLimit: 50,
      },
    });

    const rows = response.data.rows || [];
    
    // Teste Matching
    const matches: Array<{
      gscUrl: string;
      normalizedGsc: string;
      dbUrl: string | undefined;
      matched: boolean;
      clicks: number;
      impressions: number;
    }> = [];
    
    for (const row of rows) {
      const gscUrl = row.keys?.[0];
      if (!gscUrl) continue;
      
      const normalizedGsc = normalizeUrl(gscUrl);
      const dbUrl = normalizedToOriginal.get(normalizedGsc);
      
      matches.push({
        gscUrl,
        normalizedGsc,
        dbUrl,
        matched: !!dbUrl,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0
      });
    }
    
    return NextResponse.json({
      testDbUrl,
      variantCount: variants.length,
      sampleVariants: variants.slice(0, 10),
      normalizedMappings: Array.from(normalizedToOriginal.entries()).slice(0, 10),
      gscRowsFound: rows.length,
      matches,
      summary: {
        totalMatches: matches.filter(m => m.matched).length,
        totalMismatches: matches.filter(m => !m.matched).length,
        totalClicks: matches.reduce((sum, m) => sum + m.clicks, 0)
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
