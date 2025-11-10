// src/lib/google-api.ts
// ✅ KORRIGIERTE VERSION mit bidirektionalem URL-Matching

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// =============================================================================
// TYPDEFINITIONEN
// =============================================================================

interface DailyDataPoint {
  date: string;
  value: number;
}

interface DateRangeData {
  total: number;
  daily: DailyDataPoint[];
}

export interface TopQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface AiTrafficData {
  totalSessions: number;
  totalUsers: number;
  totalSessionsChange?: number;
  totalUsersChange?: number;
  sessionsBySource: Record<string, number>;
  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  trend: Array<{
    date: string;
    value: number;
  }>;
}

export interface GscPageData {
  clicks: number;
  clicks_prev: number;
  clicks_change: number;
  impressions: number;
  impressions_prev: number;
  impressions_change: number;
  position: number;
  position_prev: number;
  position_change: number;
}

// =============================================================================
// AUTHENTIFIZIERUNG
// =============================================================================

function createAuth(): JWT {
  // Option 1: Komplettes JSON in GOOGLE_CREDENTIALS
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      return new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          'https://www.googleapis.com/auth/webmasters.readonly',
          'https://www.googleapis.com/auth/analytics.readonly',
        ],
      });
    } catch (e) {
      console.error('[Google API] Fehler beim Parsen von GOOGLE_CREDENTIALS:', e);
    }
  }

  // Option 2: Separate Environment Variables
  const privateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKeyBase64 || !clientEmail) {
    throw new Error(
      'Google API Credentials fehlen. Setze entweder GOOGLE_CREDENTIALS oder GOOGLE_PRIVATE_KEY_BASE64 + GOOGLE_SERVICE_ACCOUNT_EMAIL'
    );
  }

  try {
    const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');

    return new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/analytics.readonly',
      ],
    });
  } catch (error) {
    console.error('[Google API] Fehler beim Erstellen der JWT-Auth:', error);
    throw new Error('Fehler beim Initialisieren der Google API Authentifizierung.');
  }
}

// =============================================================================
// HILFSFUNKTIONEN
// =============================================================================

function formatDateForChart(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const day = dateStr.substring(6, 8);
  const month = dateStr.substring(4, 6);
  return `${day}.${month}`;
}

