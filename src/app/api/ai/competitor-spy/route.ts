// src/app/api/ai/competitor-spy/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES, getCompactStyleGuide } from '@/lib/ai-styles';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// FUNKTIONEN - UNVERÄNDERT
// ============================================================================

// CMS-Erkennung mit Scoring
function detectCMS(html: string, $: cheerio.CheerioAPI): { cms: string; confidence: string; hints: string[]; isCustom: boolean } {
  const hints: string[] = [];
  const htmlLower = html.toLowerCase();
  const cmsScores: Record<string, number> = {};
  
  if (htmlLower.includes('wp-content')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 3;
  if (htmlLower.includes('wp-includes')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 3;
  if ($('meta[name="generator"][content*="WordPress"]').length > 0) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 5;
  if (htmlLower.includes('/wp-json/')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 2;
  
  if (htmlLower.includes('cdn.shopify.com')) cmsScores['Shopify'] = 5;
  if (htmlLower.includes('wix.com') || htmlLower.includes('wixsite.com')) cmsScores['Wix'] = 5;
  if (htmlLower.includes('squarespace.com')) cmsScores['Squarespace'] = 5;
  if (htmlLower.includes('webflow.com') || $('html[data-wf-site]').length > 0) cmsScores['Webflow'] = 5;
  if (htmlLower.includes('/typo3conf/')) cmsScores['TYPO3'] = 5;
  if (htmlLower.includes('/_next/') || $('div#__next').length > 0) cmsScores['Next.js'] = 4;
  if (htmlLower.includes('/_nuxt/')) cmsScores['Nuxt.js'] = 4;
  
  const generator = $('meta[name="generator"]').attr('content');
  if (generator) hints.push(`Generator: ${generator}`);
  
  const sortedCMS = Object.entries(cmsScores).sort((a, b) => b[1] - a[1]);
  
  if (sortedCMS.length > 0 && sortedCMS[0][1] >= 4) {
    const detectedCMS = sortedCMS[0][0];
    if (detectedCMS === 'WordPress') {
      const themeMatch = html.match(/wp-content\/themes\/([^\/'"]+)/);
      if (themeMatch) hints.push(`Theme: ${themeMatch[1]}`);
      const pluginMatches = html.match(/wp-content\/plugins\/([^\/'"]+)/g);
      if (pluginMatches) {
        const uniquePlugins = [...new Set(pluginMatches.map(p => p.replace('wp-content/plugins/', '')))].slice(0, 4);
        hints.push(`Plugins: ${uniquePlugins.join(', ')}`);
      }
    }
    return { cms: detectedCMS, confidence: sortedCMS[0][1] >= 6 ? 'hoch' : 'mittel', hints, isCustom: false };
  }
  
  // Custom erkennen
  if (htmlLower.includes('vite')) hints.push('Vite');
  if ($('link[rel="manifest"]').length > 0) hints.push('PWA');
  if ($('main').length > 0) hints.push('Semantisches HTML');
  
  return { cms: 'Selbstprogrammiert', confidence: 'hoch', hints, isCustom: true };
}

// Tech-Stack
function detectTechStack(html: string): string[] {
  const stack: string[] = [];
  const htmlLower = html.toLowerCase();
  
  if (htmlLower.includes('react')) stack.push('React');
  if (html.includes('v-if=') || html.includes(':class=')) stack.push('Vue.js');
  if (html.includes('ng-') || html.includes('*ngFor')) stack.push('Angular');
  if (html.includes('x-data=')) stack.push('Alpine.js');
  if (htmlLower.includes('bootstrap')) stack.push('Bootstrap');
  if (html.match(/class="[^"]*\b(flex |grid |p-\d|m-\d|text-sm|bg-|rounded-)/)) stack.push('Tailwind CSS');
  if (htmlLower.includes('gtag(') || htmlLower.includes('google-analytics')) stack.push('Google Analytics');
  if (htmlLower.includes('googletagmanager.com')) stack.push('Google Tag Manager');
  if (htmlLower.includes('cloudflare')) stack.push('Cloudflare');
  if (htmlLower.includes('jquery')) stack.push('jQuery');
  if (htmlLower.includes('gsap')) stack.push('GSAP Animation');
  
  return [...new Set(stack)];
}

// Features
function detectFeatures(html: string, $: cheerio.CheerioAPI): string[] {
  const features: string[] = [];
  const htmlLower = html.toLowerCase();
  
  if (htmlLower.includes('chatbot') || htmlLower.includes('ai-assistant') || htmlLower.includes('ki-assistent') ||
      htmlLower.includes('openai') || htmlLower.includes('gpt') || htmlLower.includes('gemini') || // <- NEU: GEMINI
      $('[class*="chat"]').length > 2) {
    features.push('KI-Assistent / Chatbot');
  }
  if (htmlLower.includes('livechat') || htmlLower.includes('tawk.to') || htmlLower.includes('intercom')) {
    features.push('Live-Chat');
  }
  if ($('video').length > 0 || htmlLower.includes('youtube.com/embed')) {
    features.push('Video-Content');
  }
  if (htmlLower.includes('gsap') || htmlLower.includes('lottie') || html.includes('data-aos=')) {
    features.push('Animationen');
  }
  if (html.includes('dark:') || htmlLower.includes('dark-mode')) {
    features.push('Dark Mode');
  }
  if ($('link[rel="manifest"]').length > 0) {
    features.push('PWA-fähig');
  }
  
  // E-Commerce: Präzisere Erkennung, um False Positives in Theme-Konfigurationen zu vermeiden
  const hasEcommerceKeywords = htmlLower.includes('woocommerce') ||
                               htmlLower.includes('warenkorb') ||
                               htmlLower.includes('checkout') ||
                               htmlLower.includes('kasse');
                               
  const hasEcommerceElements = $('[class*="woocommerce"], [class*="shop-item"], [id*="cart"], [href*="add-to-cart"]').length > 0;
  
  if (hasEcommerceKeywords || hasEcommerceElements) {
    features.push('E-Commerce');
  }

  if (htmlLower.includes('calendly') || htmlLower.includes('booking') || htmlLower.includes('termin')) {
    features.push('Terminbuchung');
  }
  if (htmlLower.includes('newsletter') || htmlLower.includes('mailchimp')) {
    features.push('Newsletter');
  }
  if ($('script[type="application/ld+json"]').length > 0) {
    features.push('Schema.org Daten');
  }
  if (htmlLower.includes('testimonial') || htmlLower.includes('bewertung') || htmlLower.includes('referenz')) {
    features.push('Testimonials/Referenzen');
  }
  if ($('link[hreflang]').length > 1) {
    features.push('Mehrsprachig');
  }
  if (htmlLower.includes('/blog') || htmlLower.includes('artikel')) {
    features.push('Blog');
  }
  if (htmlLower.includes('faq')) {
    features.push('FAQ');
  }
  if (htmlLower.includes('kontakt') || htmlLower.includes('contact')) {
    features.push('Kontaktseite');
  }
  
  return features;
}
// Hauptmenü-Links extrahieren
function extractMainNavLinks(html: string, $: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: string[] = [];
  const baseUrlObj = new URL(baseUrl);
  const baseDomain = baseUrlObj.origin;
  
  const navSelectors = [
    'nav a',
    'header a',
    '[class*="nav"] a',
    '[class*="menu"] a',
    '[id*="nav"] a',
    '[id*="menu"] a'
  ];
  
  navSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      let href = $(el).attr('href');
      if (!href) return;
      
      if (href.startsWith('/')) {
        href = baseDomain + href;
      } else if (!href.startsWith('http')) {
        href = baseDomain + '/' + href;
      }
      
      if (
        href.startsWith(baseDomain) &&
        !href.includes('#') &&
        !href.match(/\.(pdf|jpg|png|gif|zip|doc)$/i) &&
        href !== baseUrl &&
        href !== baseDomain + '/' &&
        !links.includes(href)
      ) {
        links.push(href);
      }
    });
  });
  
  return links.slice(0, 5);
}

// Unterseite scrapen
async function scrapeSubpage(url: string): Promise<{ url: string; title: string; h1: string; wordCount: number }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (!res.ok) return { url, title: 'Fehler', h1: '', wordCount: 0 };
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const title = $('title').text().trim().slice(0, 60);
    const h1 = $('h1').first().text().trim().slice(0, 60);
    
    $('script, style, nav, footer, head').remove();
    const wordCount = $('body').text().replace(/\s+/g, ' ').trim().split(/\s+/).length;
    
    const path = new URL(url).pathname;
    
    return { url: path, title, h1, wordCount };
  } catch {
    return { url, title: 'Timeout', h1: '', wordCount: 0 };
  }
}

// Hauptseite scrapen
async function scrapeUrl(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      'Accept': 'text/html',
      'Accept-Language': 'de-DE,de;q=0.9',
    }
  });
  
  if (!res.ok) throw new Error(`Status ${res.status}`);
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';
  
  const cmsInfo = detectCMS(html, $);
  const techStack = detectTechStack(html);
  const features = detectFeatures(html, $); // Die aktualisierte Funktion wird verwendet
  
  const navLinks = extractMainNavLinks(html, $, url);
  const subpagePromises = navLinks.map(link => scrapeSubpage(link));
  const subpages = await Promise.all(subpagePromises);
  
  // NEUE TECHNISCHE METRIKEN
  const htmlSizeKB = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(2); // Größe des HTML in KB
  const usesWebP = html.toLowerCase().includes('.webp'); // WebP-Format-Erkennung
  
  $('script, style, nav, footer, iframe, svg, noscript, head').remove();
  
  const h1 = $('h1').first().text().trim();
  const h2Elements: string[] = [];
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 80) h2Elements.push(text);
  });
  
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = text.split(/\s+/).filter(w => w.length > 1).length;
  
  const uniqueTexts: string[] = [];
  $('p').each((i, el) => {
    if (i < 4) {
      const pText = $(el).text().trim();
      if (pText.length > 40 && pText.length < 400) uniqueTexts.push(pText);
    }
  });
  
  return { 
    url, title, metaDesc, h1, 
    h2Elements: h2Elements.slice(0, 6),
    h2Count: h2Elements.length,
    text: text.slice(0, 6000),
    wordCount, uniqueTexts,
    cms: cmsInfo, techStack, features,
    subpages: subpages.filter(s => s.wordCount > 0),
    // NEUE WERTE IM RETURN
    htmlSizeKB,
    usesWebP
  };
}

