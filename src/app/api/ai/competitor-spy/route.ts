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
  hasSchema: boolean;
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
  };
  linkStructure: {
    internal: LinkInfo[];
    externalCount: number;
    internalCount: number;
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
  const builders = ['wix', 'squarespace', 'jimdo', 'shopify', 'weebly', 'webflow'];
  
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

  // Ist es ein Baukasten?
  const isBuilder = builders.some(b => detectedCms.toLowerCase().includes(b));

  return { cms: detectedCms, isBuilder };
}

function analyzeTech(html: string, $: cheerio.CheerioAPI, baseUrl: string): TechStats {
  // 1. Seitengröße
  const pageSizeKb = Math.round((Buffer.byteLength(html, 'utf8') / 1024) * 100) / 100;

  // 2. Semantisches HTML & Code Qualität
  const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
  const foundTags = semanticTags.filter(tag => $(tag).length > 0);
  
  let semanticScore = Math.round((foundTags.length / semanticTags.length) * 100);
  if ($('h1').length === 1) semanticScore += 10; 
  if (semanticScore > 100) semanticScore = 100;

  const domDepth = $('*').length;

  // 3. Schema
  const hasSchema = $('script[type="application/ld+json"]').length > 0;

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

  // 5. Link Struktur & Trust
  const allLinkText = $('a').map((_, el) => $(el).text().toLowerCase()).get().join(' ');
  const hasImprint = /impressum|imprint|anbieterkennzeichnung/.test(allLinkText);
  const hasPrivacy = /datenschutz|privacy/.test(allLinkText);
  const hasContact = /kontakt|contact/.test(allLinkText);

  const internalLinks: LinkInfo[] = [];
  let externalCount = 0;
  let baseDomain = '';
  try { baseDomain = new URL(baseUrl).hostname; } catch (e) {}

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || text.length < 2) return;

    let isInternal = false;
    if (href.startsWith('/') || href.includes(baseDomain)) isInternal = true;

    if (isInternal) {
      if (!internalLinks.some(l => l.href === href)) internalLinks.push({ text, href, isInternal: true });
    } else {
      externalCount++;
    }
  });

  const cmsInfo = detectCMS(html, $);

  return {
    pageSizeKb,
    hasSchema,
    imageAnalysis: { total: images.length, withAlt, modernFormats, score: imgScore },
    trustSignals: { hasImprint, hasPrivacy, hasContact },
    linkStructure: {
      internal: internalLinks.slice(0, 15), // Limit für Prompt
      internalCount: internalLinks.length,
      externalCount
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
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      next: { revalidate: 3600 }
    });

    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);

    // Analyse VOR dem Entfernen von Tags
    const cmsData = detectCMS(html, $);
    const techStats = analyzeTech(html, $, url);

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
    
    // ALLE Varianten akzeptieren
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
    // PROMPT CONSTRUCTION - Die "Master" Version
    // ------------------------------------------------------------------

    const formatData = (data: any) => `
      TITEL: ${data.title} (Länge: ${data.title.length})
      H1: ${data.h1 || 'KEINE H1 GEFUNDEN'}
      CMS: ${data.cmsData.cms} (${data.cmsData.isBuilder ? 'Baukasten' : 'Profi-Stack'})
      
      TECH-FAKTEN:
      - HTML-Größe: ${data.techStats.pageSizeKb} KB
      - Semantik-Score: ${data.techStats.codeQuality.semanticScore}/100 (Tags: ${data.techStats.codeQuality.semanticTagsFound.join(',')})
      - Schema.org: ${data.techStats.hasSchema ? 'Ja' : 'Nein'}
      - Bilder: ${data.techStats.imageAnalysis.modernFormats} modern / ${data.techStats.imageAnalysis.total} total
      
      STRUKTUR:
      - Interne Links: ${data.techStats.linkStructure.internalCount}
      - Link-Beispiele: ${data.techStats.linkStructure.internal.map((l:any) => l.text).slice(0,3).join(', ')}

      CONTENT (Auszug):
      ${data.content.substring(0, 2000)}...
    `;

    const basePrompt = `
      Du bist ein Elite-SEO-Analyst und Senior Developer. Du analysierst Webseiten auf:
      1. SEO & Content (Keywords, E-E-A-T, Schwachstellen)
      2. Technische Qualität (Code-Sauberkeit, Ladezeit-Indikatoren, Semantik)
      
      ZIEL-KEYWORDS: ${keywords || 'Keine angegeben (Analysiere das Hauptthema)'}

      DATEN ZIEL-SEITE:
      ${formatData(targetData)}
    `;

    const singlePrompt = `
      ${basePrompt}
      
      AUFGABE:
      Erstelle einen umfassenden Audit-Report. Sei kritisch aber konstruktiv.

      FORMAT: NUR HTML. Style: ${compactStyles}
      
      STRUKTUR:
      1. <div class="${STYLES.card}">
         <h3 class="${STYLES.h3}"><i class="bi bi-speedometer2"></i> Quick Check</h3>
         <div class="grid grid-cols-2 gap-4 text-sm">
           <div>
             <strong>Titel & H1:</strong><br>
             ${targetData.title.length > 60 ? '⚠️ Title zu lang' : '✅ Title optimal'} / ${targetData.h1 ? '✅ H1 da' : '❌ H1 fehlt'}
           </div>
           <div>
             <strong>System:</strong><br>
             ${targetData.cmsData.cms} ${targetData.cmsData.isBuilder ? '(Baukasten)' : '(Custom/Pro)'}
           </div>
           <div>
             <strong>Trust:</strong><br>
             ${targetData.techStats.trustSignals.hasImprint ? '✅ Impressum' : '⚠️ Impressum prüfen'}
           </div>
           <div>
             <strong>Keywords:</strong><br>
             ${keywords ? (targetData.content.toLowerCase().includes(keywords.split(' ')[0].toLowerCase()) ? '✅ Im Text gefunden' : '⚠️ Nicht im Top-Content') : '⚪ Auto-Detect'}
           </div>
         </div>
      </div>

      2. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-code-slash"></i> Code-Qualität & Technik</h3>
         <p class="text-xs text-gray-500 mb-2">Wie sauber ist die technische Basis programmiert?</p>
         <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="${targetData.techStats.codeQuality.semanticScore > 50 ? 'text-green-700' : 'text-red-600'}">
              <strong>Semantik:</strong> ${targetData.techStats.codeQuality.semanticScore > 50 ? '✅ Modernes HTML5' : '❌ Veraltete Div-Suppe'}
            </div>
            <div>
              <strong>HTML-Größe:</strong> ${targetData.techStats.pageSizeKb} KB ${targetData.techStats.pageSizeKb > 100 ? '(⚠️ schwer)' : '(✅ leicht)'}
            </div>
            <div>
               <strong>Bilder:</strong> ${targetData.techStats.imageAnalysis.modernFormats > 0 ? '✅ WebP/AVIF' : '⚠️ Alte Formate'}
            </div>
            <div>
               <strong>Schema:</strong> ${targetData.techStats.hasSchema ? '✅ Vorhanden' : '❌ Fehlt'}
            </div>
         </div>
      </div>

      3. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-file-text"></i> Content & SEO Analyse</h3>
         <ul class="${STYLES.list}">
           <li><strong>E-E-A-T Eindruck:</strong> Wirkt der Text expertig oder generisch? [Kurze Einschätzung]</li>
           <li><strong>Struktur:</strong> Interne Links gefunden: ${targetData.techStats.linkStructure.internalCount}. [Bewertung: Ist das genug für SEO?]</li>
           <li><strong>Schwachstellen:</strong> Nenne 2 konkrete Content-Fehler (z.B. Thin Content, keine Call-to-Action).</li>
         </ul>
      </div>

      4. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-lightbulb"></i> Maßnahmen-Plan</h3>
         3 Prioritäten (Mix aus Technik-Fixes und Content-Optimierung).
      </div>
      
      Antworte NUR mit HTML.
    `;

    const comparePrompt = `
      ${basePrompt}
      
      VERGLEICH MIT WETTBEWERBER (${competitorUrl}):
      ${competitorData ? formatData(competitorData) : 'Keine Daten'}
      
      AUFGABE:
      Warum rankt der Wettbewerber vielleicht besser? Vergleiche Technik UND Content.

      FORMAT: NUR HTML. Style: ${compactStyles}

      STRUKTUR:
      1. <div class="${STYLES.grid2} gap-4 mb-4">
           <div class="${STYLES.card}">
             <h4 class="${STYLES.h4}">Meine Seite</h4>
             <div class="text-sm">
               <div>System: ${targetData.cmsData.cms}</div>
               <div>Code: ${targetData.techStats.codeQuality.semanticScore > 50 ? '✅ Semantisch' : '❌ Div-Suppe'}</div>
               <div>Links: ${targetData.techStats.linkStructure.internalCount}</div>
             </div>
           </div>
           <div class="${STYLES.card} bg-indigo-50 border-indigo-100">
             <h4 class="${STYLES.h4}">Wettbewerber</h4>
             <div class="text-sm">
               <div>System: ${competitorData?.cmsData.cms}</div>
               <div>Code: ${competitorData?.techStats.codeQuality.semanticScore! > 50 ? '✅ Semantisch' : '❌ Div-Suppe'}</div>
               <div>Links: ${competitorData?.techStats.linkStructure.internalCount}</div>
             </div>
           </div>
         </div>

      2. <div class="${STYLES.card}">
           <h3 class="${STYLES.h3}"><i class="bi bi-trophy"></i> Der entscheidende Unterschied</h3>
           <p>Analysiere die Lücke (Gap Analysis):</p>
           <ul class="${STYLES.list} mt-2">
             <li><strong>Technik-Gap:</strong> Wer hat die schnellere/sauberere Basis? (Vergleich HTML-Größe & Semantik)</li>
             <li><strong>Content-Gap:</strong> Wer deckt das Thema "${keywords}" besser ab?</li>
             <li><strong>Struktur:</strong> Hat der Gegner mehr Unterseiten/Links?</li>
           </ul>
      </div>

      3. <div class="${STYLES.card} mt-4">
           <h3 class="${STYLES.h3}"><i class="bi bi-rocket-takeoff"></i> Attacke-Plan</h3>
           Wie schlagen wir ihn? 3 aggressive Schritte (Technik verbessern oder Content erweitern).
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