function formatDateToISO(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

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

/**
 * ✅✅✅ KORRIGIERT: Erstellt URL-Varianten inkl. BIDIREKTIONALER Sprach-Fallbacks
 * 
 * Beispiel 1 (DB hat Sprache):
 *   Input:  https://www.lehner-lifttechnik.com/de/
 *   Output: [..., https://www.lehner-lifttechnik.com/, ...]
 * 
 * Beispiel 2 (DB hat keine Sprache):
 *   Input:  https://www.lehner-lifttechnik.com/
 *   Output: [..., https://www.lehner-lifttechnik.com/de/, /en/, /fr/, ...]
 */
function createUrlVariants(url: string): string[] {
  const variants: Set<string> = new Set();
  
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname;
    const search = urlObj.search;
    
    // 1. Host-Varianten (www und non-www)
    const hosts: string[] = [];
    if (host.startsWith('www.')) {
      hosts.push(host);
      hosts.push(host.substring(4));
    } else {
      hosts.push(host);
      hosts.push(`www.${host}`);
    }

    // 2. Pfad-Varianten (inkl. Sprach-Fallbacks)
    const paths: string[] = [];
    
    // Original-Pfad
    paths.push(path);
    
    // Mit/ohne trailing slash
    if (path !== '/' && path.endsWith('/')) {
      paths.push(path.slice(0, -1));
    } else if (path !== '/') {
      paths.push(path + '/');
    }
    
    // ✅✅✅ BIDIREKTIONALE Sprach-Varianten
    const langPrefixPattern = /^\/([a-z]{2})(\/.*|$)/i;
    const langMatch = path.match(langPrefixPattern);
    
    if (langMatch) {
      // ✅ Fall 1: URL HAT Sprachpräfix (z.B. /de/lifte/)
      //           → Erstelle Variante OHNE Sprachpräfix (/lifte/)
      const langCode = langMatch[1];
      const restPath = langMatch[2] || '/';
      const pathWithoutLang = restPath === '' ? '/' : restPath;
      
      if (pathWithoutLang !== path && pathWithoutLang !== '') {
        paths.push(pathWithoutLang);
        
        // Mit/ohne trailing slash
        if (pathWithoutLang !== '/' && pathWithoutLang.endsWith('/')) {
          paths.push(pathWithoutLang.slice(0, -1));
        } else if (pathWithoutLang !== '/') {
          paths.push(pathWithoutLang + '/');
        }
      }
    } else {
      // ✅ Fall 2: URL HAT KEIN Sprachpräfix (z.B. /lifte/)
      //           → Erstelle Varianten MIT Sprachpräfixen (/de/lifte/, /en/lifte/, etc.)
      
      // Häufige Sprachen (priorisiert nach Wahrscheinlichkeit in Europa)
      const commonLangs = ['de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'cs', 'hu'];
      
      for (const lang of commonLangs) {
        let pathWithLang: string;
        
        if (path === '/') {
          // Root-Pfad: / → /de/
          pathWithLang = `/${lang}/`;
        } else if (path.startsWith('/') && !path.startsWith('//')) {
          // Normaler Pfad: /lifte/ → /de/lifte/
          pathWithLang = `/${lang}${path}`;
        } else {
          continue;
        }
        
        paths.push(pathWithLang);
        
        // Mit/ohne trailing slash
        if (pathWithLang.endsWith('/')) {
          paths.push(pathWithLang.slice(0, -1));
        } else {
          paths.push(pathWithLang + '/');
        }
      }
    }

    // 3. Protokoll-Varianten
    const protocols = ['https://', 'http://'];

    // 4. Alle Kombinationen erstellen
    for (const p of protocols) {
      for (const h of hosts) {
        for (const pa of paths) {
          variants.add(`${p}${h}${pa}${search}`);
        }
      }
    }
  } catch (error) {
    console.warn(`[createUrlVariants] Fehler für URL: ${url}`, error);
    variants.add(url);
  }
  
  return Array.from(variants);
}

function isAiSource(source: string): boolean {
  if (!source) return false;
  
  const aiPatterns = [
    'chatgpt', 'gpt', 'openai',
    'claude', 'anthropic',
    'bard', 'gemini',
    'perplexity',
    'bing chat', 'copilot',
    'gptbot', 'claudebot',
    'google-extended',
    'cohere-ai',
    'ai2bot',
    'you.com', 'neeva',
    'phind', 'metaphor',
    'notion ai', 'jasper',
    'copy.ai', 'writesonic',
  ];

  const sourceLower = source.toLowerCase();
  return aiPatterns.some(pattern => sourceLower.includes(pattern));
}

function cleanAiSourceName(source: string): string {
  if (!source) return 'Unbekannt';
  
  const sourceLower = source.toLowerCase();
  
  if (sourceLower.includes('chatgpt') || sourceLower.includes('gptbot')) return 'ChatGPT';
  if (sourceLower.includes('claude')) return 'Claude AI';
  if (sourceLower.includes('bard') || sourceLower.includes('gemini')) return 'Google Gemini';
  if (sourceLower.includes('perplexity')) return 'Perplexity';
  if (sourceLower.includes('bing') || sourceLower.includes('copilot')) return 'Bing Copilot';
  if (sourceLower.includes('you.com')) return 'You.com';
  
  const parts = source.split('/')[0].split('?')[0];
  return parts.length > 30 ? parts.substring(0, 27) + '...' : parts;
}

// =============================================================================
// GOOGLE SEARCH CONSOLE API
// =============================================================================

export async function getSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{ clicks: DateRangeData; impressions: DateRangeData }> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        type: 'web',
        aggregationType: 'byProperty',
      },
    });

    const rows = response.data.rows || [];
    const clicksDaily: DailyDataPoint[] = [];
    const impressionsDaily: DailyDataPoint[] = [];
    let totalClicks = 0;
    let totalImpressions = 0;

    for (const row of rows) {
      const date = row.keys?.[0];
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;

      if (date) {
        clicksDaily.push({ date, value: clicks });
        impressionsDaily.push({ date, value: impressions });
        totalClicks += clicks;
        totalImpressions += impressions;
      }
    }

    return {
      clicks: {
        total: totalClicks,
        daily: clicksDaily.sort((a, b) => a.date.localeCompare(b.date)),
      },
      impressions: {
        total: totalImpressions,
        daily: impressionsDaily.sort((a, b) => a.date.localeCompare(b.date)),
      },
    };
  } catch (error: unknown) {
    console.error('[GSC] Fehler beim Abrufen der Daten:', error);
    console.error('[GSC] Request Details:', { siteUrl, startDate, endDate });
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter API-Fehler';
    throw new Error(`Fehler bei Google Search Console API: ${errorMessage}`);
  }
}

