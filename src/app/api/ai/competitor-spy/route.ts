// src/app/api/ai/competitor-spy/route.ts
import { streamTextSafe } from '@/lib/ai-config';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES, getCompactStyleGuide } from '@/lib/ai-styles';
import { URL } from 'url';

export const runtime = 'nodejs';
export const maxDuration = 300;

// ============================================================================
// TYPEN & INTERFACES
// ============================================================================

interface LinkInfo {
  text: string;
  href: string;
  isInternal: boolean;
}

interface TechStats {
  pageSizeKb: number;
  // NEU: Performance Metrik
  performance: {
    ttfbMs: number; // Time to First Byte in Millisekunden
    rating: 'Schnell' | 'Mittel' | 'Langsam';
  };
  hasSchema: boolean;
  // NEU: Struktur Metriken
  structure: {
    headings: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number };
    hasMainH1: boolean;
  };
  imageAnalysis: {
    total: number;
    withAlt: number;
    modernFormats: number;
    score: number;
  };
  trustSignals: {
    hasImprint: boolean;
    hasPrivacy: boolean;
    hasContact: boolean;
    hasAuthor: boolean; // E-E-A-T
    hasDate: boolean;   // Aktualität
  };
  linkStructure: {
    internal: LinkInfo[];
    externalCount: number;
    internalCount: number;
    externalLinksSample: LinkInfo[];
  };
  codeQuality: {
    semanticScore: number; // 0-100
    semanticTagsFound: string[];
    domDepth: number;
    isBuilder: boolean;
  };
}

// ============================================================================
// FUNKTIONEN (Scraping & Detection)
// ============================================================================

function detectCMS(html: string, $: cheerio.CheerioAPI): { cms: string; isBuilder: boolean } {
  const htmlLower = html.toLowerCase();
  
  // CMS Definitionen
  const builders = ['wix', 'squarespace', 'jimdo', 'shopify', 'weebly', 'webflow', 'elementor', 'divi', 'clickfunnels'];
  
  let detectedCms = 'Custom Code / Unbekannt';
  
  // Checks
  if (htmlLower.includes('wp-content')) detectedCms = 'WordPress';
  else if (htmlLower.includes('wix.com') || htmlLower.includes('wix-')) detectedCms = 'Wix';
  else if (htmlLower.includes('squarespace')) detectedCms = 'Squarespace';
  else if (htmlLower.includes('jimdo')) detectedCms = 'Jimdo';
  else if (htmlLower.includes('shopify')) detectedCms = 'Shopify';
  else if (htmlLower.includes('typo3')) detectedCms = 'TYPO3';
  else if (htmlLower.includes('joomla')) detectedCms = 'Joomla';
  else if (htmlLower.includes('webflow')) detectedCms = 'Webflow';
  else if (htmlLower.includes('next.js') || htmlLower.includes('__next')) detectedCms = 'Next.js (React)';
  else if (htmlLower.includes('nuxt')) detectedCms = 'Nuxt.js (Vue)';

  // Ist es ein Baukasten?
  const isBuilder = builders.some(b => detectedCms.toLowerCase().includes(b) || htmlLower.includes(b));

  return { cms: detectedCms, isBuilder };
}

