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

// CMS-Erkennung - VERBESSERT mit Scoring-System
function detectCMS(html: string, $: cheerio.CheerioAPI): { cms: string; confidence: string; hints: string[]; isCustom: boolean } {
  const hints: string[] = [];
  const htmlLower = html.toLowerCase();
  
  let cmsScores: Record<string, number> = {};
  
  // WordPress Checks
  if (htmlLower.includes('wp-content')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 3;
  if (htmlLower.includes('wp-includes')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 3;
  if ($('meta[name="generator"][content*="WordPress"]').length > 0) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 5;
  if (htmlLower.includes('/wp-json/')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 2;
  
  // Shopify
  if (htmlLower.includes('cdn.shopify.com')) cmsScores['Shopify'] = (cmsScores['Shopify'] || 0) + 5;
  if ($('meta[name="shopify-checkout-api-token"]').length > 0) cmsScores['Shopify'] = (cmsScores['Shopify'] || 0) + 5;
  
  // Wix
  if (htmlLower.includes('wix.com') || htmlLower.includes('wixsite.com')) cmsScores['Wix'] = (cmsScores['Wix'] || 0) + 5;
  if (htmlLower.includes('_wix_browser_sess')) cmsScores['Wix'] = (cmsScores['Wix'] || 0) + 3;
  
  // Squarespace
  if (htmlLower.includes('squarespace.com') || htmlLower.includes('static1.squarespace.com')) cmsScores['Squarespace'] = (cmsScores['Squarespace'] || 0) + 5;
  
  // Webflow
  if (htmlLower.includes('webflow.com') || $('html[data-wf-site]').length > 0) cmsScores['Webflow'] = (cmsScores['Webflow'] || 0) + 5;
  
  // Joomla
  if (htmlLower.includes('/media/jui/') || $('meta[name="generator"][content*="Joomla"]').length > 0) cmsScores['Joomla'] = (cmsScores['Joomla'] || 0) + 5;
  
  // Drupal
  if (htmlLower.includes('/sites/default/files/') || $('meta[name="generator"][content*="Drupal"]').length > 0) cmsScores['Drupal'] = (cmsScores['Drupal'] || 0) + 5;
  
  // TYPO3
  if (htmlLower.includes('/typo3conf/') || $('meta[name="generator"][content*="TYPO3"]').length > 0) cmsScores['TYPO3'] = (cmsScores['TYPO3'] || 0) + 5;
  
  // Next.js
  if (htmlLower.includes('/_next/') || $('div#__next').length > 0) cmsScores['Next.js'] = (cmsScores['Next.js'] || 0) + 4;
  
  // Nuxt.js
  if (htmlLower.includes('/_nuxt/')) cmsScores['Nuxt.js'] = (cmsScores['Nuxt.js'] || 0) + 4;
  
  // Ghost
  if ($('meta[name="generator"][content*="Ghost"]').length > 0) cmsScores['Ghost'] = (cmsScores['Ghost'] || 0) + 5;
  
  // HubSpot
  if (htmlLower.includes('hs-scripts.com') || htmlLower.includes('hubspot')) cmsScores['HubSpot CMS'] = (cmsScores['HubSpot CMS'] || 0) + 4;
  
  // Generator Tag als Fallback
  const generator = $('meta[name="generator"]').attr('content');
  if (generator) {
    hints.push(`Generator-Tag: ${generator}`);
  }
  
  // Höchsten Score finden
  const sortedCMS = Object.entries(cmsScores).sort((a, b) => b[1] - a[1]);
  
  if (sortedCMS.length > 0 && sortedCMS[0][1] >= 4) {
    const detectedCMS = sortedCMS[0][0];
    
    // WordPress Details
    if (detectedCMS === 'WordPress') {
      const themeMatch = html.match(/wp-content\/themes\/([^\/'"]+)/);
      if (themeMatch) hints.push(`Theme: ${themeMatch[1]}`);
      
      const pluginMatches = html.match(/wp-content\/plugins\/([^\/'"]+)/g);
      if (pluginMatches) {
        const uniquePlugins = [...new Set(pluginMatches.map(p => p.replace('wp-content/plugins/', '')))].slice(0, 5);
        hints.push(`Plugins: ${uniquePlugins.join(', ')}`);
      }
    }
    
    return { 
      cms: detectedCMS, 
      confidence: sortedCMS[0][1] >= 6 ? 'hoch' : 'mittel', 
      hints,
      isCustom: false
    };
  }
  
  // CUSTOM / SELBSTPROGRAMMIERT erkennen
  // Wenn KEINE CMS-Signaturen gefunden wurden = wahrscheinlich custom
  const hasNoCMSSignatures = Object.keys(cmsScores).length === 0 || Math.max(...Object.values(cmsScores)) < 3;
  
  if (hasNoCMSSignatures) {
    // Weitere Hinweise für Custom-Entwicklung sammeln
    if (htmlLower.includes('vite') || htmlLower.includes('@vite')) hints.push('Vite Build-Tool erkannt');
    if (htmlLower.includes('webpack')) hints.push('Webpack erkannt');
    if (htmlLower.includes('parcel')) hints.push('Parcel erkannt');
    if (html.match(/\.(min\.)?js\?v=/)) hints.push('Versionierte Assets (professionell)');
    if ($('link[rel="manifest"]').length > 0) hints.push('PWA-fähig (Web App Manifest)');
    
    // Clean Code Indikatoren
    const hasCleanStructure = $('main').length > 0 || $('article').length > 0 || $('section').length > 0;
    if (hasCleanStructure) hints.push('Semantisches HTML (professionell)');
    
    hints.push('Keine Standard-CMS-Signaturen gefunden');
    
    return {
      cms: 'Custom / Selbstprogrammiert',
      confidence: 'hoch',
      hints,
      isCustom: true
    };
  }
  
  return { 
    cms: 'Nicht eindeutig erkannt', 
    confidence: 'niedrig', 
    hints,
    isCustom: false
  };
}

// Technologie-Stack erkennen - ERWEITERT
function detectTechStack(html: string, $: cheerio.CheerioAPI): string[] {
  const stack: string[] = [];
  const htmlLower = html.toLowerCase();
  
  // JavaScript Frameworks (genauer prüfen)
  if (htmlLower.includes('react') && !htmlLower.includes('reaction')) stack.push('React');
  if ((htmlLower.includes('vue') && htmlLower.includes('.vue')) || html.includes('v-if=') || html.includes('v-for=') || html.includes(':class=')) stack.push('Vue.js');
  if (htmlLower.includes('angular') || html.includes('ng-') || html.includes('*ngFor')) stack.push('Angular');
  if (htmlLower.includes('svelte')) stack.push('Svelte');
  if (htmlLower.includes('alpine') || html.includes('x-data=') || html.includes('x-show=')) stack.push('Alpine.js');
  
  // CSS Frameworks
  if (htmlLower.includes('bootstrap') && !htmlLower.includes('bootstrap-icons')) stack.push('Bootstrap');
  if (html.match(/class="[^"]*\b(flex|grid|p-\d|m-\d|text-sm|bg-|rounded-)/)) stack.push('Tailwind CSS');
  if (htmlLower.includes('bulma')) stack.push('Bulma');
  
  // Analytics & Tracking
  if (htmlLower.includes('google-analytics') || htmlLower.includes('gtag(') || htmlLower.includes('/ga.js')) stack.push('Google Analytics');
  if (htmlLower.includes('gtm.js') || htmlLower.includes('googletagmanager.com')) stack.push('Google Tag Manager');
  if (htmlLower.includes('facebook.net/') && htmlLower.includes('fbevents')) stack.push('Facebook Pixel');
  if (htmlLower.includes('hotjar.com')) stack.push('Hotjar');
  if (htmlLower.includes('clarity.ms')) stack.push('Microsoft Clarity');
  if (htmlLower.includes('matomo') || htmlLower.includes('piwik')) stack.push('Matomo Analytics');
  
  // CDNs & Performance
  if (htmlLower.includes('cloudflare')) stack.push('Cloudflare');
  if (htmlLower.includes('jsdelivr.net')) stack.push('jsDelivr CDN');
  if (htmlLower.includes('unpkg.com')) stack.push('unpkg CDN');
  if (htmlLower.includes('cdnjs.cloudflare.com')) stack.push('cdnjs');
  
  // Libraries
  if (htmlLower.includes('jquery') && !htmlLower.includes('jquery-migrate')) stack.push('jQuery');
  if (htmlLower.includes('gsap') || htmlLower.includes('greensock')) stack.push('GSAP Animation');
  if (htmlLower.includes('three.js') || htmlLower.includes('threejs')) stack.push('Three.js (3D)');
  if (htmlLower.includes('lottie')) stack.push('Lottie Animations');
  
  // Sonstige Tools
  if (htmlLower.includes('recaptcha')) stack.push('reCAPTCHA');
  if (htmlLower.includes('hcaptcha')) stack.push('hCaptcha');
  if (htmlLower.includes('cookiebot') || htmlLower.includes('cookie-consent') || htmlLower.includes('cookieconsent')) stack.push('Cookie Consent');
  
  return [...new Set(stack)];
}

// NEUE FUNKTION: Besondere Features erkennen
function detectSpecialFeatures(html: string, $: cheerio.CheerioAPI): string[] {
  const features: string[] = [];
  const htmlLower = html.toLowerCase();
  
  // KI / Chatbot / Assistent
  if (
    htmlLower.includes('chatbot') || 
    htmlLower.includes('chat-widget') ||
    htmlLower.includes('ai-assistant') ||
    htmlLower.includes('ki-assistent') ||
    htmlLower.includes('openai') ||
    htmlLower.includes('gpt') ||
    htmlLower.includes('anthropic') ||
    htmlLower.includes('claude') ||
    htmlLower.includes('gemini') ||
    html.includes('voiceflow') ||
    html.includes('botpress') ||
    html.includes('dialogflow') ||
    html.includes('intercom') ||
    html.includes('drift') ||
    html.includes('crisp') ||
    html.includes('tidio') ||
    html.includes('zendesk') ||
    $('[class*="chat"]').length > 2 ||
    $('[id*="chat"]').length > 0 ||
    $('[class*="bot"]').length > 0 ||
    $('[class*="assistant"]').length > 0
  ) {
    features.push('🤖 KI-Assistent / Chatbot');
  }
  
  // Live Chat
  if (
    htmlLower.includes('livechat') ||
    htmlLower.includes('live-chat') ||
    htmlLower.includes('tawk.to') ||
    htmlLower.includes('olark') ||
    htmlLower.includes('freshchat')
  ) {
    features.push('💬 Live-Chat Support');
  }
  
  // Video Content
  if (
    $('video').length > 0 ||
    htmlLower.includes('youtube.com/embed') ||
    htmlLower.includes('vimeo.com') ||
    htmlLower.includes('wistia')
  ) {
    features.push('🎬 Video-Content');
  }
  
  // Animationen
  if (
    htmlLower.includes('gsap') ||
    htmlLower.includes('lottie') ||
    htmlLower.includes('animate.css') ||
    htmlLower.includes('aos.js') ||
    html.includes('data-aos=') ||
    $('[class*="animate-"]').length > 3
  ) {
    features.push('✨ Animationen/Micro-Interactions');
  }
  
  // Dark Mode
  if (
    htmlLower.includes('dark-mode') ||
    htmlLower.includes('darkmode') ||
    html.includes('dark:') ||
    $('[class*="dark"]').length > 5
  ) {
    features.push('🌙 Dark Mode Support');
  }
  
  // PWA
  if (
    $('link[rel="manifest"]').length > 0 ||
    htmlLower.includes('serviceworker') ||
    htmlLower.includes('service-worker')
  ) {
    features.push('📱 Progressive Web App (PWA)');
  }
  
  // E-Commerce
  if (
    htmlLower.includes('add-to-cart') ||
    htmlLower.includes('warenkorb') ||
    htmlLower.includes('shop') ||
    htmlLower.includes('product') ||
    htmlLower.includes('woocommerce') ||
    $('[class*="cart"]').length > 0 ||
    $('[class*="price"]').length > 2
  ) {
    features.push('🛒 E-Commerce Funktionen');
  }
  
  // Booking/Kalender
  if (
    htmlLower.includes('calendly') ||
    htmlLower.includes('booking') ||
    htmlLower.includes('termin') ||
    htmlLower.includes('appointment') ||
    htmlLower.includes('cal.com')
  ) {
    features.push('📅 Online-Terminbuchung');
  }
  
  // Newsletter
  if (
    htmlLower.includes('newsletter') ||
    htmlLower.includes('mailchimp') ||
    htmlLower.includes('convertkit') ||
    htmlLower.includes('klaviyo') ||
    htmlLower.includes('sendinblue') ||
    $('input[type="email"]').length > 0
  ) {
    features.push('📧 Newsletter-Anmeldung');
  }
  
  // Schema/Structured Data
  if (
    $('script[type="application/ld+json"]').length > 0
  ) {
    features.push('📊 Strukturierte Daten (Schema.org)');
  }
  
  // Social Proof
  if (
    htmlLower.includes('testimonial') ||
    htmlLower.includes('review') ||
    htmlLower.includes('bewertung') ||
    htmlLower.includes('kundenstimm') ||
    $('[class*="testimonial"]').length > 0
  ) {
    features.push('⭐ Testimonials/Bewertungen');
  }
  
  // Mehrsprachigkeit
  if (
    $('link[hreflang]').length > 1 ||
    htmlLower.includes('language-switcher') ||
    htmlLower.includes('wpml') ||
    htmlLower.includes('polylang') ||
    $('[class*="lang-"]').length > 1
  ) {
    features.push('🌍 Mehrsprachig');
  }
  
  return features;
}

// Hilfsfunktion zum Scrapen - VERBESSERT
async function scrapeUrl(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    }
  });
  
  if (!res.ok) throw new Error(`Status ${res.status}`);
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // WICHTIG: Title & Meta ZUERST auslesen (vor dem Entfernen von head)
  const title = $('title').text().trim() || '';
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
  const ogDesc = $('meta[property="og:description"]').attr('content')?.trim() || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  
  // CMS, Tech & Features erkennen BEVOR wir Tags entfernen
  const cmsInfo = detectCMS(html, $);
  const techStack = detectTechStack(html, $);
  const specialFeatures = detectSpecialFeatures(html, $);
  
  // Strukturierte Daten auslesen
  const schemaScripts = $('script[type="application/ld+json"]');
  const hasSchema = schemaScripts.length > 0;
  let schemaTypes: string[] = [];
  schemaScripts.each((_, el) => {
    try {
      const schemaContent = $(el).html();
      if (schemaContent) {
        const parsed = JSON.parse(schemaContent);
        if (parsed['@type']) {
          schemaTypes.push(parsed['@type']);
        }
      }
    } catch {}
  });
  
  // Jetzt aufräumen für Content-Analyse
  $('script, style, nav, footer, iframe, svg, noscript, head').remove();
  
  // H1 - alle sammeln
  const h1Elements = $('h1');
  const h1 = h1Elements.first().text().trim();
  const h1Count = h1Elements.length;
  
  // H2 - alle sammeln mit Text
  const h2Elements: string[] = [];
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 100) {
      h2Elements.push(text);
    }
  });
  
  // Body Text
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = text.split(/\s+/).filter(w => w.length > 1).length;
  
  // Einzigartige Textpassagen extrahieren (erste Absätze)
  const uniqueTexts: string[] = [];
  $('p').each((i, el) => {
    if (i < 5) {
      const pText = $(el).text().trim();
      if (pText.length > 50 && pText.length < 500) {
        uniqueTexts.push(pText);
      }
    }
  });
  
  // Links analysieren
  const internalLinks = $('a[href^="/"], a[href^="' + url + '"]').length;
  const externalLinks = $('a[href^="http"]').not('a[href^="' + url + '"]').length;
  
  // Bilder
  const images = $('img').length;
  const imagesWithAlt = $('img[alt]:not([alt=""])').length;
  
  return { 
    url, 
    title: title || ogTitle || 'Kein Title gefunden',
    metaDesc: metaDesc || ogDesc || '',
    canonical,
    h1: h1 || 'Keine H1 gefunden',
    h1Count,
    h2Elements: h2Elements.slice(0, 10),
    h2Count: h2Elements.length,
    text: text.slice(0, 10000),
    wordCount,
    uniqueTexts,
    cms: cmsInfo,
    techStack,
    specialFeatures,
    hasSchema,
    schemaTypes,
    internalLinks,
    externalLinks,
    images,
    imagesWithAlt
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
        canonical: '',
        h1: '',
        h1Count: 0,
        h2Elements: [],
        h2Count: 0,
        text: '',
        wordCount: 0,
        uniqueTexts: [],
        cms: { cms: 'Fehler', confidence: 'n/a', hints: [e.message], isCustom: false },
        techStack: [],
        specialFeatures: [],
        hasSchema: false,
        schemaTypes: [],
        internalLinks: 0,
        externalLinks: 0,
        images: 0,
        imagesWithAlt: 0
      })),
      scrapeUrl(competitorUrl).catch(e => ({ 
        error: true, 
        msg: e.message, 
        url: competitorUrl, 
        title: 'Fehler beim Laden',
        metaDesc: '',
        canonical: '',
        h1: '',
        h1Count: 0,
        h2Elements: [],
        h2Count: 0,
        text: '',
        wordCount: 0,
        uniqueTexts: [],
        cms: { cms: 'Fehler', confidence: 'n/a', hints: [e.message], isCustom: false },
        techStack: [],
        specialFeatures: [],
        hasSchema: false,
        schemaTypes: [],
        internalLinks: 0,
        externalLinks: 0,
        images: 0,
        imagesWithAlt: 0
      }))
    ]);

    // 2. Prompt erstellen
    const prompt = `
      Du bist ein erfahrener SEO-Stratege und Web-Analyst. Vergleiche zwei Webseiten FAIR und OBJEKTIV.
      
      WICHTIG: Analysiere die Daten sorgfältig. Beide Seiten können Stärken haben!
      Eine "Custom/Selbstprogrammiert" Seite ist KEIN Nachteil - im Gegenteil, es zeigt technische Kompetenz.

      ═══════════════════════════════════════════════════════════════
      SEITE A: ${myData.url}
      ═══════════════════════════════════════════════════════════════
      
      📄 META-DATEN:
      • Title: "${myData.title}"
      • Meta-Beschreibung: "${myData.metaDesc || '(keine)'}"
      • H1: "${myData.h1}" (${myData.h1Count}x vorhanden)
      • H2-Überschriften (${myData.h2Count}): ${myData.h2Elements.slice(0, 5).join(' | ') || '(keine)'}
      
      📊 CONTENT-METRIKEN:
      • Wortanzahl: ~${myData.wordCount}
      • Interne Links: ${myData.internalLinks}
      • Externe Links: ${myData.externalLinks}
      • Bilder: ${myData.images} (davon ${myData.imagesWithAlt} mit Alt-Text)
      • Schema.org: ${myData.hasSchema ? `Ja (${myData.schemaTypes.join(', ')})` : 'Nein'}
      
      🔧 TECHNOLOGIE:
      • CMS: ${myData.cms.cms} ${myData.cms.isCustom ? '⭐ (Eigenentwicklung = technische Kompetenz!)' : ''}
      • Konfidenz: ${myData.cms.confidence}
      • Details: ${myData.cms.hints.join(', ') || 'Keine'}
      • Tech-Stack: ${myData.techStack.length > 0 ? myData.techStack.join(', ') : 'Minimal/Clean'}
      
      ✨ BESONDERE FEATURES:
      ${myData.specialFeatures.length > 0 ? myData.specialFeatures.join('\n      ') : '• Keine besonderen Features erkannt'}
      
      📝 EINZIGARTIGE TEXTPASSAGEN:
      ${myData.uniqueTexts.slice(0, 2).map(t => `"${t.slice(0, 200)}..."`).join('\n      ') || 'Keine extrahiert'}
      
      ═══════════════════════════════════════════════════════════════
      SEITE B: ${competitorData.url}
      ═══════════════════════════════════════════════════════════════
      
      📄 META-DATEN:
      • Title: "${competitorData.title}"
      • Meta-Beschreibung: "${competitorData.metaDesc || '(keine)'}"
      • H1: "${competitorData.h1}" (${competitorData.h1Count}x vorhanden)
      • H2-Überschriften (${competitorData.h2Count}): ${competitorData.h2Elements.slice(0, 5).join(' | ') || '(keine)'}
      
      📊 CONTENT-METRIKEN:
      • Wortanzahl: ~${competitorData.wordCount}
      • Interne Links: ${competitorData.internalLinks}
      • Externe Links: ${competitorData.externalLinks}
      • Bilder: ${competitorData.images} (davon ${competitorData.imagesWithAlt} mit Alt-Text)
      • Schema.org: ${competitorData.hasSchema ? `Ja (${competitorData.schemaTypes.join(', ')})` : 'Nein'}
      
      🔧 TECHNOLOGIE:
      • CMS: ${competitorData.cms.cms} ${competitorData.cms.isCustom ? '⭐ (Eigenentwicklung = technische Kompetenz!)' : ''}
      • Konfidenz: ${competitorData.cms.confidence}
      • Details: ${competitorData.cms.hints.join(', ') || 'Keine'}
      • Tech-Stack: ${competitorData.techStack.length > 0 ? competitorData.techStack.join(', ') : 'Minimal/Clean'}
      
      ✨ BESONDERE FEATURES:
      ${competitorData.specialFeatures.length > 0 ? competitorData.specialFeatures.join('\n      ') : '• Keine besonderen Features erkannt'}
      
      📝 EINZIGARTIGE TEXTPASSAGEN:
      ${competitorData.uniqueTexts.slice(0, 2).map(t => `"${t.slice(0, 200)}..."`).join('\n      ') || 'Keine extrahiert'}

      ═══════════════════════════════════════════════════════════════
      FORMATIERUNGS-REGELN (STRIKT):
      ═══════════════════════════════════════════════════════════════
      
      1. KEIN MARKDOWN! Keine **, ##, * Listen
      2. Nur HTML mit Tailwind-Klassen
      3. Fettschrift: <strong class="font-bold text-gray-900">Text</strong>

      STYLING:
      - Überschriften: <h3 class="font-bold text-indigo-900 mt-6 mb-3 text-lg flex items-center gap-2">TITEL</h3>
      - Fließtext: <p class="mb-3 leading-relaxed text-gray-600 text-sm">TEXT</p>
      - Listen: <ul class="space-y-2 mb-4 list-none pl-0">
      - Listen-Item: <li class="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100"><span class="text-indigo-500 font-bold">→</span> <span>Inhalt</span></li>
      - Vergleichs-Grid: <div class="grid grid-cols-2 gap-4 my-4">
      - Karte: <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
      - Gute Karte (grün): <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
      - Badge positiv: <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">GUT</span>
      - Badge negativ: <span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-xs font-bold">FEHLT</span>
      - Badge neutral: <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">INFO</span>
      - Feature-Badge: <span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">FEATURE</span>
      - Empfehlungs-Box: <div class="bg-indigo-600 text-white p-4 rounded-xl my-4 shadow-lg">
      - Stat-Grid: <div class="grid grid-cols-4 gap-2 my-3"><div class="bg-gray-50 p-2 rounded-lg text-center"><div class="text-lg font-bold text-indigo-600">ZAHL</div><div class="text-[10px] text-gray-500">LABEL</div></div></div>

      ═══════════════════════════════════════════════════════════════
      AUFGABE - Erstelle diesen HTML-Report:
      ═══════════════════════════════════════════════════════════════

      1. <h3>🔧 Technologie-Vergleich</h3>
         Vergleichs-Grid mit zwei Karten.
         Für JEDE Seite zeige:
         - CMS (mit Badge: Custom = POSITIV darstellen!)
         - Tech-Stack
         - Besondere Features (mit Feature-Badges)
         - Kurze Bewertung der technischen Umsetzung
         
         WICHTIG: "Custom/Selbstprogrammiert" ist ein VORTEIL (keine Plugin-Abhängigkeit, schneller, sicherer)!

      2. <h3>📊 Metriken-Vergleich</h3>
         Stat-Grid mit den wichtigsten Zahlen nebeneinander:
         - Wortanzahl
         - H2-Überschriften  
         - Bilder
         - Interne Links

      3. <h3>🏆 Stärken & Schwächen</h3>
         Analysiere BEIDE Seiten FAIR.
         Was macht Seite A besser? Was macht Seite B besser?
         Berücksichtige:
         - Besondere Features (KI-Assistent, Chat, etc.)
         - Einzigartige Inhalte/Texte
         - Technische Qualität
         - Content-Tiefe
         - Meta-Optimierung
         
         Nutze Listen mit Badges (GUT/FEHLT/FEATURE).

      4. <h3>🎯 Strategische Empfehlungen</h3>
         Empfehlungs-Box mit 3-4 konkreten, priorisierten Maßnahmen.
         Berücksichtige die Stärken beider Seiten.
         Was kann A von B lernen? Was kann B von A lernen?

      Antworte direkt mit HTML. Sei FAIR und OBJEKTIV bei der Analyse!
    `;

    // 3. Stream starten
    const result = streamText({
      model: google('gemini-2.5-flash'),
      prompt: prompt,
      temperature: 0.3, // Niedriger für genauere Analyse
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
