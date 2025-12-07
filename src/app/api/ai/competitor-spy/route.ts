// src/app/api/ai/competitor-spy/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export const runtime = 'nodejs';
export const maxDuration = 60;

// CMS-Erkennung anhand von HTML-Signaturen
function detectCMS(html: string, $: cheerio.CheerioAPI): { cms: string; confidence: string; hints: string[] } {
  const hints: string[] = [];
  const htmlLower = html.toLowerCase();
  
  // WordPress
  if (
    htmlLower.includes('wp-content') ||
    htmlLower.includes('wp-includes') ||
    $('meta[name="generator"][content*="WordPress"]').length > 0 ||
    htmlLower.includes('wordpress')
  ) {
    hints.push('wp-content/wp-includes Pfade gefunden');
    if ($('meta[name="generator"][content*="WordPress"]').length > 0) {
      hints.push('WordPress Generator Meta-Tag');
    }
    
    // Theme erkennen
    const themeMatch = html.match(/wp-content\/themes\/([^\/'"]+)/);
    if (themeMatch) {
      hints.push(`Theme: ${themeMatch[1]}`);
    }
    
    // Plugins erkennen
    const pluginMatches = html.match(/wp-content\/plugins\/([^\/'"]+)/g);
    if (pluginMatches) {
      const uniquePlugins = [...new Set(pluginMatches.map(p => p.replace('wp-content/plugins/', '')))].slice(0, 5);
      hints.push(`Plugins: ${uniquePlugins.join(', ')}`);
    }
    
    return { cms: 'WordPress', confidence: 'hoch', hints };
  }
  
  // Shopify
  if (
    htmlLower.includes('cdn.shopify.com') ||
    htmlLower.includes('shopify') ||
    $('meta[name="shopify-checkout-api-token"]').length > 0
  ) {
    hints.push('Shopify CDN oder Meta-Tags erkannt');
    return { cms: 'Shopify', confidence: 'hoch', hints };
  }
  
  // Wix
  if (
    htmlLower.includes('wix.com') ||
    htmlLower.includes('wixsite.com') ||
    htmlLower.includes('_wix_browser_sess')
  ) {
    hints.push('Wix-spezifische URLs/Cookies erkannt');
    return { cms: 'Wix', confidence: 'hoch', hints };
  }
  
  // Squarespace
  if (
    htmlLower.includes('squarespace.com') ||
    htmlLower.includes('static1.squarespace.com') ||
    $('meta[name="generator"][content*="Squarespace"]').length > 0
  ) {
    hints.push('Squarespace Assets erkannt');
    return { cms: 'Squarespace', confidence: 'hoch', hints };
  }
  
  // Webflow
  if (
    htmlLower.includes('webflow.com') ||
    htmlLower.includes('assets.website-files.com') ||
    $('html[data-wf-site]').length > 0
  ) {
    hints.push('Webflow Attribute/Assets erkannt');
    return { cms: 'Webflow', confidence: 'hoch', hints };
  }
  
  // Joomla
  if (
    htmlLower.includes('/media/jui/') ||
    htmlLower.includes('/components/com_') ||
    $('meta[name="generator"][content*="Joomla"]').length > 0
  ) {
    hints.push('Joomla-spezifische Pfade erkannt');
    return { cms: 'Joomla', confidence: 'hoch', hints };
  }
  
  // Drupal
  if (
    htmlLower.includes('drupal') ||
    htmlLower.includes('/sites/default/files/') ||
    $('meta[name="generator"][content*="Drupal"]').length > 0
  ) {
    hints.push('Drupal-spezifische Struktur erkannt');
    return { cms: 'Drupal', confidence: 'hoch', hints };
  }
  
  // TYPO3
  if (
    htmlLower.includes('typo3') ||
    htmlLower.includes('/typo3conf/') ||
    $('meta[name="generator"][content*="TYPO3"]').length > 0
  ) {
    hints.push('TYPO3-spezifische Pfade erkannt');
    return { cms: 'TYPO3', confidence: 'hoch', hints };
  }
  
  // Contao
  if (
    htmlLower.includes('contao') ||
    htmlLower.includes('/assets/contao/')
  ) {
    hints.push('Contao-Assets erkannt');
    return { cms: 'Contao', confidence: 'mittel', hints };
  }
  
  // Ghost
  if (
    htmlLower.includes('ghost.io') ||
    $('meta[name="generator"][content*="Ghost"]').length > 0
  ) {
    hints.push('Ghost-Generator erkannt');
    return { cms: 'Ghost', confidence: 'hoch', hints };
  }
  
  // HubSpot
  if (
    htmlLower.includes('hubspot') ||
    htmlLower.includes('hs-scripts.com') ||
    htmlLower.includes('hbspt')
  ) {
    hints.push('HubSpot Scripts erkannt');
    return { cms: 'HubSpot CMS', confidence: 'hoch', hints };
  }
  
  // Next.js
  if (
    htmlLower.includes('/_next/') ||
    htmlLower.includes('__next') ||
    $('div#__next').length > 0
  ) {
    hints.push('Next.js App-Struktur erkannt');
    return { cms: 'Next.js (React)', confidence: 'hoch', hints };
  }
  
  // Nuxt.js
  if (
    htmlLower.includes('/_nuxt/') ||
    htmlLower.includes('__nuxt')
  ) {
    hints.push('Nuxt.js Assets erkannt');
    return { cms: 'Nuxt.js (Vue)', confidence: 'hoch', hints };
  }
  
  // Laravel
  if (
    htmlLower.includes('laravel') ||
    html.includes('csrf-token')
  ) {
    hints.push('Laravel CSRF-Token gefunden');
    return { cms: 'Laravel (PHP)', confidence: 'mittel', hints };
  }
  
  // Prüfe Generator Meta-Tag generisch
  const generator = $('meta[name="generator"]').attr('content');
  if (generator) {
    hints.push(`Generator: ${generator}`);
    return { cms: generator, confidence: 'mittel', hints };
  }
  
  // Fallback
  hints.push('Keine eindeutigen CMS-Signaturen gefunden');
  return { cms: 'Nicht erkannt (Custom/Static)', confidence: 'niedrig', hints };
}

// Technologie-Stack erkennen
function detectTechStack(html: string, $: cheerio.CheerioAPI): string[] {
  const stack: string[] = [];
  const htmlLower = html.toLowerCase();
  
  // JavaScript Frameworks
  if (htmlLower.includes('react') || htmlLower.includes('_jsx')) stack.push('React');
  if (htmlLower.includes('vue') || htmlLower.includes('v-if') || htmlLower.includes('v-for')) stack.push('Vue.js');
  if (htmlLower.includes('angular') || htmlLower.includes('ng-')) stack.push('Angular');
  if (htmlLower.includes('svelte')) stack.push('Svelte');
  
  // CSS Frameworks
  if (htmlLower.includes('bootstrap')) stack.push('Bootstrap');
  if (htmlLower.includes('tailwind') || html.match(/class="[^"]*\b(flex|grid|p-\d|m-\d|text-)/)) stack.push('Tailwind CSS');
  if (htmlLower.includes('bulma')) stack.push('Bulma');
  if (htmlLower.includes('foundation')) stack.push('Foundation');
  
  // Analytics & Tracking
  if (htmlLower.includes('google-analytics') || htmlLower.includes('gtag') || htmlLower.includes('ga.js')) stack.push('Google Analytics');
  if (htmlLower.includes('gtm.js') || htmlLower.includes('googletagmanager')) stack.push('Google Tag Manager');
  if (htmlLower.includes('facebook.net/en_US/fbevents')) stack.push('Facebook Pixel');
  if (htmlLower.includes('hotjar')) stack.push('Hotjar');
  if (htmlLower.includes('clarity.ms')) stack.push('Microsoft Clarity');
  
  // CDNs
  if (htmlLower.includes('cloudflare')) stack.push('Cloudflare');
  if (htmlLower.includes('jsdelivr')) stack.push('jsDelivr CDN');
  if (htmlLower.includes('unpkg.com')) stack.push('unpkg CDN');
  
  // Andere Tools
  if (htmlLower.includes('jquery')) stack.push('jQuery');
  if (htmlLower.includes('recaptcha')) stack.push('reCAPTCHA');
  if (htmlLower.includes('cookiebot') || htmlLower.includes('cookie-consent')) stack.push('Cookie Consent Tool');
  if (htmlLower.includes('mailchimp')) stack.push('Mailchimp');
  if (htmlLower.includes('intercom')) stack.push('Intercom');
  if (htmlLower.includes('zendesk')) stack.push('Zendesk');
  if (htmlLower.includes('crisp.chat')) stack.push('Crisp Chat');
  
  return [...new Set(stack)]; // Duplikate entfernen
}

// Hilfsfunktion zum Scrapen
async function scrapeUrl(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  
  if (!res.ok) throw new Error(`Status ${res.status}`);
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // CMS & Tech erkennen BEVOR wir Tags entfernen
  const cmsInfo = detectCMS(html, $);
  const techStack = detectTechStack(html, $);
  
  // Jetzt aufräumen für Content-Analyse
  $('script, style, nav, footer, iframe, svg, noscript, head').remove();
  
  const title = $('title').text().trim() || $('h1').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const h1 = $('h1').first().text().trim();
  const h2Count = $('h2').length;
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);
  const wordCount = text.split(/\s+/).length;
  
  return { 
    url, 
    title, 
    metaDesc,
    h1,
    h2Count,
    text, 
    wordCount,
    cms: cmsInfo,
    techStack
  };
}

export async function POST(req: NextRequest) {
  try {
    const { myUrl, competitorUrl } = await req.json();

    if (!myUrl || !competitorUrl) {
      return NextResponse.json({ message: 'Beide URLs sind erforderlich.' }, { status: 400 });
    }

    // 1. Scraping
    const [myData, competitorData] = await Promise.all([
      scrapeUrl(myUrl).catch(e => ({ 
        error: true, 
        msg: e.message, 
        url: myUrl, 
        title: 'Fehler beim Laden', 
        metaDesc: '',
        h1: '',
        h2Count: 0,
        text: '',
        wordCount: 0,
        cms: { cms: 'Fehler', confidence: 'n/a', hints: [e.message] },
        techStack: []
      })),
      scrapeUrl(competitorUrl).catch(e => ({ 
        error: true, 
        msg: e.message, 
        url: competitorUrl, 
        title: 'Fehler beim Laden',
        metaDesc: '',
        h1: '',
        h2Count: 0,
        text: '',
        wordCount: 0,
        cms: { cms: 'Fehler', confidence: 'n/a', hints: [e.message] },
        techStack: []
      }))
    ]);

    // 2. Prompt (HTML & TAILWIND STRIKT)
    const prompt = `
      Du bist ein knallharter SEO-Stratege und Technik-Analyst. Vergleiche zwei Webseiten.

      === SEITE A (Meine Seite) ===
      URL: ${myData.url}
      Titel: ${myData.title}
      Meta-Beschreibung: ${myData.metaDesc || '(keine)'}
      H1: ${myData.h1 || '(keine)'}
      H2-Überschriften: ${myData.h2Count}
      Wortanzahl: ~${myData.wordCount}
      
      🔧 TECHNIK:
      CMS: ${myData.cms.cms} (Konfidenz: ${myData.cms.confidence})
      Hinweise: ${myData.cms.hints.join(', ')}
      Tech-Stack: ${myData.techStack.length > 0 ? myData.techStack.join(', ') : 'Keine erkannt'}
      
      Text-Auszug: """${myData.text.slice(0, 6000)}"""
      
      === SEITE B (Konkurrenz) ===
      URL: ${competitorData.url}
      Titel: ${competitorData.title}
      Meta-Beschreibung: ${competitorData.metaDesc || '(keine)'}
      H1: ${competitorData.h1 || '(keine)'}
      H2-Überschriften: ${competitorData.h2Count}
      Wortanzahl: ~${competitorData.wordCount}
      
      🔧 TECHNIK:
      CMS: ${competitorData.cms.cms} (Konfidenz: ${competitorData.cms.confidence})
      Hinweise: ${competitorData.cms.hints.join(', ')}
      Tech-Stack: ${competitorData.techStack.length > 0 ? competitorData.techStack.join(', ') : 'Keine erkannt'}
      
      Text-Auszug: """${competitorData.text.slice(0, 6000)}"""

      REGELN FÜR FORMATIERUNG (STRIKT BEFOLGEN):
      1. VERWENDE KEIN MARKDOWN! (Keine **, keine ##, keine * Listen).
      2. Nutze IMMER den HTML-Tag für Fettschrift: <strong class="font-bold text-gray-900">Dein Text</strong>
      3. Nutze AUSSCHLIESSLICH HTML-Tags mit Tailwind-Klassen.

      STYLING VORGABEN:
      - Überschriften: <h3 class="font-bold text-indigo-900 mt-6 mb-3 text-lg flex items-center gap-2">TITEL</h3>
      - Fließtext: <p class="mb-3 leading-relaxed text-gray-600 text-sm">TEXT</p>
      - Listen: <ul class="space-y-2 mb-4 list-none pl-0">
      - Listen-Items: <li class="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100"><span class="text-rose-500 font-bold mt-0.5">→</span> <span>Inhalt...</span></li>
      - Empfehlungs-Box: <div class="bg-indigo-600 text-white p-4 rounded-xl my-4 shadow-lg">
      - Tech-Badge (blau): <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">TECH</span>
      - CMS-Badge (lila): <span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">CMS</span>
      - Vergleichs-Box: <div class="grid grid-cols-2 gap-4 my-4">
      - Vergleichs-Karte: <div class="bg-white p-4 rounded-xl border border-gray-200">

      AUFGABE (Erstelle diesen HTML Report):
      
      1. <h3...>🔧 Technologie-Vergleich</h3>
         Erstelle eine Vergleichs-Box mit zwei Karten (Grid 2 Spalten).
         Zeige für jede Seite:
         - CMS mit Badge
         - Tech-Stack mit Badges
         - Bewerte kurz: Was sind Vor-/Nachteile des jeweiligen CMS für SEO?
      
      2. <h3...>🏆 Warum rankt Seite B besser?</h3>
         Fasse kurz zusammen, was der inhaltliche Vorteil von Seite B ist.
         Berücksichtige auch technische Aspekte (Wortanzahl, Struktur, CMS).
      
      3. <h3...>🥊 Der direkte Vergleich</h3>
         Erstelle eine Liste der wichtigsten Unterschiede.
         Analysiere: Fehlende Themen bei A, bessere Struktur bei B, technische Vorteile.
         Beginne jeden Punkt mit <strong>Thema:</strong>

      4. <h3...>🚀 Masterplan: So schlagen wir Seite B</h3>
         Nutze die Empfehlungs-Box (weiß auf indigo).
         Gib 3-4 konkrete, priorisierte Handlungsempfehlungen.
         Berücksichtige sowohl Content als auch Technik.

      Antworte direkt mit dem HTML-Code.
    `;

    // 3. Stream starten
    const result = streamText({
      model: google('gemini-2.5-flash'),
      prompt: prompt,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ Competitor Spy Error:', error);
    return NextResponse.json(
      { message: errorMessage || 'Fehler beim Vergleich' },
      { status: 500 }
    );
  }
}
