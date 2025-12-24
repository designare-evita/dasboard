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
    // PROMPT CONSTRUCTION
    // ------------------------------------------------------------------

    const formatData = (data: any) => `
      TITEL: ${data.title} (Länge: ${data.title.length})
      
      TECH & PERFORMANCE:
      - CMS/System: ${data.cmsData.cms}
      - Server Speed (TTFB): ${data.techStats.performance.ttfbMs}ms (${data.techStats.performance.rating})
      - Schema.org: ${data.techStats.hasSchema ? 'Ja' : 'Nein'}
      
      STRUKTUR (HTML):
      - H1: ${data.techStats.structure.headings.h1} (Titel)
      - H2: ${data.techStats.structure.headings.h2} (Hauptkapitel)
      - H3: ${data.techStats.structure.headings.h3} (Unterkapitel)
      - Semantik-Score: ${data.techStats.codeQuality.semanticScore}/100
      
      E-E-A-T SIGNALE:
      - Autor-Signal: ${data.techStats.trustSignals.hasAuthor ? '✅ Gefunden' : '❌ Fehlt'}
      - Datum-Signal: ${data.techStats.trustSignals.hasDate ? '✅ Gefunden' : '⚠️ Fehlt'}
      - Impressum/Kontakt: ${data.techStats.trustSignals.hasImprint ? 'Ja' : 'Nein'}
      
      LINKS:
      - Intern: ${data.techStats.linkStructure.internalCount} (Beispiele: ${data.techStats.linkStructure.internal.map((l:any) => l.text).slice(0,3).join(', ')})
      - Extern: ${data.techStats.linkStructure.externalCount}

      CONTENT (Auszug):
      ${data.content.substring(0, 2500)}...
    `;

    const basePrompt = `
      Du bist ein Senior SEO-Auditor mit Spezialisierung auf Google Quality Rater Guidelines (E-E-A-T).
      
      ZIEL-KEYWORDS: ${keywords || 'Keine angegeben (Analysiere Hauptthema)'}

      DATEN ZIEL-SEITE:
      ${formatData(targetData)}
    `;

    const singlePrompt = `
      ${basePrompt}
      
      AUFGABE:
      Erstelle einen tiefgehenden Audit-Report als HTML.
      Prüfe kritisch, ob Technik (Speed/Struktur), interne Links und E-E-A-T ausreichend sind.

      STYLE GUIDE: ${compactStyles}
      
      STRUKTUR & INHALT:
      
      1. <div class="${STYLES.card}">
         <h3 class="${STYLES.h3}"><i class="bi bi-speedometer2"></i> Quick Check</h3>
         <div class="grid grid-cols-2 gap-4 text-sm">
           <div>
             <strong>Speed (TTFB):</strong><br>
             ${targetData.techStats.performance.ttfbMs}ms 
             ${targetData.techStats.performance.rating === 'Schnell' ? '✅ Top' : targetData.techStats.performance.rating === 'Mittel' ? '⚠️ Okay' : '❌ Langsam'}
           </div>
           <div>
             <strong>Struktur:</strong><br>
             H1: ${targetData.techStats.structure.headings.h1} | H2: ${targetData.techStats.structure.headings.h2}
             ${targetData.techStats.structure.headings.h1 !== 1 ? '<br><span class="text-red-600">⚠️ H1 prüfen!</span>' : ''}
           </div>
           <div>
             <strong>Verlinkung:</strong><br>
             ${targetData.techStats.linkStructure.internalCount > 5 ? '✅ Gute Struktur' : '⚠️ Zu wenig Links'} (${targetData.techStats.linkStructure.internalCount})
           </div>
           <div>
             <strong>E-E-A-T Basis:</strong><br>
             ${targetData.techStats.trustSignals.hasAuthor ? '✅ Autor da' : '⚠️ Autor fehlt'} / ${targetData.techStats.trustSignals.hasDate ? 'Datum da' : 'Datum fehlt'}
           </div>
         </div>
      </div>

      2. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-shield-check"></i> E-E-A-T & Trust Analyse</h3>
         <p class="text-xs text-gray-500 mb-3">Bewertung nach Google Quality Rater Guidelines.</p>
         
         <div class="space-y-3 text-sm">
            <div class="p-2 bg-slate-50 rounded border border-slate-100">
                <strong><i class="bi bi-person-badge"></i> Expertise & Autor (E-E):</strong>
                <br>
                Wirkt der Inhalt von einem echten Experten geschrieben?
                ${!targetData.techStats.trustSignals.hasAuthor ? 'Technisch konnte kein Autor ermittelt werden. Ist er im Text sichtbar?' : 'Technisches Autor-Signal ist vorhanden.'}
                <br>
                <em>Urteil: [Dein kritisches Urteil hier]</em>
            </div>
            
            <div class="p-2 bg-slate-50 rounded border border-slate-100">
                <strong><i class="bi bi-patch-check"></i> Autorität & Trust (A-T):</strong>
                <br>
                Werden externe Quellen zitiert? (${targetData.techStats.linkStructure.externalCount > 0 ? '✅ Ja' : '❌ Nein'})
                Wie vertrauenswürdig wirkt das Seitenumfeld (Impressum, Kontakt)?
            </div>
         </div>
      </div>

      3. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-file-text"></i> Content & Struktur</h3>
         <ul class="${STYLES.list}">
           <li><strong>Hierarchie:</strong> Ist die Überschriften-Struktur (H1-H6) logisch aufgebaut?</li>
           <li><strong>Inhaltstiefe:</strong> Deckt der Text das Thema umfassend ab?</li>
           <li><strong>Interne Verlinkung:</strong> Es wurden ${targetData.techStats.linkStructure.internalCount} interne Links gefunden. Reicht das für eine gute SEO-Struktur?</li>
         </ul>
      </div>

      4. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-lightbulb"></i> Maßnahmen-Plan</h3>
         3 konkrete Schritte zur Verbesserung (Technik, Content, E-E-A-T).
      </div>
      
      Antworte NUR mit HTML.
    `;

    const comparePrompt = `
      ${basePrompt}
      
      VERGLEICH MIT WETTBEWERBER (${competitorUrl}):
      ${competitorData ? formatData(competitorData) : 'Keine Daten'}
      
      AUFGABE:
      Führe einen direkten Vergleich durch. Wer ist schneller? Wer hat die bessere Struktur? Wer hat mehr Trust?

      FORMAT: NUR HTML. Style: ${compactStyles}

      STRUKTUR:
      1. <div class="${STYLES.grid2} gap-4 mb-4">
           <div class="${STYLES.card}">
             <h4 class="${STYLES.h4}">Meine Seite</h4>
             <div class="text-sm space-y-1">
               <div><strong>Speed:</strong> ${targetData.techStats.performance.ttfbMs}ms (${targetData.techStats.performance.rating})</div>
               <div><strong>Struktur:</strong> H1: ${targetData.techStats.structure.headings.h1} | H2: ${targetData.techStats.structure.headings.h2}</div>
               <div><strong>Interne Links:</strong> ${targetData.techStats.linkStructure.internalCount}</div>
               <div><strong>Autor-Signal:</strong> ${targetData.techStats.trustSignals.hasAuthor ? '✅ Ja' : '❌ Nein'}</div>
             </div>
           </div>
           <div class="${STYLES.card} bg-indigo-50 border-indigo-100">
             <h4 class="${STYLES.h4}">Wettbewerber</h4>
             <div class="text-sm space-y-1">
               <div><strong>Speed:</strong> ${competitorData?.techStats.performance.ttfbMs}ms (${competitorData?.techStats.performance.rating})</div>
               <div><strong>Struktur:</strong> H1: ${competitorData?.techStats.structure.headings.h1} | H2: ${competitorData?.techStats.structure.headings.h2}</div>
               <div><strong>Interne Links:</strong> ${competitorData?.techStats.linkStructure.internalCount}</div>
               <div><strong>Autor-Signal:</strong> ${competitorData?.techStats.trustSignals.hasAuthor ? '✅ Ja' : '❌ Nein'}</div>
             </div>
           </div>
         </div>

      2. <div class="${STYLES.card}">
           <h3 class="${STYLES.h3}"><i class="bi bi-trophy"></i> E-E-A-T & Tech Battle</h3>
           <p class="mb-2 text-sm text-gray-600">Direkter Vergleich der Qualitätssignale.</p>
           <ul class="${STYLES.list}">
             <li><strong>Performance:</strong> Wer liefert die Inhalte schneller aus?</li>
             <li><strong>Struktur-Hygiene:</strong> Wer nutzt Überschriften (H1-H3) logischer?</li>
             <li><strong>Expertise-Eindruck:</strong> Wirkt der Text des Wettbewerbers professioneller/tiefgehender?</li>
             <li><strong>Trust-Signale:</strong> Hat der Wettbewerber mehr/bessere Quellenangaben?</li>
           </ul>
      </div>

      3. <div class="${STYLES.card} mt-4">
           <h3 class="${STYLES.h3}"><i class="bi bi-diagram-3"></i> Content Gap</h3>
           <div class="text-sm">
             <p>Nutzt der Wettbewerber interne Links aggressiver für SEO-Siloing?</p>
             <p>Deckt er Themen ab, die bei mir fehlen?</p>
           </div>
      </div>

      4. <div class="${STYLES.card} mt-4">
           <h3 class="${STYLES.h3}"><i class="bi bi-rocket-takeoff"></i> Attacke-Plan</h3>
           3 aggressive Schritte um am Wettbewerber vorbeizuziehen (Technik fixen, Content ausbauen, Trust erhöhen).
      </div>

      Antworte NUR mit HTML.
    `;

    const result = await streamTextSafe({
      prompt: isCompareMode ? comparePrompt : singlePrompt,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    console.error('Competitor Spy Error:', error);
    return NextResponse.json({ message: 'Error', error: String(error) }, { status: 500 });
  }
}
