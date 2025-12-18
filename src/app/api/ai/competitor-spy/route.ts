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
    domDepth: number; // Indikator für Verschachtelung
    isBuilder: boolean;
  };
}

// ============================================================================
// FUNKTIONEN (Scraping & Detection)
// ============================================================================

function detectCMS(html: string, $: cheerio.CheerioAPI): { cms: string; isBuilder: boolean } {
  const htmlLower = html.toLowerCase();
  
  // CMS Definitionen
  const builders = ['wix', 'squarespace', 'jimdo', 'shopify', 'weebly'];
  const pros = ['wordpress', 'typo3', 'drupal', 'joomla', 'next.js', 'react', 'vue', 'nuxt'];
  
  let detectedCms = 'Custom Code / Unbekannt';
  let isBuilder = false;

  // Checks
  if (htmlLower.includes('wp-content')) detectedCms = 'WordPress';
  else if (htmlLower.includes('wix.com') || htmlLower.includes('wix-')) detectedCms = 'Wix';
  else if (htmlLower.includes('squarespace')) detectedCms = 'Squarespace';
  else if (htmlLower.includes('jimdo')) detectedCms = 'Jimdo';
  else if (htmlLower.includes('shopify')) detectedCms = 'Shopify';
  else if (htmlLower.includes('typo3')) detectedCms = 'TYPO3';
  else if (htmlLower.includes('next.js') || htmlLower.includes('__next')) detectedCms = 'Next.js (React)';

  // Ist es ein Baukasten?
  isBuilder = builders.some(b => detectedCms.toLowerCase().includes(b));

  return { cms: detectedCms, isBuilder };
}

