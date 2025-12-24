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
    hasAuthor: boolean; // NEU: Für E-E-A-T
    hasDate: boolean;   // NEU: Für Aktualität
  };
  linkStructure: {
    internal: LinkInfo[];
    externalCount: number;
    internalCount: number;
    externalLinksSample: LinkInfo[]; // NEU: Um zu sehen, wohin verlinkt wird
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
  const builders = ['wix', 'squarespace', 'jimdo', 'shopify', 'weebly', 'webflow', 'elementor', 'divi'];
  
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
  const isBuilder = builders.some(b => detectedCms.toLowerCase().includes(b) || htmlLower.includes(b));

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

  // 3. Schema & Meta-Daten (E-E-A-T relevant)
  const hasSchema = $('script[type="application/ld+json"]').length > 0;
  const hasAuthor = $('meta[name="author"]').length > 0 || $('meta[property="article:author"]').length > 0;
  const hasDate = $('meta[property="article:published_time"]').length > 0 || $('time').length > 0;

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

  // 5. Link Struktur & Trust (Verbesserte Logik mit URL-Klasse)
  const allLinkText = $('a').map((_, el) => $(el).text().toLowerCase()).get().join(' ');
  const hasImprint = /impressum|imprint|anbieterkennzeichnung/.test(allLinkText);
  const hasPrivacy = /datenschutz|privacy/.test(allLinkText);
  const hasContact = /kontakt|contact/.test(allLinkText);

  const internalLinks: LinkInfo[] = [];
  const externalLinksSample: LinkInfo[] = [];
  let externalCount = 0;
  
  // Hostname normalisieren (ohne www)
  let currentHost = '';
  try {
    currentHost = new URL(baseUrl).hostname.replace(/^www\./, '');
  } catch (e) {
    // Fallback falls baseUrl invalide ist (sollte nicht passieren)
    console.error('Base URL Invalid:', baseUrl);
  }

  $('a').each((_, el) => {
    const rawHref = $(el).attr('href');
    const text = $(el).text().trim().replace(/\s+/g, ' ');

    // Filter für nutzlose Links
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:') || text.length < 2) return;

    try {
      // URL Auflösung: Macht aus relativen Pfaden absolute URLs
      const absoluteUrl = new URL(rawHref, baseUrl);
      const linkHost = absoluteUrl.hostname.replace(/^www\./, '');
      
      const isInternal = linkHost === currentHost;

      const linkObj = { text: text.substring(0, 60), href: absoluteUrl.href, isInternal };

      if (isInternal) {
        // Duplikate vermeiden
        if (!internalLinks.some(l => l.href === absoluteUrl.href)) {
          internalLinks.push(linkObj);
        }
      } else {
        externalCount++;
        // Sammle ein paar externe Links für die Analyse (E-E-A-T: zitiert er Quellen?)
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
    hasSchema,
    imageAnalysis: { total: images.length, withAlt, modernFormats, score: imgScore },
    trustSignals: { hasImprint, hasPrivacy, hasContact, hasAuthor, hasDate },
    linkStructure: {
      internal: internalLinks.slice(0, 20), // Mehr Links für Analyse übergeben
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
    // PROMPT CONSTRUCTION - Optimiert für E-E-A-T & Interne Links
    // ------------------------------------------------------------------

    const formatData = (data: any) => `
      TITEL: ${data.title} (Länge: ${data.title.length})
      H1: ${data.h1 || 'KEINE H1 GEFUNDEN'}
      CMS: ${data.cmsData.cms}
      
      TECH-FAKTEN:
      - Semantik-Score: ${data.techStats.codeQuality.semanticScore}/100
      - Schema.org: ${data.techStats.hasSchema ? 'Ja' : 'Nein'}
      
      E-E-A-T SIGNALE (Technisch):
      - Autoren-Tag: ${data.techStats.trustSignals.hasAuthor ? 'Vorhanden' : 'Fehlt'}
      - Datum: ${data.techStats.trustSignals.hasDate ? 'Vorhanden' : 'Fehlt'}
      - Impressum/Kontakt Links im Text erkannt: ${data.techStats.trustSignals.hasImprint ? 'Ja' : 'Nein'}
      
      STRUKTUR:
      - Interne Links (Total): ${data.techStats.linkStructure.internalCount}
      - Interne Link-Beispiele: ${data.techStats.linkStructure.internal.map((l:any) => l.text).slice(0,5).join(', ')}
      - Externe Links (Total): ${data.techStats.linkStructure.externalCount}
      - Externe Link-Beispiele (Quellen?): ${data.techStats.linkStructure.externalLinksSample.map((l:any) => l.text).join(', ')}

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
      Prüfe kritisch, ob interne Links (Siloing) und E-E-A-T (Trust) ausreichend sind.

      STYLE GUIDE: ${compactStyles}
      
      STRUKTUR & INHALT:
      
      1. <div class="${STYLES.card}">
         <h3 class="${STYLES.h3}"><i class="bi bi-speedometer2"></i> Quick Check</h3>
         <div class="grid grid-cols-2 gap-4 text-sm">
           <div>
             <strong>Titel & H1:</strong><br>
             ${targetData.title.length > 60 ? '⚠️ Title zu lang' : '✅ Title optimal'} / ${targetData.h1 ? '✅ H1 da' : '❌ H1 fehlt'}
           </div>
           <div>
             <strong>System:</strong><br>
             ${targetData.cmsData.cms}
           </div>
           <div>
             <strong>Verlinkung:</strong><br>
             ${targetData.techStats.linkStructure.internalCount > 5 ? '✅ Gute Struktur' : '⚠️ Zu wenig interne Links'} (${targetData.techStats.linkStructure.internalCount} Links)
           </div>
           <div>
             <strong>Keywords:</strong><br>
             ${keywords ? (targetData.content.toLowerCase().includes(keywords.split(' ')[0].toLowerCase()) ? '✅ Gefunden' : '⚠️ Fehlt im Top-Bereich') : '⚪ Auto-Detect'}
           </div>
         </div>
      </div>

      2. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-shield-check"></i> E-E-A-T & Trust Analyse</h3>
         <p class="text-xs text-gray-500 mb-3">Bewertung nach Google Quality Rater Guidelines (Experience, Expertise, Authoritativeness, Trust).</p>
         
         <div class="space-y-3 text-sm">
            <div class="p-2 bg-slate-50 rounded border border-slate-100">
                <strong><i class="bi bi-person-badge"></i> Expertise & Autor (E-E):</strong>
                <br>
                ${targetData.techStats.trustSignals.hasAuthor ? '✅ Technisches Autoren-Tag gefunden.' : '⚠️ Kein Autoren-Meta-Tag.'}
                Gibt es klare Autoren-Boxen oder "Über uns" Referenzen im Text? Wirkt der Inhalt von einem echten Experten geschrieben?
                <br>
                <em>Urteil: [Dein kritisches Urteil hier]</em>
            </div>
            
            <div class="p-2 bg-slate-50 rounded border border-slate-100">
                <strong><i class="bi bi-patch-check"></i> Autorität & Trust (A-T):</strong>
                <br>
                Sind Impressum/Datenschutz/Kontakt leicht findbar?
                Werden externe Quellen zitiert (Outbound Links: ${targetData.techStats.linkStructure.externalCount})?
            </div>
         </div>
      </div>

      3. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-file-text"></i> Content & Siloing</h3>
         <ul class="${STYLES.list}">
           <li><strong>Inhaltstiefe:</strong> Deckt der Text das Thema umfassend ab?</li>
           <li><strong>Interne Verlinkung:</strong> Es wurden ${targetData.techStats.linkStructure.internalCount} interne Links im Content-Bereich gefunden. Bewertung: Reicht das für eine gute SEO-Struktur?</li>
           <li><strong>Conversion:</strong> Gibt es klare Call-to-Actions?</li>
         </ul>
      </div>

      4. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-lightbulb"></i> Maßnahmen-Plan</h3>
         3 konkrete Schritte zur Verbesserung von E-E-A-T und Rankings.
      </div>
      
      Antworte NUR mit HTML.
    `;

    const comparePrompt = `
      ${basePrompt}
      
      VERGLEICH MIT WETTBEWERBER (${competitorUrl}):
      ${competitorData ? formatData(competitorData) : 'Keine Daten'}
      
      AUFGABE:
      Führe einen direkten Vergleich durch. Warum rankt der Wettbewerber ggf. besser? Fokus auf E-E-A-T und Content-Tiefe.

      FORMAT: NUR HTML. Style: ${compactStyles}

      STRUKTUR:
      1. <div class="${STYLES.grid2} gap-4 mb-4">
           <div class="${STYLES.card}">
             <h4 class="${STYLES.h4}">Meine Seite</h4>
             <div class="text-sm">
               <div>System: ${targetData.cmsData.cms}</div>
               <div>Interne Links: ${targetData.techStats.linkStructure.internalCount}</div>
               <div>E-E-A-T Tech: ${targetData.techStats.trustSignals.hasAuthor ? '✅ Autor-Tag' : '❌ Kein Autor-Tag'}</div>
             </div>
           </div>
           <div class="${STYLES.card} bg-indigo-50 border-indigo-100">
             <h4 class="${STYLES.h4}">Wettbewerber</h4>
             <div class="text-sm">
               <div>System: ${competitorData?.cmsData.cms}</div>
               <div>Interne Links: ${competitorData?.techStats.linkStructure.internalCount}</div>
               <div>E-E-A-T Tech: ${competitorData?.techStats.trustSignals.hasAuthor ? '✅ Autor-Tag' : '❌ Kein Autor-Tag'}</div>
             </div>
           </div>
         </div>

      2. <div class="${STYLES.card}">
           <h3 class="${STYLES.h3}"><i class="bi bi-trophy"></i> E-E-A-T Battle</h3>
           <p class="mb-2 text-sm text-gray-600">Wer wirkt vertrauenswürdiger?</p>
           <ul class="${STYLES.list}">
             <li><strong>Expertise-Eindruck:</strong> Wirkt der Text des Wettbewerbers professioneller/tiefgehender?</li>
             <li><strong>Trust-Signale:</strong> Hat der Wettbewerber mehr/bessere Quellenangaben oder Autoren-Informationen?</li>
             <li><strong>Aktualität:</strong> Wirken die Inhalte frischer?</li>
           </ul>
      </div>

      3. <div class="${STYLES.card} mt-4">
           <h3 class="${STYLES.h3}"><i class="bi bi-diagram-3"></i> Struktur & Technik Gap</h3>
           <div class="text-sm">
             <p><strong>Verlinkung:</strong> Meine Seite (${targetData.techStats.linkStructure.internalCount}) vs. Wettbewerber (${competitorData?.techStats.linkStructure.internalCount}).</p>
             <p><strong>Analyse:</strong> Nutzt der Wettbewerber interne Links aggressiver für SEO-Siloing?</p>
           </div>
      </div>

      4. <div class="${STYLES.card} mt-4">
           <h3 class="${STYLES.h3}"><i class="bi bi-rocket-takeoff"></i> Attacke-Plan</h3>
           Wie schlagen wir ihn? 3 aggressive Schritte (z.B. Autoren-Profile ergänzen, Content vertiefen, interne Links ausbauen).
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