// ============================================================================
// MAIN HANDLER - Unterstützt Single-URL und Vergleichs-Modus
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const { myUrl, competitorUrl } = await req.json();

    // Mindestens eine URL erforderlich
    if (!myUrl) {
      return NextResponse.json({ message: 'Mindestens eine URL ist erforderlich.' }, { status: 400 });
    }

    // Modus bestimmen: Single oder Compare
    const isCompareMode = !!competitorUrl;

    // Daten scrapen
    const myData = await scrapeUrl(myUrl).catch(e => ({ 
      error: true, url: myUrl, title: 'Fehler', metaDesc: '', h1: '', h2Elements: [], h2Count: 0,
      text: '', wordCount: 0, uniqueTexts: [],
      cms: { cms: 'Fehler', confidence: 'n/a', hints: [e.message], isCustom: false },
      techStack: [], features: [], subpages: []
    }));

    let competitorData = null;
    if (isCompareMode) {
      competitorData = await scrapeUrl(competitorUrl).catch(e => ({ 
        error: true, url: competitorUrl, title: 'Fehler', metaDesc: '', h1: '', h2Elements: [], h2Count: 0,
        text: '', wordCount: 0, uniqueTexts: [],
        cms: { cms: 'Fehler', confidence: 'n/a', hints: [e.message], isCustom: false },
        techStack: [], features: [], subpages: []
      }));
    }

    // ========================================================================
    // PROMPT - SINGLE MODE (nur eine URL)
    // ========================================================================
    const singlePrompt = `
Du bist ein SEO-Experte. Analysiere diese Webseite detailliert.

${getCompactStyleGuide()}

══════════════════════════════════════════════════════════════════════════════
WEBSEITEN-ANALYSE: ${myData.url}
══════════════════════════════════════════════════════════════════════════════

META:
• Title: "${myData.title}"
• Meta-Beschreibung: "${myData.metaDesc || '(keine)'}"
• H1: "${myData.h1}"
• H2 (${myData.h2Count}): ${myData.h2Elements.join(' | ') || '(keine)'}
• Wörter: ~${myData.wordCount}

TECHNIK:
• CMS: ${myData.cms.cms} ${myData.cms.isCustom ? '(Custom)' : ''}
• Details: ${myData.cms.hints.join(', ') || '-'}
• Tech: ${myData.techStack.join(', ') || '-'}
• HTML Größe: ${myData.htmlSizeKB} KB // <- NEU
• Bilder: ${myData.usesWebP ? 'WebP erkannt' : 'WebP nicht erkannt'} // <- NEU

FEATURES: ${myData.features.join(', ') || 'keine erkannt'}

UNTERSEITEN (Menü):
${myData.subpages.length > 0 ? myData.subpages.map(s => `• ${s.url} - "${s.title}" (~${s.wordCount} Wörter)`).join('\n') : '(keine gescraped)'}

TEXT-AUSZUG:
"${myData.uniqueTexts.slice(0, 2).join(' ... ').slice(0, 400)}..."

══════════════════════════════════════════════════════════════════════════════
ERSTELLE DIESEN REPORT:
══════════════════════════════════════════════════════════════════════════════

1. <h3 class="${STYLES.h3}"><i class="bi bi-info-circle"></i> Übersicht</h3>
   <div class="${STYLES.infoBox}">
     <p class="${STYLES.p}">Kurze Beschreibung: Was ist diese Webseite? Welche Branche/Zielgruppe?</p>
   </div>

2. <h3 class="${STYLES.h3}"><i class="bi bi-gear-fill"></i> Technologie</h3>
   <div class="${STYLES.card}">
     <div class="flex items-center gap-2 mb-3">
       ${myData.cms.isCustom 
         ? `<span class="${STYLES.badgeCustom}"><i class="bi bi-star-fill"></i> Custom</span>` 
         : `<span class="${STYLES.badgePurple}">${myData.cms.cms}</span>`}
       ${myData.techStack.map(t => `<span class="${STYLES.badgeNeutral}">${t}</span>`).join(' ')}
     </div>
     <p class="${STYLES.p}">Bewertung der technischen Umsetzung (2-3 Sätze)</p>
   </div>

3. <h3 class="${STYLES.h3}"><i class="bi bi-stars"></i> Features</h3>
   <div class="${STYLES.card}">
     <ul class="${STYLES.list}">
       ${myData.features.length > 0 
         ? '[Liste alle erkannten Features mit <li class="' + STYLES.listItem + '"><i class="bi bi-star-fill ' + STYLES.iconFeature + '"></i><span>Feature</span></li>]'
         : '<li class="' + STYLES.listItem + '"><i class="bi bi-dash ' + STYLES.iconNeutral + '"></i><span>Keine besonderen Features erkannt</span></li>'}
     </ul>
     <div class="${STYLES.warningBox} mt-3">
       <p class="${STYLES.pSmall}"><i class="bi bi-lightbulb"></i> <strong>Fehlende Features:</strong> Was könnte ergänzt werden?</p>
     </div>
   </div>

4. <h3 class="${STYLES.h3}"><i class="bi bi-diagram-3-fill"></i> Seitenstruktur</h3>
   <div class="${STYLES.card}">
     <h4 class="${STYLES.h4}">Menü-Struktur</h4>
     ${myData.subpages.length > 0 
       ? myData.subpages.map(s => `<div class="${STYLES.subpageItem}"><i class="bi bi-file-earmark ${STYLES.iconIndigo}"></i> ${s.url} <span class="${STYLES.textMuted}">(~${s.wordCount} Wörter)</span></div>`).join('\n')
       : `<p class="${STYLES.pSmall}">Keine Unterseiten im Menü gefunden</p>`}
     <p class="${STYLES.p} mt-3">Bewertung der Seitenstruktur und Navigation</p>
   </div>

5. <h3 class="${STYLES.h3}"><i class="bi bi-clipboard-check"></i> SEO-Check</h3>
   <div class="${STYLES.grid2}">
     <div class="${STYLES.successBox}">
       <h4 class="${STYLES.h4} text-emerald-700"><i class="bi bi-check-circle"></i> Stärken</h4>
       <ul class="${STYLES.list}">
         [3-4 Stärken als <li class="${STYLES.listItem}"><i class="bi bi-check-lg ${STYLES.iconSuccess}"></i><span>Stärke</span></li>]
       </ul>
     </div>
     <div class="${STYLES.errorBox}">
       <h4 class="${STYLES.h4} text-rose-700"><i class="bi bi-exclamation-circle"></i> Schwächen</h4>
       <ul class="${STYLES.list}">
         [3-4 Schwächen als <li class="${STYLES.listItem}"><i class="bi bi-x-lg ${STYLES.iconError}"></i><span>Schwäche</span></li>]
       </ul>
     </div>
   </div>

6. <h3 class="${STYLES.h3}"><i class="bi bi-bullseye"></i> Empfehlungen</h3>
   <div class="${STYLES.recommendBox}">
     <h4 class="font-semibold text-white mb-2"><i class="bi bi-rocket-takeoff"></i> Top 3 Maßnahmen</h4>
     <ol class="space-y-2 text-sm text-indigo-100">
       [3 priorisierte, konkrete Maßnahmen als <li>1. Maßnahme</li>]
     </ol>
   </div>

7. <h3 class="${STYLES.h3}"><i class="bi bi-speedometer2"></i> Gesamtbewertung</h3>
   <div class="${STYLES.card}">
     <div class="flex items-center gap-4 mb-3">
       <div class="text-center">
         <div class="text-3xl font-bold text-indigo-600">[X]/10</div>
         <div class="${STYLES.metricLabel}">Score</div>
       </div>
       <div class="${STYLES.p}">Zusammenfassende Bewertung in 2-3 Sätzen</div>
     </div>
   </div>

Antworte NUR mit HTML. Ersetze alle [Platzhalter] mit echtem Content!
`;

    // ========================================================================
    // PROMPT - COMPARE MODE (zwei URLs)
    // ========================================================================
    const comparePrompt = `
Du bist ein SEO-Stratege. Analysiere zwei Webseiten FAIR und OBJEKTIV.

${getCompactStyleGuide()}

══════════════════════════════════════════════════════════════════════════════
SEITE A: ${myData.url}
══════════════════════════════════════════════════════════════════════════════

META:
• Title: "${myData.title}"
• Meta-Beschreibung: "${myData.metaDesc || '(keine)'}"
• H1: "${myData.h1}"
• H2 (${myData.h2Count}): ${myData.h2Elements.join(' | ') || '(keine)'}
• Wörter: ~${myData.wordCount}

CMS: ${myData.cms.cms} ${myData.cms.isCustom ? '(Custom)' : ''}
• Details: ${myData.cms.hints.join(', ') || '-'}
• Tech: ${myData.techStack.join(', ') || '-'}
• HTML Größe: ${myData.htmlSizeKB} KB // <- NEU
• Bilder: ${myData.usesWebP ? 'WebP erkannt' : 'WebP nicht erkannt'} // <- NEU
FEATURES: ${myData.features.join(', ') || 'keine erkannt'}

UNTERSEITEN (Menü):
${myData.subpages.length > 0 ? myData.subpages.map(s => `• ${s.url} - "${s.title}" (~${s.wordCount} Wörter)`).join('\n') : '(keine gescraped)'}

TEXT-AUSZUG:
"${myData.uniqueTexts.slice(0, 2).join(' ... ').slice(0, 400)}..."

══════════════════════════════════════════════════════════════════════════════
SEITE B: ${competitorData?.url}
══════════════════════════════════════════════════════════════════════════════

META:
• Title: "${competitorData?.title}"
• Meta-Beschreibung: "${competitorData?.metaDesc || '(keine)'}"
• H1: "${competitorData?.h1}"
• H2 (${competitorData?.h2Count}): ${competitorData?.h2Elements.join(' | ') || '(keine)'}
• Wörter: ~${competitorData?.wordCount}

TECHNIK:
TECHNIK:
• CMS: ${competitorData?.cms.cms} ${competitorData?.cms.isCustom ? '(Custom)' : ''}
• Details: ${competitorData?.cms.hints.join(', ') || '-'}
• Tech: ${competitorData?.techStack.join(', ') || '-'}
• HTML Größe: ${competitorData?.htmlSizeKB} KB // <- NEU
• Bilder: ${competitorData?.usesWebP ? 'WebP erkannt' : 'WebP nicht erkannt'} // <- NEU
FEATURES: ${competitorData?.features.join(', ') || 'keine erkannt'}

UNTERSEITEN (Menü):
${competitorData?.subpages && competitorData.subpages.length > 0 ? competitorData.subpages.map(s => `• ${s.url} - "${s.title}" (~${s.wordCount} Wörter)`).join('\n') : '(keine gescraped)'}

TEXT-AUSZUG:
"${competitorData?.uniqueTexts.slice(0, 2).join(' ... ').slice(0, 400)}..."

══════════════════════════════════════════════════════════════════════════════
ERSTELLE DIESEN REPORT:
══════════════════════════════════════════════════════════════════════════════

1. <h3 class="${STYLES.h3}"><i class="bi bi-info-circle"></i> Übersicht</h3>
   <div class="${STYLES.infoBox}">Info-Box mit EINER Zeile pro Seite. Was ist die Seite?</div>

2. <h3 class="${STYLES.h3}"><i class="bi bi-gear-fill"></i> Technologie</h3>
   <div class="${STYLES.grid2}">
     Pro Seite eine Card mit:
     - CMS Badge (Custom = <span class="${STYLES.badgeCustom}"><i class="bi bi-star-fill"></i> CUSTOM</span>)
     - Tech-Stack
     - 2-3 Sätze Bewertung
   </div>

3. <h3 class="${STYLES.h3}"><i class="bi bi-stars"></i> Features</h3>
   <div class="${STYLES.grid2}">
     Pro Seite eine Card mit:
     - Liste aller Features (<i class="bi bi-star-fill ${STYLES.iconFeature}"></i>)
     - Was fehlt?
   </div>

4. <h3 class="${STYLES.h3}"><i class="bi bi-diagram-3-fill"></i> Seitenstruktur</h3>
   <div class="${STYLES.grid2}">
     Pro Seite eine Card mit:
     - Unterseiten (<div class="${STYLES.subpageItem}"><i class="bi bi-file-earmark"></i> /pfad</div>)
     - Bewertung
   </div>

5. <h3 class="${STYLES.h3}"><i class="bi bi-shield-fill-check"></i> Stärken & Schwächen</h3>
   <div class="${STYLES.grid2}">
     Pro Seite eine Card mit:
     - Stärken: <li class="${STYLES.listItem}"><i class="bi bi-check-lg ${STYLES.iconSuccess}"></i><span>Text</span></li>
     - Schwächen: <li class="${STYLES.listItem}"><i class="bi bi-x-lg ${STYLES.iconError}"></i><span>Text</span></li>
   </div>

6. <h3 class="${STYLES.h3}"><i class="bi bi-bullseye"></i> Empfehlungen</h3>
   <div class="${STYLES.recommendBox}">
     3 konkrete Maßnahmen für Seite A basierend auf dem Vergleich
   </div>

Antworte NUR mit HTML. Kompakt!
`;

    // Richtigen Prompt wählen
    const prompt = isCompareMode ? comparePrompt : singlePrompt;

    const result = streamText({
      model: google('gemini-2.5-flash'),
      prompt: prompt,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ Competitor Spy Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
