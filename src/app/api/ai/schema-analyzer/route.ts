// src/app/api/ai/schema-analyzer/route.ts
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES, getCompactStyleGuide } from '@/lib/ai-styles';
import { google, AI_CONFIG } from '@/lib/ai-config';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// HILFSFUNKTIONEN (vom Competitor-Spy kopiert und für die Analyse beibehalten)
// ============================================================================

// CMS-Erkennung (nur für Kontext)
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
  
  if (htmlLower.includes('vite')) hints.push('Vite');
  if ($('link[rel="manifest"]').length > 0) hints.push('PWA');
  if ($('main').length > 0) hints.push('Semantisches HTML');
  
  return { cms: 'Selbstprogrammiert', confidence: 'hoch', hints, isCustom: true };
}

// Tech-Stack (nur für Kontext)
function detectTechStack(html: string, $: cheerio.CheerioAPI): string[] {
  const stack: string[] = [];
  const htmlLower = html.toLowerCase();
  
  if (htmlLower.includes('react.js') || htmlLower.includes('react-dom') || $('[data-reactroot]').length > 0) {
      stack.push('React');
  }
  if (htmlLower.includes('angular.json') || htmlLower.includes('zone.js') || $('app-root').length > 0 || htmlLower.includes('ng-version=')) {
      stack.push('Angular');
  } else if (html.includes('ng-') || html.includes('*ngFor')) {
      if (!stack.includes('Angular')) stack.push('Angular');
  }
  if (html.includes('v-if=') || html.includes(':class=') || htmlLower.includes('/_nuxt/')) {
      stack.push('Vue.js');
  }
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

// ============================================================================
// HAUPTSCRAPER
// ============================================================================

async function scrapeUrl(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      'Accept': 'text/html',
      'Accept-Language': 'de-DE,de;q=0.9',
    },
    signal: AbortSignal.timeout(10000)
  });
  
  if (!res.ok) throw new Error(`Status ${res.status}`);
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';
  
  const cmsInfo = detectCMS(html, $);
  const techStack = detectTechStack(html, $);
  
  const existingSchemaJson: string[] = [];
  const existingSchemaTypes: string[] = [];
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
        const jsonText = $(el).html()?.trim();
        if (jsonText) {
            const jsonObject = JSON.parse(jsonText);
            existingSchemaJson.push(JSON.stringify(jsonObject, null, 2));
            const type = jsonObject['@type'] || (Array.isArray(jsonObject) && jsonObject.length > 0 ? jsonObject[0]['@type'] : 'Unbekannt');
            if (Array.isArray(jsonObject['@graph'])) {
              jsonObject['@graph'].forEach((item: any) => {
                if (item['@type'] && !existingSchemaTypes.includes(item['@type'])) {
                    existingSchemaTypes.push(item['@type']);
                }
              });
            } else if (type && !existingSchemaTypes.includes(type)) {
                existingSchemaTypes.push(type);
            }
        }
    } catch (e) {
        existingSchemaJson.push(`// FEHLER: Ungültiges JSON-LD: ${e instanceof Error ? e.message : 'Parsing-Fehler'}`);
    }
  });

  const h1 = $('h1').first().text().trim().slice(0, 60);
  const h2Elements: string[] = [];
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 80) h2Elements.push(text);
  });
  
  $('script, style, nav, footer, iframe, svg, noscript, head').remove();
  
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
    uniqueTexts,
    cmsInfo, 
    techStack,
    existingSchemaJson, 
    existingSchemaTypes,
    error: false,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ message: 'URL ist erforderlich.' }, { status: 400 });
    }

    const pageData = await scrapeUrl(url).catch(e => ({ 
      error: true,
      url: url, title: 'Fehler beim Scrapen', metaDesc: '', h1: '', 
      h2Elements: [], uniqueTexts: [], cmsInfo: { cms: 'Fehler', confidence: 'n/a', hints: [e.message], isCustom: false },
      techStack: [], 
      existingSchemaJson: [`// Scraping-Fehler: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`],
      existingSchemaTypes: ['Error'],
    }));

    if (pageData.error) {
         return NextResponse.json({ message: `Fehler: ${pageData.existingSchemaJson[0]}` }, { status: 500 });
    }

    const schemaAnalysisPrompt = `
Du bist ein SEO-Experte, der sich auf die Implementierung und Validierung von Schema.org-Markup spezialisiert hat.
Analysiere die bereitgestellten Seitendaten und die vorhandenen JSON-LD-Daten.

${getCompactStyleGuide()}

══════════════════════════════════════════════════════════════════════════════
SEITEN-DATEN (Kontext): ${pageData.url}
══════════════════════════════════════════════════════════════════════════════
• Titel: "${pageData.title}"
• H1: "${pageData.h1}"
• H2-Auszug: ${pageData.h2Elements.join(' | ') || '(keine)'}
• CMS: ${pageData.cmsInfo.cms}

TEXT-AUSZUG (Kontext für Content-Typ):
"${pageData.uniqueTexts.slice(0, 2).join(' ... ').slice(0, 400)}..."

VORHANDENE SCHEMA-TYPEN: ${pageData.existingSchemaTypes.join(', ') || '(keine)'}

══════════════════════════════════════════════════════════════════════════════
VORHANDENE JSON-LD DATEN (zur manuellen Prüfung, NICHT in den Report übernehmen):
══════════════════════════════════════════════════════════════════════════════
${pageData.existingSchemaJson.join('\n\n')}

══════════════════════════════════════════════════════════════════════════════
ERSTELLE DIESEN REPORT:
══════════════════════════════════════════════════════════════════════════════

1. <h3 class="${STYLES.h3}"><i class="bi bi-patch-check"></i> Analyse VORHANDENER Schemas</h3>
   <div class="${STYLES.infoBox}">
     <p class="${STYLES.p}">
       Bewerte die VORHANDENEN Schema-Markups. Sind sie relevant? Sind wichtige Felder korrekt gesetzt? 
       Liste nur die gefundenen Haupt-Typen (${pageData.existingSchemaTypes.join(', ') || 'Keine Schemas gefunden'}) und gib eine kurze Bewertung ab.
     </p>
   </div>

2. <h3 class="${STYLES.h3}"><i class="bi bi-lightbulb"></i> Vorschläge für FEHLENDE Schemas</h3>
   <div class="${STYLES.recommendBox}">
     <h4 class="font-semibold text-white mb-2"><i class="bi bi-plus-circle"></i> Top 3 Schema-Empfehlungen</h4>
     <ol class="space-y-2 text-sm text-indigo-100">
       [Formuliere 3 konkrete Vorschläge für Schema-Typen, die dem Content-Kontext FEHLEN und NICHT in der Liste VORHANDENER SCHEMA-TYPEN stehen.]
     </ol>
     <div class="${STYLES.warningBox} mt-3">
       <p class="${STYLES.pSmall} text-indigo-900"><i class="bi bi-code-slash"></i> <strong>Achtung:</strong> Die bestehenden Typen sollten NICHT dupliziert werden.</p>
     </div>
   </div>

3. <h3 class="${STYLES.h3}"><i class="bi bi-code"></i> Code-Beispiel</h3>
   <div class="${STYLES.card}">
     <h4 class="${STYLES.h4}">Beispielcode für den WICHTIGSTEN fehlenden Schema-Typ</h4>
     <p class="${STYLES.p}">Generiere einen vollständigen, gültigen JSON-LD Codeblock für den wichtigsten empfohlenen Schema-Typ. Der Code MUSS in einem 
     <pre class="language-json">...</pre> Block eingeschlossen sein.
     </p>
   </div>
   
Antworte NUR mit HTML. Ersetze alle [Platzhalter] mit echtem Content!
`;

    const result = streamText({
      model: google(AI_CONFIG.fallbackModel),
      prompt: schemaAnalysisPrompt,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ Schema Analyzer Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