function analyzeTech(html: string, $: cheerio.CheerioAPI, baseUrl: string): TechStats {
  // 1. Seitengröße
  const pageSizeKb = Math.round((Buffer.byteLength(html, 'utf8') / 1024) * 100) / 100;

  // 2. Semantisches HTML & Code Qualität
  const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
  const foundTags = semanticTags.filter(tag => $(tag).length > 0);
  
  // Berechnung Semantic Score: Basierend auf Vielfalt der Tags
  // Wer nur <div> nutzt, kriegt 0. Wer header, main, footer nutzt, kriegt Punkte.
  let semanticScore = Math.round((foundTags.length / semanticTags.length) * 100);
  
  // Bonus für <h1-h6> Struktur (grob)
  if ($('h1').length === 1) semanticScore += 10; // Genau eine H1 ist gut
  if (semanticScore > 100) semanticScore = 100;

  // DOM Tiefe schätzen (Code Bloat Indikator)
  const domDepth = $('*').length; // Totale Anzahl Elemente

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
      internal: internalLinks.slice(0, 20),
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

    const cmsData = detectCMS(html, $);
    const techStats = analyzeTech(html, $, url);

    $('script, style, nav, footer, iframe, svg, noscript').remove();

    const title = $('title').text().trim();
    const h1 = $('h1').map((_, el) => $(el).text().trim()).get().join(' | ');
    
    let content = $('main').text().trim() || $('article').text().trim() || $('body').text().trim();
    content = content.replace(/\s+/g, ' ').substring(0, 8000);

    return { title, h1, content, cmsData, techStats };
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
    const targetUrl = body.targetUrl || body.url;
    const competitorUrl = body.competitorUrl;
    
    if (!targetUrl) return NextResponse.json({ message: 'URL fehlt' }, { status: 400 });
    let normalizedUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;

    const [targetData, competitorData] = await Promise.all([
      scrapeContent(normalizedUrl),
      competitorUrl ? scrapeContent(competitorUrl) : Promise.resolve(null)
    ]);

    if (!targetData) return NextResponse.json({ message: 'Fehler' }, { status: 400 });

    const isCompareMode = !!(competitorUrl && competitorData);
    const compactStyles = getCompactStyleGuide();

    // Prompt Helper
    const formatQuality = (stats: TechStats, cms: string, isBuilder: boolean) => `
      - CMS/System: ${cms} ${isBuilder ? '(WARNUNG: Baukasten-System)' : '(Profi/Custom)'}
      - Semantic Score: ${stats.codeQuality.semanticScore}/100
      - Gefundene HTML5 Tags: ${stats.codeQuality.semanticTagsFound.join(', ') || 'Keine (Nur Divs?)'}
      - DOM Elemente (Code-Größe): ${stats.codeQuality.domDepth} (Weniger ist meist besser)
    `;

    const basePrompt = `
      Du bist ein knallharter Code-Auditor und SEO-Experte.
      URL: ${normalizedUrl}
      
      CODE QUALITÄTS-CHECK (FAKTEN):
      ${formatQuality(targetData.techStats, targetData.cmsData.cms, targetData.cmsData.isBuilder)}
      
      INHALT:
      ${targetData.content.substring(0, 1000)}...
    `;

    const singlePrompt = `
      ${basePrompt}
      
      AUFGABE:
      Bewerte die technische Professionalität der Seite.
      
      REGELN ZUR BEWERTUNG:
      1. Semantisches Markup (header, main, article...) = EXZELLENT/PROFI.
      2. Nur Div-Tags / niedriger Score = SCHLECHT (Div-Suppe).
      3. Baukästen (Wix, Jimdo, Squarespace) = "Hobby-Niveau / Eingeschränkt".
      4. Custom Code / Next.js / Sauberes WP = "Professionell".

      FORMAT: NUR HTML. Style: ${compactStyles}
      
      STRUKTUR:
      1. <div class="${STYLES.card}">
         <h3 class="${STYLES.h3}"><i class="bi bi-code-slash"></i> Code & System Qualität</h3>
         
         <div class="mb-3 pb-3 border-b">
           <div class="flex justify-between items-center">
             <span class="font-bold text-lg">${targetData.cmsData.cms}</span>
             ${targetData.cmsData.isBuilder 
                ? '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">⚠️ Baukasten</span>' 
                : '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">✅ Profi-Stack</span>'}
           </div>
           <p class="text-xs text-gray-500 mt-1">
             ${targetData.cmsData.isBuilder 
               ? 'Geeignet für Hobby/MVP. Für High-End SEO oft limitierend.' 
               : 'Solide technische Basis für Skalierung.'}
           </p>
         </div>

         <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <strong>Semantik:</strong><br>
              ${targetData.techStats.codeQuality.semanticScore > 50 ? '✅ Sauber (HTML5)' : '❌ Div-Suppe'}
            </div>
            <div>
              <strong>Struktur:</strong><br>
              ${targetData.techStats.codeQuality.semanticTagsFound.length > 3 ? '✅ Gut gegliedert' : '⚠️ Unstrukturiert'}
            </div>
         </div>
         <div class="mt-2 text-xs text-gray-400">
           Gefundene Tags: ${targetData.techStats.codeQuality.semanticTagsFound.join(', ') || 'Keine semantischen Tags'}
         </div>
      </div>

      2. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-diagram-3"></i> Seitenstruktur</h3>
         <p class="text-sm">Interne Links gefunden: <strong>${targetData.techStats.linkStructure.internalCount}</strong></p>
         <p class="text-xs text-gray-500 mt-1">Ein Indikator für die Tiefe der Website.</p>
      </div>

      3. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-shield-check"></i> Experten-Fazit</h3>
         Formuliere ein hartes Urteil: Ist das eine professionelle Unternehmensseite oder eine Bastel-Lösung?
      </div>
      
      Antworte NUR mit HTML.
    `;

    const comparePrompt = `
      ${basePrompt}
      WETTBEWERBER (${competitorUrl}):
      ${competitorData ? formatQuality(competitorData.techStats, competitorData.cmsData.cms, competitorData.cmsData.isBuilder) : ''}
      
      AUFGABE:
      Vergleiche die Code-Qualität. Wer ist professioneller aufgestellt?
      
      FORMAT: NUR HTML. ${compactStyles}

      STRUKTUR:
      1. <div class="${STYLES.grid2} gap-4 mb-4">
           <div class="${STYLES.card}">
             <h4 class="${STYLES.h4}">Meine Technik</h4>
             <div class="text-lg font-bold">${targetData.cmsData.cms}</div>
             <div class="text-sm ${targetData.cmsData.isBuilder ? 'text-red-500' : 'text-green-600'}">
               ${targetData.cmsData.isBuilder ? '⚠️ Baukasten' : '✅ Profi-Lösung'}
             </div>
             <div class="mt-2 text-xs">Semantik-Score: ${targetData.techStats.codeQuality.semanticScore}/100</div>
           </div>
           
           <div class="${STYLES.card} bg-indigo-50 border-indigo-100">
             <h4 class="${STYLES.h4}">Wettbewerber</h4>
             <div class="text-lg font-bold">${competitorData?.cmsData.cms}</div>
             <div class="text-sm ${competitorData?.cmsData.isBuilder ? 'text-red-500' : 'text-green-600'}">
               ${competitorData?.cmsData.isBuilder ? '⚠️ Baukasten' : '✅ Profi-Lösung'}
             </div>
             <div class="mt-2 text-xs">Semantik-Score: ${competitorData?.techStats.codeQuality.semanticScore}/100</div>
           </div>
         </div>

      2. <div class="${STYLES.card}">
           <h3 class="${STYLES.h3}"><i class="bi bi-trophy"></i> Qualitäts-Urteil</h3>
           <p>Erkläre, wessen technisches Fundament besser für Google ist (Semantik vs Div-Suppe, Custom vs Baukasten).</p>
      </div>

      3. <div class="${STYLES.card} mt-4">
           <h3 class="${STYLES.h3}"><i class="bi bi-magic"></i> Upgrade-Empfehlung</h3>
           Was muss technisch passieren, um den Gegner zu schlagen?
      </div>

      Antworte NUR mit HTML.
    `;

    const result = await streamTextSafe({
      prompt: isCompareMode ? comparePrompt : singlePrompt,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    console.error('Error:', error);
    return NextResponse.json({ message: 'Error', error: String(error) }, { status: 500 });
  }
}