export async function getTopQueries(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<TopQueryData[]> {
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        type: 'web',
        rowLimit: 100,
        dataState: 'all',
        aggregationType: 'byProperty',
      },
    });

    const allQueries = res.data.rows?.map((row) => ({
      query: row.keys?.[0] || 'N/A',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    })) || [];

    return allQueries
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 100);

  } catch (error: unknown) {
    console.error('[GSC] Fehler beim Abrufen der Top Queries:', error);
    console.error('[GSC] Request Details:', { siteUrl, startDate, endDate });
    return [];
  }
}

// =============================================================================
// GOOGLE ANALYTICS 4 API
// =============================================================================

export async function getAnalyticsData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{ sessions: DateRangeData; totalUsers: DateRangeData }> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    const response = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{
          dimension: { dimensionName: 'date' },
          desc: false,
        }],
      },
    });

    const rows = response.data.rows || [];
    const sessionsDaily: DailyDataPoint[] = [];
    const usersDaily: DailyDataPoint[] = [];
    let totalSessions = 0;
    let totalUsers = 0;

    for (const row of rows) {
      const rawDate = row.dimensionValues?.[0]?.value;
      const date = rawDate?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') ?? '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

      if (date) {
        sessionsDaily.push({ date, value: sessions });
        usersDaily.push({ date, value: users });
        totalSessions += sessions;
        totalUsers += users;
      }
    }

    return {
      sessions: {
        total: totalSessions,
        daily: sessionsDaily,
      },
      totalUsers: {
        total: totalUsers,
        daily: usersDaily,
      },
    };
  } catch (error: unknown) {
    console.error('[GA4] Fehler beim Abrufen der Daten:', error);
    console.error('[GA4] Request Details:', { propertyId: formattedPropertyId, startDate, endDate });
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter API-Fehler';
    throw new Error(`Fehler bei Google Analytics API: ${errorMessage}`);
  }
}