function analyzeTech(html: string, $: cheerio.CheerioAPI, baseUrl: string, ttfbMs: number): TechStats {
  // 1. Seitengröße
  const pageSizeKb = Math.round((Buffer.byteLength(html, 'utf8') / 1024) * 100) / 100;

  // 1b. Performance Bewertung (TTFB)
  // < 300ms = exzellent, < 800ms = gut/mittel, > 800ms = verbesserungswürdig
  let perfRating: 'Schnell' | 'Mittel' | 'Langsam' = 'Mittel';
  if (ttfbMs < 300) perfRating = 'Schnell';
  else if (ttfbMs > 800) perfRating = 'Langsam';

  // 2. Semantisches HTML & Code Qualität
  const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
  const foundTags = semanticTags.filter(tag => $(tag).length > 0);
  
  // NEU: Detaillierte Heading-Analyse
  const headings = {
    h1: $('h1').length,
    h2: $('h2').length,
    h3: $('h3').length,
    h4: $('h4').length,
    h5: $('h5').length,
    h6: $('h6').length
  };

  let semanticScore = Math.round((foundTags.length / semanticTags.length) * 100);
  if (headings.h1 === 1) semanticScore += 10; 
  if (semanticScore > 100) semanticScore = 100;

  const domDepth = $('*').length;

  // 3. Schema & Meta-Daten (E-E-A-T relevant)
  const hasSchema = $('script[type="application/ld+json"]').length > 0;

  // 3a. Erweiterte Autor-Erkennung (Meta, Link-Rel, Microdata)
  const hasAuthor = 
    $('meta[name="author"]').length > 0 || 
    $('meta[property="article:author"]').length > 0 ||
    $('link[rel~="author"]').length > 0 ||      // <link rel="author">
    $('a[rel~="author"]').length > 0 ||         // <a rel="author">
    $('[itemprop="author"]').length > 0 ||      // Schema Microdata
    $('.author-name, .post-author').length > 0; // Gängige Klassen

  // 3b. Erweiterte Datums-Erkennung
  const hasDate = 
    $('meta[property="article:published_time"]').length > 0 || 
    $('meta[property="og:updated_time"]').length > 0 ||
    $('meta[name="date"]').length > 0 ||
    $('time').length > 0 ||                             // HTML5 <time>
    $('[itemprop="datePublished"]').length > 0 ||       // Schema Microdata
    $('[itemprop="dateModified"]').length > 0 ||
    $('.date, .published, .entry-date, .post-date, .meta-date').length > 0; // Heuristik Klassen

  // 4. Bilder
  const images = $('img');
  let withAlt = 0;
  let modernFormats = 0;
  images.each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt');
    if (alt && alt.trim().length > 0) withAlt++;
    if (src.toLowerCase().match(/\.(webp|avif)(\?.*)?$/)) modernFormats++;
  });
  const imgScore = images.length === 0 ? 100 : Math.round(((withAlt + modernFormats) / (images.length * 2)) * 100);

  // 5. Link Struktur & Trust (Mit URL-Klasse)
  const allLinkText = $('a').map((_, el) => $(el).text().toLowerCase()).get().join(' ');
  const hasImprint = /impressum|imprint|anbieterkennzeichnung/.test(allLinkText);
  const hasPrivacy = /datenschutz|privacy/.test(allLinkText);
  const hasContact = /kontakt|contact/.test(allLinkText);

  const internalLinks: LinkInfo[] = [];
  const externalLinksSample: LinkInfo[] = [];
  let externalCount = 0;
  
  // Hostname normalisieren
  let currentHost = '';
  try {
    currentHost = new URL(baseUrl).hostname.replace(/^www\./, '');
  } catch (e) {
    console.error('Base URL Invalid:', baseUrl);
  }

  $('a').each((_, el) => {
    const rawHref = $(el).attr('href');
    const text = $(el).text().trim().replace(/\s+/g, ' ');

    // Filter
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:') || text.length < 2) return;

    try {
      // URL Auflösung
      const absoluteUrl = new URL(rawHref, baseUrl);
      const linkHost = absoluteUrl.hostname.replace(/^www\./, '');
      
      const isInternal = linkHost === currentHost;
      const linkObj = { text: text.substring(0, 60), href: absoluteUrl.href, isInternal };

      if (isInternal) {
        if (!internalLinks.some(l => l.href === absoluteUrl.href)) {
          internalLinks.push(linkObj);
        }
      } else {
        externalCount++;
        // Sammle externe Links (für E-E-A-T Analyse)
        if (externalLinksSample.length < 5 && !externalLinksSample.some(l => l.href === absoluteUrl.href)) {
          externalLinksSample.push(linkObj);
        }
      }
    } catch (e) {
      // Ignoriere invalide URLs
    }
  });

  const cmsInfo = detectCMS(html, $);

  return {
    pageSizeKb,
    performance: { ttfbMs, rating: perfRating }, // NEU
    hasSchema,
    imageAnalysis: { total: images.length, withAlt, modernFormats, score: imgScore },
    trustSignals: { hasImprint, hasPrivacy, hasContact, hasAuthor, hasDate },
    structure: { headings, hasMainH1: headings.h1 > 0 }, // NEU
    linkStructure: {
      internal: internalLinks.slice(0, 25), 
      internalCount: internalLinks.length,
      externalCount,
      externalLinksSample
    },
    codeQuality: {
      semanticScore,
      semanticTagsFound: foundTags,
      domDepth,
      isBuilder: cmsInfo.isBuilder
    }
  };
}

