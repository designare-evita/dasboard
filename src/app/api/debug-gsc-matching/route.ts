// src/app/api/debug-gsc-matching/route.ts
// Debug-Route zum Testen des URL-Matchings zwischen DB und GSC

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Hilfsfunktionen aus google-api.ts kopieren
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
    
    const langPrefixPattern = /^\/([a-z]{2})(\/.*|$)/i;
    const langMatch = path.match(langPrefixPattern);
    
    if (langMatch) {
      const restPath = langMatch[2] || '/';
      const pathWithoutLang = restPath === '' ? '/' : restPath;
      
      if (pathWithoutLang !== path && pathWithoutLang !== '') {
        paths.push(pathWithoutLang);
        
        if (pathWithoutLang !== '/' && pathWithoutLang.endsWith('/')) {
          paths.push(pathWithoutLang.slice(0, -1));
        } else if (pathWithoutLang !== '/') {
          paths.push(pathWithoutLang + '/');
        }
      }
    } else {
      const commonLangs = ['de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'cs', 'hu'];
      
      for (const lang of commonLangs) {
        let pathWithLang: string;
        
        if (path === '/') {
          pathWithLang = `/${lang}/`;
        } else if (path.endsWith('/')) {
          pathWithLang = `/${lang}${path}`;
        } else {
          pathWithLang = `/${lang}${path}/`;
          paths.push(`/${lang}${path}`);
        }
        
        paths.push(pathWithLang);
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

function createAuth(): JWT {
  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  
  if (!privateKeyBase64 || !clientEmail) {
    throw new Error('Google API Credentials fehlen');
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
    // Nur für Superadmins
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parameter: ?siteUrl=...&testUrl=...&limit=10
    const siteUrl = searchParams.get('siteUrl') || 'https://www.lehner-lifttechnik.com/';
    const testUrl = searchParams.get('testUrl') || 'https://www.lehner-lifttechnik.com/de/';
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log('[DEBUG GSC] Testing URL matching...');
    console.log('[DEBUG GSC] Site URL:', siteUrl);
    console.log('[DEBUG GSC] Test URL:', testUrl);

    // 1. Erstelle Varianten für die Test-URL
    const variants = createUrlVariants(testUrl);
    console.log(`[DEBUG GSC] Created ${variants.length} variants for: ${testUrl}`);

    // 2. Hole GSC-Daten (alle URLs ohne Filter)
    const auth = createAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 29);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    console.log('[DEBUG GSC] Fetching GSC data...');
    console.log('[DEBUG GSC] Date range:', formatDate(startDate), 'to', formatDate(endDate));

    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['page'],
        type: 'web',
        aggregationType: 'byPage',
        rowLimit: limit,
      },
    });

    const rows = response.data.rows || [];
    console.log(`[DEBUG GSC] Received ${rows.length} URLs from GSC`);

    // 3. Teste Matching
    const gscUrls = rows.map(row => ({
      original: row.keys?.[0] || '',
      normalized: normalizeUrl(row.keys?.[0] || ''),
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      position: row.position || 0,
    }));

    // 4. Teste ob eine der Varianten matched
    const normalizedTestUrl = normalizeUrl(testUrl);
    const normalizedToOriginal = new Map<string, string>();
    
    variants.forEach(variant => {
      const norm = normalizeUrl(variant);
      if (!normalizedToOriginal.has(norm)) {
        normalizedToOriginal.set(norm, testUrl);
      }
    });

    const matches = gscUrls.filter(gscUrl => 
      normalizedToOriginal.has(gscUrl.normalized)
    );

    // 5. Finde ähnliche URLs (falls keine exakten Matches)
    const similarUrls = gscUrls.filter(gscUrl => {
      const gscPath = gscUrl.original.split('?')[0];
      const testPath = testUrl.split('?')[0];
      return gscPath.includes(testPath.split('/').pop() || '') ||
             testPath.includes(gscPath.split('/').pop() || '');
    }).slice(0, 10);

    return NextResponse.json({
      debug: {
        siteUrl,
        testUrl,
        testUrlNormalized: normalizedTestUrl,
        dateRange: {
          start: formatDate(startDate),
          end: formatDate(endDate),
        },
      },
      variants: {
        count: variants.length,
        samples: variants.slice(0, 10),
        allNormalized: Array.from(normalizedToOriginal.keys()).slice(0, 10),
      },
      gscData: {
        totalUrls: gscUrls.length,
        samples: gscUrls.slice(0, 10),
      },
      matching: {
        exactMatches: matches.length,
        matchedUrls: matches,
        similarUrls: similarUrls.length > 0 ? similarUrls : undefined,
      },
      diagnosis: {
        hasExactMatch: matches.length > 0,
        hasData: rows.length > 0,
        possibleIssues: matches.length === 0 ? [
          'Keine exakten Matches gefunden',
          rows.length === 0 ? 'GSC liefert keine Daten für diese Site URL' : null,
          'URL-Normalisierung könnte das Problem sein',
          'Sprachpräfix-Handling könnte fehlschlagen',
        ].filter(Boolean) : [],
      },
    });

  } catch (error) {
    console.error('[DEBUG GSC] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