export async function getAiTrafficData(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<AiTrafficData> {
  const formattedPropertyId = propertyId.startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;

  const auth = createAuth();
  const analytics = google.analyticsdata({ version: 'v1beta', auth });

  try {
    const sourceResponse = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
        ],
        orderBys: [{ 
          metric: { metricName: 'sessions' }, 
          desc: true 
        }],
        limit: '1000',
      },
    });

    const trendResponse = await analytics.properties.runReport({
      property: formattedPropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'date' },
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        metrics: [
          { name: 'sessions' },
        ],
        orderBys: [{ 
          dimension: { dimensionName: 'date' }, 
          desc: false 
        }],
        limit: '10000',
      },
    });

    const sourceRows = sourceResponse.data.rows || [];
    const trendRows = trendResponse.data.rows || [];

    let totalSessions = 0;
    let totalUsers = 0;
    const sessionsBySource: { [key: string]: number } = {};
    const usersBySource: { [key: string]: number } = {};

    for (const row of sourceRows) {
      const source = row.dimensionValues?.[0]?.value || 'Unknown';
      const medium = row.dimensionValues?.[1]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[1]?.value || '0', 10);

      const fullSource = `${source}${medium ? `/${medium}` : ''}`;
      
      if (isAiSource(fullSource) || isAiSource(source)) {
        const cleanName = cleanAiSourceName(source);
        
        totalSessions += sessions;
        totalUsers += users;
        
        sessionsBySource[cleanName] = (sessionsBySource[cleanName] || 0) + sessions;
        usersBySource[cleanName] = (usersBySource[cleanName] || 0) + users;
      }
    }

    const trendMap: { [date: string]: number } = {};

    for (const row of trendRows) {
      const rawDate = row.dimensionValues?.[0]?.value || '';
      const source = row.dimensionValues?.[1]?.value || '';
      const medium = row.dimensionValues?.[2]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const fullSource = `${source}${medium ? `/${medium}` : ''}`;

      if (isAiSource(fullSource) || isAiSource(source)) {
        const date = formatDateToISO(rawDate);
        trendMap[date] = (trendMap[date] || 0) + sessions;
      }
    }

    const topAiSources = Object.entries(sessionsBySource)
      .map(([source, sessions]) => ({
        source,
        sessions,
        users: usersBySource[source] || 0,
        percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    const trend = Object.entries(trendMap)
      .map(([date, sessions]) => ({
        date: date,
        value: sessions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSessions,
      totalUsers,
      sessionsBySource,
      topAiSources,
      trend,
    };

  } catch (error: unknown) {
    console.error('[AI-Traffic] Fehler beim Abrufen:', error);
    console.error('[AI-Traffic] Request Details:', { 
      propertyId: formattedPropertyId, 
      startDate, 
      endDate 
    });

    return {
      totalSessions: 0,
      totalUsers: 0,
      sessionsBySource: {},
      topAiSources: [],
      trend: [],
    };
  }
}

// =============================================================================
// GSC LANDINGPAGE-DATEN MIT VERGLEICH
// =============================================================================

async function queryGscDataForPages(
  siteUrl: string,
  startDate: string,
  endDate: string,
  pageUrls: string[]
): Promise<Map<string, { clicks: number; impressions: number; position: number }>> {
  
  if (pageUrls.length === 0) {
    console.log('[GSC] Keine URLs zum Abfragen vorhanden');
    return new Map();
  }

  console.log(`[GSC] Abfrage von ${pageUrls.length} DB-URLs für Zeitraum ${startDate} - ${endDate}`);
  
  const auth = createAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  
  const normalizedToOriginal = new Map<string, string>();
  const apiFilterUrls = new Set<string>();

  for (const originalUrl of pageUrls) {
    const variants = createUrlVariants(originalUrl);
    const normalizedKey = normalizeUrl(originalUrl);
    
    if (!normalizedToOriginal.has(normalizedKey)) {
      normalizedToOriginal.set(normalizedKey, originalUrl);
    }
    
    variants.forEach(variant => {
      const normalizedVariantKey = normalizeUrl(variant);
      if (!normalizedToOriginal.has(normalizedVariantKey)) {
        normalizedToOriginal.set(normalizedVariantKey, originalUrl);
      }
      apiFilterUrls.add(variant);
    });
  }
  
  console.log(`[GSC] Erstellt: ${normalizedToOriginal.size} Normalisierungs-Mappings`);
  console.log(`[GSC] Sende ${apiFilterUrls.size} URL-Varianten an die API`);
  
  const sampleDbUrl = pageUrls[0];
  if (sampleDbUrl) {
    const sampleVariants = createUrlVariants(sampleDbUrl);
    console.log(`[GSC] ✅ Beispiel URL-Varianten für: ${sampleDbUrl.substring(0, 60)}...`);
    console.log(`[GSC] ✅ Erstellt ${sampleVariants.length} Varianten (inkl. bidirektionaler Sprach-Fallbacks)`);
    if (sampleVariants.length <= 20) {
      sampleVariants.slice(0, 5).forEach(v => console.log(`    - ${v}`));
    }
  }

  const MAX_FILTERS_PER_GROUP = 20;
  const allApiUrls = Array.from(apiFilterUrls);
  const urlChunks: string[][] = [];

  for (let i = 0; i < allApiUrls.length; i += MAX_FILTERS_PER_GROUP) {
    urlChunks.push(allApiUrls.slice(i, i + MAX_FILTERS_PER_GROUP));
  }

  console.log(`[GSC] Aufruf wird in ${urlChunks.length} Chunks aufgeteilt.`);

  const aggregatedResultMap = new Map<string, { 
    clicks: number; 
    impressions: number; 
    position: number; 
    count: number 
  }>();
  
  try {
    for (let i = 0; i < urlChunks.length; i++) {
      const chunk = urlChunks[i];
      console.log(`[GSC] Verarbeite Chunk ${i + 1}/${urlChunks.length} (${chunk.length} URLs)`);
      
      try {
        const response = await searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate,
            endDate,
            dimensions: ['page'],
            type: 'web',
            aggregationType: 'byPage',
            dimensionFilterGroups: [{
              filters: chunk.map(pageUrl => ({
                dimension: 'page',
                operator: 'equals',
                expression: pageUrl
              }))
            }],
            rowLimit: 5000
          },
        });

        const rows = response.data.rows || [];
        console.log(`[GSC] Chunk ${i + 1}: ${rows.length} Zeilen empfangen`);

        for (const row of rows) {
          const gscUrl = row.keys?.[0];
          if (!gscUrl) continue;

          const normalizedGscUrl = normalizeUrl(gscUrl);
          const originalUrl = normalizedToOriginal.get(normalizedGscUrl);
          
          if (originalUrl) {
            const existing = aggregatedResultMap.get(originalUrl) || { 
              clicks: 0, 
              impressions: 0, 
              position: 0, 
              count: 0 
            };
            
            const clicks = row.clicks || 0;
            const impressions = row.impressions || 0;
            const position = row.position || 0;
            const newImpressions = existing.impressions + impressions;
            
            let newPosition = existing.position;
            if (position > 0) {
              if (existing.position === 0) {
                newPosition = position;
              } else {
                const totalImpressions = existing.impressions + impressions;
                if (totalImpressions > 0) {
                  newPosition = ((existing.position * existing.impressions) + (position * impressions)) / totalImpressions;
                }
              }
            }

            aggregatedResultMap.set(originalUrl, {
              clicks: existing.clicks + clicks,
              impressions: newImpressions,
              position: newPosition,
              count: existing.count + 1
            });
            
            if (aggregatedResultMap.size <= 3) {
              console.log(`[GSC] ✅ Match: ${gscUrl.substring(0, 50)}... → ${originalUrl.substring(0, 50)}... (${clicks} clicks)`);
            }
          } else {
            if (i === 0 && rows.indexOf(row) < 3) {
              console.log(`[GSC] ⚠️ Kein Match: ${gscUrl.substring(0, 60)}... (Norm: ${normalizedGscUrl.substring(0, 50)}...)`);
            }
          }
        }

        if (i < urlChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (chunkError) {
        console.error(`[GSC] ❌ Fehler bei Chunk ${i + 1}:`, chunkError);
      }
    }
    
    const finalMap = new Map<string, { clicks: number; impressions: number; position: number }>();
    aggregatedResultMap.forEach((value, key) => {
      finalMap.set(key, {
        clicks: value.clicks,
        impressions: value.impressions,
        position: value.position
      });
    });

    console.log(`[GSC] ✅ ${finalMap.size} von ${pageUrls.length} DB-URLs erfolgreich zugeordnet`);
    
    const unmatchedUrls = pageUrls.filter(url => !finalMap.has(url));
    if (unmatchedUrls.length > 0) {
      console.log(`[GSC] ⚠️ ${unmatchedUrls.length} DB-URLs ohne GSC-Daten`);
      if (unmatchedUrls.length <= 5) {
        unmatchedUrls.forEach(url => {
          console.log(`  - ${url} (Norm: ${normalizeUrl(url)})`);
        });
      }
    }

    return finalMap;
    
  } catch (error: unknown) {
    console.error(`[GSC] ❌ Fehler beim Abrufen der Page-Daten (${startDate} - ${endDate}):`, error);
    if (error instanceof Error) {
      console.error('[GSC] Error Message:', error.message);
    }
    return new Map();
  }
}

export async function getGscDataForPagesWithComparison(
  siteUrl: string,
  pageUrls: string[],
  currentRange: { startDate: string; endDate: string },
  previousRange: { startDate: string; endDate: string }
): Promise<Map<string, GscPageData>> {
  
  console.log('[GSC] === START: getGscDataForPagesWithComparison ===');
  console.log(`[GSC] Site URL: ${siteUrl}`);
  console.log(`[GSC] Anzahl URLs: ${pageUrls.length}`);
  console.log(`[GSC] Current: ${currentRange.startDate} - ${currentRange.endDate}`);
  console.log(`[GSC] Previous: ${previousRange.startDate} - ${previousRange.endDate}`);
  
  const [currentDataMap, previousDataMap] = await Promise.all([
    queryGscDataForPages(siteUrl, currentRange.startDate, currentRange.endDate, pageUrls),
    queryGscDataForPages(siteUrl, previousRange.startDate, previousRange.endDate, pageUrls)
  ]);

  const resultMap = new Map<string, GscPageData>();

  for (const url of pageUrls) {
    const current = currentDataMap.get(url) || { clicks: 0, impressions: 0, position: 0 };
    const previous = previousDataMap.get(url) || { clicks: 0, impressions: 0, position: 0 };

    const currentPos = current.position || 0;
    const prevPos = previous.position || 0;

    let posChange = 0;
    if (currentPos > 0 && prevPos > 0) {
      posChange = prevPos - currentPos;
    }
    
    const roundedPosChange = Math.round(posChange * 100) / 100;

    resultMap.set(url, {
      clicks: current.clicks,
      clicks_prev: previous.clicks,
      clicks_change: current.clicks - previous.clicks,
      
      impressions: current.impressions,
      impressions_prev: previous.impressions,
      impressions_change: current.impressions - previous.impressions,
      
      position: Math.round(currentPos * 100) / 100,
      position_prev: Math.round(prevPos * 100) / 100,
      position_change: roundedPosChange
    });
  }

  console.log(`[GSC] === ENDE: ${resultMap.size} URLs mit Daten versehen ===`);
  
  return resultMap;
}