async function scrapeContent(url: string) {
  try {
    // NEU: Zeitmessung Start
    const startTime = Date.now();

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      next: { revalidate: 3600 }
    });

    // NEU: Zeitmessung Ende (TTFB)
    const ttfb = Date.now() - startTime;

    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);

    // Analyse VOR dem Entfernen von Tags
    const cmsData = detectCMS(html, $);
    
    // NEU: Übergabe von TTFB an die Analyse
    const techStats = analyzeTech(html, $, url, ttfb);

    // Aufräumen für Text-Content
    $('script, style, nav, footer, iframe, svg, noscript').remove();

    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const h1 = $('h1').map((_, el) => $(el).text().trim()).get().join(' | ');
    
    let content = $('main').text().trim() || $('article').text().trim() || $('body').text().trim();
    content = content.replace(/\s+/g, ' ').substring(0, 8000);

    return { title, description, h1, content, cmsData, techStats };
  } catch (error) {
    console.error(`Fehler bei ${url}:`, error);
    return null;
  }
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const targetUrl = body.targetUrl || body.myUrl || body.url || body.target || body.siteUrl || body.domain;
    const competitorUrl = body.competitorUrl || body.competitor || body.compareUrl;
    const keywords = body.keywords || body.keyword || '';

    if (!targetUrl) return NextResponse.json({ message: 'URL fehlt' }, { status: 400 });

    let normalizedUrl = targetUrl.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl;

    const [targetData, competitorData] = await Promise.all([
      scrapeContent(normalizedUrl),
      competitorUrl ? scrapeContent(competitorUrl) : Promise.resolve(null)
    ]);

    if (!targetData) return NextResponse.json({ message: 'Analyse fehlgeschlagen' }, { status: 400 });

    const isCompareMode = !!(competitorUrl && competitorData);
    const compactStyles = getCompactStyleGuide();

   // ------------------------------------------------------------------
    // PROMPT CONSTRUCTION (Optimiert & Erweitert)
    // ------------------------------------------------------------------

    const formatData = (data: any) => `
      ZIEL-URL: ${normalizedUrl}
      TITEL: ${data.title}
      
      TECHNISCHE FAKTEN (Harte Daten):
      - HTTP Status: 200 OK
      - Ladezeit (TTFB): ${data.techStats.performance.ttfbMs}ms (${data.techStats.performance.rating})
      - CMS / Framework: ${data.cmsData.cms}
      - Schema.org (JSON-LD): ${data.techStats.hasSchema ? '✅ VORHANDEN' : '❌ FEHLT (Kritisch)'}
      - Viewport Meta: ${data.techStats.seoBasics?.hasViewport ? 'Ja' : 'Nein'}
      
      HTML STRUKTUR:
      - H1: ${data.techStats.structure.headings.h1}x vorhanden
      - H2: ${data.techStats.structure.headings.h2}x vorhanden
      - H3: ${data.techStats.structure.headings.h3}x vorhanden
      
      E-E-A-T SIGNALE (Technisch erkannt):
      - Autor-Tag (Meta/Rel): ${data.techStats.trustSignals.hasAuthor ? '✅ JA' : '❌ NEIN'}
      - Impressum/Kontakt im Text: ${data.techStats.trustSignals.hasImprint ? 'Ja' : 'Nein'}
      
      LINKS:
      - Intern: ${data.techStats.linkStructure.internalCount}
      - Extern: ${data.techStats.linkStructure.externalCount}

      CONTENT PREVIEW:
      ${data.content.substring(0, 2000)}...
    `;

    const basePrompt = `
      Du bist ein gnadenloser Senior SEO-Auditor (Google Quality Rater Guidelines 2024).
      Analysiere die folgenden Daten der Webseite.
      
      WICHTIG: Erwähne IMMER den Status von Schema.org und dem Autor-Tag, egal ob positiv oder negativ.

      DATEN:
      ${formatData(targetData)}
    `;

    const singlePrompt = `
      ${basePrompt}
      
      AUFGABE:
      Erstelle einen professionellen Audit-Report als HTML.
      
      STYLE GUIDE: ${compactStyles}
      
      STRUKTUR DER ANTWORT (Halte dich exakt an dieses HTML-Gerüst):
      
      <div class="${STYLES.card} mb-6">
         <div class="flex justify-between items-center mb-4 border-b pb-2">
            <h3 class="${STYLES.h3} m-0">🕵️ Audit Zusammenfassung</h3>
            <span class="text-xs font-mono bg-gray-100 px-2 py-1 rounded">TTFB: ${targetData.techStats.performance.ttfbMs}ms</span>
         </div>
         
         <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div class="p-3 rounded bg-slate-50 border border-slate-200">
               <div class="text-xs text-gray-500 uppercase">Schema.org</div>
               <div class="font-bold ${targetData.techStats.hasSchema ? 'text-green-600' : 'text-red-600'}">
                  ${targetData.techStats.hasSchema ? '✅ Aktiv' : '❌ Fehlt'}
               </div>
            </div>
            <div class="p-3 rounded bg-slate-50 border border-slate-200">
               <div class="text-xs text-gray-500 uppercase">Autor-Signal</div>
               <div class="font-bold ${targetData.techStats.trustSignals.hasAuthor ? 'text-green-600' : 'text-red-600'}">
                 ${targetData.techStats.trustSignals.hasAuthor ? '✅ Erkannt' : '❌ Fehlt'}
               </div>
            </div>
            <div class="p-3 rounded bg-slate-50 border border-slate-200">
               <div class="text-xs text-gray-500 uppercase">Struktur</div>
               <div class="font-bold text-gray-800">
                  H1: ${targetData.techStats.structure.headings.h1} | H2: ${targetData.techStats.structure.headings.h2}
               </div>
            </div>
            <div class="p-3 rounded bg-slate-50 border border-slate-200">
               <div class="text-xs text-gray-500 uppercase">Tech-Stack</div>
               <div class="font-bold text-blue-600 truncate">
                  ${targetData.cmsData.cms}
               </div>
            </div>
         </div>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
      
          <div class="${STYLES.card}">
             <h3 class="${STYLES.h3} text-indigo-700"><i class="bi bi-shield-check"></i> E-E-A-T Analyse</h3>
             <ul class="${STYLES.list} space-y-3">
                <li>
                    <strong>Strukturierte Daten:</strong> 
                    ${targetData.techStats.hasSchema 
                      ? '<span>✅ JSON-LD Schema wurde gefunden. Das hilft Google, die Entitäten zu verstehen.</span>' 
                      : '<span class="text-red-600">❌ Kein Schema-Markup gefunden. Dringend nachrüsten für "Person" oder "Organization"!</span>'}
                </li>
                <li>
                    <strong>Autor & Identität:</strong>
                    ${targetData.techStats.trustSignals.hasAuthor 
                      ? '✅ Ein technisches Autoren-Signal (Meta/Rel) ist vorhanden.' 
                      : '⚠️ Der Bot sieht keinen Autoren-Tag im Code, obwohl der Text vielleicht "Ich" sagt.'}
                </li>
                <li>
                    <strong>Rechtliche Signale:</strong>
                    ${targetData.techStats.trustSignals.hasImprint 
                      ? '✅ Impressum/Kontakt Keywords gefunden.' 
                      : '❌ Vorsicht: Impressum/Kontakt Links scheinen im Footer/Menü nicht lesbar zu sein.'}
                </li>
             </ul>
          </div>

          <div class="${STYLES.card}">
             <h3 class="${STYLES.h3} text-emerald-700"><i class="bi bi-code-slash"></i> Tech & Content</h3>
             <ul class="${STYLES.list} space-y-3">
                <li>
                    <strong>Überschriften-Hierarchie:</strong>
                    ${targetData.techStats.structure.headings.h1 === 1 
                      ? '✅ Perfekt: Genau eine H1.' 
                      : '⚠️ <strong>Achtung:</strong> ' + targetData.techStats.structure.headings.h1 + ' H1-Tags gefunden.'}
                    <br> <span class="text-xs text-gray-500">Tiefe: ${targetData.techStats.structure.headings.h2}x H2, ${targetData.techStats.structure.headings.h3}x H3.</span>
                </li>
                <li>
                    <strong>Verlinkung:</strong>
                    ${targetData.techStats.linkStructure.internalCount} interne Links gefunden.
                    ${targetData.techStats.linkStructure.internalCount < 5 ? '⚠️ Das ist sehr wenig für SEO-Siloing.' : '✅ Solide interne Vernetzung.'}
                </li>
             </ul>
          </div>
      </div>

      <div class="${STYLES.card} mt-6 bg-gradient-to-r from-gray-50 to-white">
         <h3 class="${STYLES.h3}"><i class="bi bi-list-check"></i> Konkreter Maßnahmen-Plan</h3>
         <p class="mb-3 text-sm">Basierend auf den Daten, tue jetzt folgendes:</p>
         <ol class="list-decimal pl-5 space-y-2 text-sm marker:font-bold marker:text-indigo-600">
            ${!targetData.techStats.hasSchema ? '<li><strong>Schema.org einbauen:</strong> Implementiere JSON-LD für "WebSite" und "Person".</li>' : ''}
            ${!targetData.techStats.trustSignals.hasAuthor ? '<li><strong>Meta-Author Tag:</strong> Füge <code>&lt;meta name="author" content="Name"&gt;</code> in den Head ein.</li>' : ''}
            <li><strong>Content-Check:</strong> Prüfe, ob die H2-Struktur (aktuell ${targetData.techStats.structure.headings.h2} Stück) deine Keywords abdeckt.</li>
         </ol>
      </div>
      
      Antworte NUR mit HTML. Keine Einleitung, kein Markdown.
    `;
