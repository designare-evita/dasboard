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

// CMS-Erkennung mit Scoring-System
function detectCMS(html: string, $: cheerio.CheerioAPI): { cms: string; confidence: string; hints: string[]; isCustom: boolean } {
  const hints: string[] = [];
  const htmlLower = html.toLowerCase();
  
  const cmsScores: Record<string, number> = {};
  
  // WordPress
  if (htmlLower.includes('wp-content')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 3;
  if (htmlLower.includes('wp-includes')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 3;
  if ($('meta[name="generator"][content*="WordPress"]').length > 0) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 5;
  if (htmlLower.includes('/wp-json/')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 2;
  
  // Shopify
  if (htmlLower.includes('cdn.shopify.com')) cmsScores['Shopify'] = (cmsScores['Shopify'] || 0) + 5;
  if ($('meta[name="shopify-checkout-api-token"]').length > 0) cmsScores['Shopify'] = (cmsScores['Shopify'] || 0) + 5;
  
  // Wix
  if (htmlLower.includes('wix.com') || htmlLower.includes('wixsite.com')) cmsScores['Wix'] = (cmsScores['Wix'] || 0) + 5;
  
  // Squarespace
  if (htmlLower.includes('squarespace.com')) cmsScores['Squarespace'] = (cmsScores['Squarespace'] || 0) + 5;
  
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
  if (htmlLower.includes('hs-scripts.com')) cmsScores['HubSpot CMS'] = (cmsScores['HubSpot CMS'] || 0) + 4;
  
  // Generator Tag
  const generator = $('meta[name="generator"]').attr('content');
  if (generator) hints.push(`Generator-Tag: ${generator}`);
  
  // Höchsten Score finden
  const sortedCMS = Object.entries(cmsScores).sort((a, b) => b[1] - a[1]);
  
  if (sortedCMS.length > 0 && sortedCMS[0][1] >= 4) {
    const detectedCMS = sortedCMS[0][0];
    
    if (detectedCMS === 'WordPress') {
      const themeMatch = html.match(/wp-content\/themes\/([^\/'"]+)/);
      if (themeMatch) hints.push(`Theme: ${themeMatch[1]}`);
      
      const pluginMatches = html.match(/wp-content\/plugins\/([^\/'"]+)/g);
      if (pluginMatches) {
        const uniquePlugins = [...new Set(pluginMatches.map(p => p.replace('wp-content/plugins/', '')))].slice(0, 5);
        hints.push(`Plugins: ${uniquePlugins.join(', ')}`);
      }
    }
    
    return { cms: detectedCMS, confidence: sortedCMS[0][1] >= 6 ? 'hoch' : 'mittel', hints, isCustom: false };
  }
  
  // Custom erkennen
  const hasNoCMSSignatures = Object.keys(cmsScores).length === 0 || Math.max(...Object.values(cmsScores)) < 3;
  
  if (hasNoCMSSignatures) {
    if (htmlLower.includes('vite')) hints.push('Vite Build-Tool');
    if (htmlLower.includes('webpack')) hints.push('Webpack');
    if ($('link[rel="manifest"]').length > 0) hints.push('PWA-fähig');
    if ($('main').length > 0 || $('article').length > 0) hints.push('Semantisches HTML');
    hints.push('Keine CMS-Signaturen erkannt');
    
    return { cms: 'Custom / Selbstprogrammiert', confidence: 'hoch', hints, isCustom: true };
  }
  
  return { cms: 'Nicht erkannt', confidence: 'niedrig', hints, isCustom: false };
}

// Tech-Stack erkennen
function detectTechStack(html: string, $: cheerio.CheerioAPI): string[] {
  const stack: string[] = [];
  const htmlLower = html.toLowerCase();
  
  // JS Frameworks
  if (htmlLower.includes('react') && !htmlLower.includes('reaction')) stack.push('React');
  if (html.includes('v-if=') || html.includes('v-for=') || html.includes(':class=')) stack.push('Vue.js');
  if (html.includes('ng-') || html.includes('*ngFor')) stack.push('Angular');
  if (html.includes('x-data=') || html.includes('x-show=')) stack.push('Alpine.js');
  
  // CSS
  if (htmlLower.includes('bootstrap')) stack.push('Bootstrap');
  if (html.match(/class="[^"]*\b(flex |grid |p-\d|m-\d|text-sm|bg-|rounded-)/)) stack.push('Tailwind CSS');
  
  // Analytics
  if (htmlLower.includes('gtag(') || htmlLower.includes('google-analytics')) stack.push('Google Analytics');
  if (htmlLower.includes('googletagmanager.com')) stack.push('Google Tag Manager');
  if (htmlLower.includes('hotjar')) stack.push('Hotjar');
  if (htmlLower.includes('clarity.ms')) stack.push('Microsoft Clarity');
  
  // CDN
  if (htmlLower.includes('cloudflare')) stack.push('Cloudflare');
  if (htmlLower.includes('jsdelivr')) stack.push('jsDelivr CDN');
  
  // Libraries
  if (htmlLower.includes('jquery')) stack.push('jQuery');
  if (htmlLower.includes('gsap')) stack.push('GSAP Animation');
  if (htmlLower.includes('lottie')) stack.push('Lottie');
  
  return [...new Set(stack)];
}

// Features erkennen
function detectSpecialFeatures(html: string, $: cheerio.CheerioAPI): string[] {
  const features: string[] = [];
  const htmlLower = html.toLowerCase();
  
  // KI/Chatbot
  if (
    htmlLower.includes('chatbot') || htmlLower.includes('chat-widget') ||
    htmlLower.includes('ai-assistant') || htmlLower.includes('ki-assistent') ||
    htmlLower.includes('openai') || htmlLower.includes('gpt') ||
    htmlLower.includes('voiceflow') || htmlLower.includes('intercom') ||
    htmlLower.includes('tidio') || htmlLower.includes('crisp') ||
    $('[class*="chat"]').length > 2 || $('[id*="chat"]').length > 0
  ) {
    features.push('🤖 KI-Assistent / Chatbot');
  }
  
  // Live Chat
  if (htmlLower.includes('livechat') || htmlLower.includes('tawk.to')) {
    features.push('💬 Live-Chat Support');
  }
  
  // Video
  if ($('video').length > 0 || htmlLower.includes('youtube.com/embed') || htmlLower.includes('vimeo')) {
    features.push('🎬 Video-Content');
  }
  
  // Animationen
  if (htmlLower.includes('gsap') || htmlLower.includes('lottie') || html.includes('data-aos=')) {
    features.push('✨ Animationen');
  }
  
  // Dark Mode
  if (html.includes('dark:') || htmlLower.includes('dark-mode')) {
    features.push('🌙 Dark Mode');
  }
  
  // PWA
  if ($('link[rel="manifest"]').length > 0) {
    features.push('📱 Progressive Web App');
  }
  
  // E-Commerce
  if (htmlLower.includes('warenkorb') || htmlLower.includes('add-to-cart') || htmlLower.includes('woocommerce')) {
    features.push('🛒 E-Commerce / Shop');
  }
  
  // Booking
  if (htmlLower.includes('calendly') || htmlLower.includes('booking') || htmlLower.includes('termin')) {
    features.push('📅 Online-Terminbuchung');
  }
  
  // Newsletter
  if (htmlLower.includes('newsletter') || htmlLower.includes('mailchimp')) {
    features.push('📧 Newsletter');
  }
  
  // Schema
  if ($('script[type="application/ld+json"]').length > 0) {
    features.push('📊 Strukturierte Daten');
  }
  
  // Testimonials
  if (htmlLower.includes('testimonial') || htmlLower.includes('bewertung') || htmlLower.includes('kundenstimm')) {
    features.push('⭐ Testimonials');
  }
  
  // Mehrsprachig
  if ($('link[hreflang]').length > 1 || htmlLower.includes('wpml')) {
    features.push('🌍 Mehrsprachig');
  }
  
  // Blog
  if (htmlLower.includes('/blog') || htmlLower.includes('artikel') || htmlLower.includes('beitrag')) {
    features.push('📝 Blog / News');
  }
  
  // Portfolio/Referenzen
  if (htmlLower.includes('portfolio') || htmlLower.includes('referenz') || htmlLower.includes('projekt')) {
    features.push('🖼️ Portfolio / Referenzen');
  }
  
  // FAQ
  if (htmlLower.includes('faq') || htmlLower.includes('häufige fragen')) {
    features.push('❓ FAQ-Bereich');
  }
  
  return features;
}

// Kontaktdaten extrahieren
function extractContactInfo(html: string, $: cheerio.CheerioAPI): { 
  emails: string[]; 
  phones: string[]; 
  names: string[];
  address: string;
  social: string[];
} {
  const emails: string[] = [];
  const phones: string[] = [];
  const names: string[] = [];
  const social: string[] = [];
  let address = '';
  
  // Emails aus href="mailto:"
  $('a[href^="mailto:"]').each((_, el) => {
    const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0];
    if (email && !emails.includes(email)) emails.push(email);
  });
  
  // Emails aus Text (Regex)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = html.match(emailRegex);
  if (emailMatches) {
    emailMatches.forEach(e => {
      if (!emails.includes(e) && !e.includes('example') && !e.includes('wixpress')) {
        emails.push(e);
      }
    });
  }
  
  // Telefon aus href="tel:"
  $('a[href^="tel:"]').each((_, el) => {
    const phone = $(el).attr('href')?.replace('tel:', '').replace(/\s/g, '');
    if (phone && !phones.includes(phone)) phones.push(phone);
  });
  
  // Telefon aus Text (österreichische/deutsche Formate)
  const phoneRegex = /(?:\+43|0043|0)\s*\d{1,4}[\s/-]?\d{2,4}[\s/-]?\d{2,4}[\s/-]?\d{0,4}/g;
  const phoneMatches = html.match(phoneRegex);
  if (phoneMatches) {
    phoneMatches.slice(0, 3).forEach(p => {
      const cleaned = p.replace(/\s/g, '');
      if (!phones.includes(cleaned) && cleaned.length >= 8) phones.push(p.trim());
    });
  }
  
  // Social Media
  const socialPlatforms = ['facebook', 'instagram', 'linkedin', 'twitter', 'xing', 'youtube', 'tiktok'];
  socialPlatforms.forEach(platform => {
    const link = $(`a[href*="${platform}.com"], a[href*="${platform}.at"]`).first().attr('href');
    if (link) social.push(link);
  });
  
  // Namen aus strukturierten Daten oder Meta
  const schemaScript = $('script[type="application/ld+json"]').first().html();
  if (schemaScript) {
    try {
      const schema = JSON.parse(schemaScript);
      if (schema.name) names.push(schema.name);
      if (schema.author?.name) names.push(schema.author.name);
      if (schema.address?.streetAddress) {
        address = `${schema.address.streetAddress}, ${schema.address.postalCode} ${schema.address.addressLocality}`;
      }
    } catch {}
  }
  
  // Name aus Copyright oder Footer
  const footerText = $('footer').text();
  const copyrightMatch = footerText.match(/©\s*\d{4}\s*([^|•\n]+)/);
  if (copyrightMatch && copyrightMatch[1].trim().length < 50) {
    names.push(copyrightMatch[1].trim());
  }
  
  // Adresse aus Footer/Kontakt
  const addressMatch = html.match(/(\d{4})\s+([A-Za-zäöüÄÖÜß\s-]+),?\s*(Austria|Österreich|Deutschland|Germany|Schweiz)?/i);
  if (addressMatch && !address) {
    address = addressMatch[0];
  }
  
  return { 
    emails: [...new Set(emails)].slice(0, 3), 
    phones: [...new Set(phones)].slice(0, 2),
    names: [...new Set(names)].slice(0, 2),
    address,
    social: social.slice(0, 4)
  };
}

// Scrapen
async function scrapeUrl(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    }
  });
  
  if (!res.ok) throw new Error(`Status ${res.status}`);
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Meta ZUERST auslesen
  const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || $('meta[property="og:description"]').attr('content') || '';
  
  // CMS, Tech, Features erkennen
  const cmsInfo = detectCMS(html, $);
  const techStack = detectTechStack(html, $);
  const specialFeatures = detectSpecialFeatures(html, $);
  const contactInfo = extractContactInfo(html, $);
  
  // Schema
  const schemaScripts = $('script[type="application/ld+json"]');
  let schemaTypes: string[] = [];
  schemaScripts.each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || '');
      if (parsed['@type']) schemaTypes.push(parsed['@type']);
    } catch {}
  });
  
  // Aufräumen für Content
  $('script, style, nav, footer, iframe, svg, noscript, head').remove();
  
  const h1 = $('h1').first().text().trim();
  const h2Elements: string[] = [];
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 100) h2Elements.push(text);
  });
  
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = text.split(/\s+/).filter(w => w.length > 1).length;
  
  // Einzigartige Texte
  const uniqueTexts: string[] = [];
  $('p').each((i, el) => {
    if (i < 5) {
      const pText = $(el).text().trim();
      if (pText.length > 50 && pText.length < 500) uniqueTexts.push(pText);
    }
  });
  
  return { 
    url, 
    title: title || 'Kein Title',
    metaDesc,
    h1: h1 || 'Keine H1',
    h2Elements: h2Elements.slice(0, 8),
    h2Count: h2Elements.length,
    text: text.slice(0, 8000),
    wordCount,
    uniqueTexts,
    cms: cmsInfo,
    techStack,
    specialFeatures,
    schemaTypes,
    contactInfo
  };
}

export async function POST(req: NextRequest) {
  try {
    const { myUrl, competitorUrl } = await req.json();

    if (!myUrl || !competitorUrl) {
      return NextResponse.json({ message: 'Beide URLs sind erforderlich.' }, { status: 400 });
    }

    const [myData, competitorData] = await Promise.all([
      scrapeUrl(myUrl).catch(e => ({ 
        error: true, url: myUrl, title: 'Fehler', metaDesc: '', h1: '', h2Elements: [], h2Count: 0,
        text: '', wordCount: 0, uniqueTexts: [],
        cms: { cms: 'Fehler', confidence: 'n/a', hints: [e.message], isCustom: false },
        techStack: [], specialFeatures: [], schemaTypes: [],
        contactInfo: { emails: [], phones: [], names: [], address: '', social: [] }
      })),
      scrapeUrl(competitorUrl).catch(e => ({ 
        error: true, url: competitorUrl, title: 'Fehler', metaDesc: '', h1: '', h2Elements: [], h2Count: 0,
        text: '', wordCount: 0, uniqueTexts: [],
        cms: { cms: 'Fehler', confidence: 'n/a', hints: [e.message], isCustom: false },
        techStack: [], specialFeatures: [], schemaTypes: [],
        contactInfo: { emails: [], phones: [], names: [], address: '', social: [] }
      }))
    ]);

    const prompt = `
      Du bist ein erfahrener SEO-Stratege und Web-Analyst. Analysiere zwei Webseiten FAIR und DETAILLIERT.

      ═══════════════════════════════════════════════════════════════
      SEITE A: ${myData.url}
      ═══════════════════════════════════════════════════════════════
      
      📄 META:
      • Title: "${myData.title}"
      • Meta-Beschreibung: "${myData.metaDesc || '(keine)'}"
      • H1: "${myData.h1}"
      • H2 (${myData.h2Count}): ${myData.h2Elements.slice(0, 5).join(' | ') || '(keine)'}
      • Wortanzahl: ~${myData.wordCount}
      
      🔧 TECHNIK:
      • CMS: ${myData.cms.cms} ${myData.cms.isCustom ? '⭐ (Eigenentwicklung!)' : ''}
      • Details: ${myData.cms.hints.join(', ') || '-'}
      • Tech-Stack: ${myData.techStack.join(', ') || 'Minimal'}
      • Schema.org: ${myData.schemaTypes.length > 0 ? myData.schemaTypes.join(', ') : 'Keine'}
      
      ✨ FEATURES:
      ${myData.specialFeatures.length > 0 ? myData.specialFeatures.join('\n      ') : '(keine besonderen Features erkannt)'}
      
      📝 TEXT-AUSZÜGE:
      ${myData.uniqueTexts.slice(0, 2).map(t => `"${t.slice(0, 250)}..."`).join('\n      ') || '(keine)'}
      
      📞 KONTAKT:
      • Namen: ${myData.contactInfo.names.join(', ') || '-'}
      • E-Mail: ${myData.contactInfo.emails.join(', ') || '-'}
      • Telefon: ${myData.contactInfo.phones.join(', ') || '-'}
      • Adresse: ${myData.contactInfo.address || '-'}
      • Social: ${myData.contactInfo.social.length > 0 ? myData.contactInfo.social.map(s => s.split('/')[2]).join(', ') : '-'}
      
      ═══════════════════════════════════════════════════════════════
      SEITE B: ${competitorData.url}
      ═══════════════════════════════════════════════════════════════
      
      📄 META:
      • Title: "${competitorData.title}"
      • Meta-Beschreibung: "${competitorData.metaDesc || '(keine)'}"
      • H1: "${competitorData.h1}"
      • H2 (${competitorData.h2Count}): ${competitorData.h2Elements.slice(0, 5).join(' | ') || '(keine)'}
      • Wortanzahl: ~${competitorData.wordCount}
      
      🔧 TECHNIK:
      • CMS: ${competitorData.cms.cms} ${competitorData.cms.isCustom ? '⭐ (Eigenentwicklung!)' : ''}
      • Details: ${competitorData.cms.hints.join(', ') || '-'}
      • Tech-Stack: ${competitorData.techStack.join(', ') || 'Minimal'}
      • Schema.org: ${competitorData.schemaTypes.length > 0 ? competitorData.schemaTypes.join(', ') : 'Keine'}
      
      ✨ FEATURES:
      ${competitorData.specialFeatures.length > 0 ? competitorData.specialFeatures.join('\n      ') : '(keine besonderen Features erkannt)'}
      
      📝 TEXT-AUSZÜGE:
      ${competitorData.uniqueTexts.slice(0, 2).map(t => `"${t.slice(0, 250)}..."`).join('\n      ') || '(keine)'}
      
      📞 KONTAKT:
      • Namen: ${competitorData.contactInfo.names.join(', ') || '-'}
      • E-Mail: ${competitorData.contactInfo.emails.join(', ') || '-'}
      • Telefon: ${competitorData.contactInfo.phones.join(', ') || '-'}
      • Adresse: ${competitorData.contactInfo.address || '-'}
      • Social: ${competitorData.contactInfo.social.length > 0 ? competitorData.contactInfo.social.map(s => s.split('/')[2]).join(', ') : '-'}

      ═══════════════════════════════════════════════════════════════
      FORMATIERUNG (STRIKT - KEIN MARKDOWN!)
      ═══════════════════════════════════════════════════════════════
      
      Nur HTML mit Tailwind. Keine **, ##, * Listen!
      
      - Überschriften: <h3 class="font-bold text-indigo-900 mt-6 mb-3 text-lg flex items-center gap-2">TITEL</h3>
      - Fließtext: <p class="mb-3 leading-relaxed text-gray-600 text-sm">TEXT</p>
      - Info-Box (blau): <div class="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-4">
      - Listen: <ul class="space-y-2 mb-4 list-none pl-0">
      - Listen-Item: <li class="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100"><span class="text-indigo-500 font-bold">→</span> <span>Text</span></li>
      - Vorteil-Item: <li class="flex items-start gap-2 text-sm bg-emerald-50 p-3 rounded-lg border border-emerald-200"><span class="text-emerald-600 font-bold">✓</span> <span>Text</span></li>
      - Nachteil-Item: <li class="flex items-start gap-2 text-sm bg-rose-50 p-3 rounded-lg border border-rose-200"><span class="text-rose-500 font-bold">✗</span> <span>Text</span></li>
      - Feature-Item: <li class="flex items-start gap-2 text-sm bg-purple-50 p-3 rounded-lg border border-purple-200"><span class="text-purple-600 font-bold">★</span> <span>Text</span></li>
      - Vergleichs-Grid: <div class="grid grid-cols-2 gap-4 my-4">
      - Karte: <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
      - Karten-Titel: <h4 class="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">TITEL</h4>
      - Badge CMS: <span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">CMS</span>
      - Badge Custom: <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">⭐ CUSTOM</span>
      - Empfehlungs-Box: <div class="bg-indigo-600 text-white p-4 rounded-xl my-4 shadow-lg">
      - Kontakt-Box: <div class="bg-gray-100 p-4 rounded-xl my-4 border border-gray-200">

      ═══════════════════════════════════════════════════════════════
      ERSTELLE DIESEN REPORT:
      ═══════════════════════════════════════════════════════════════

      1. <h3>ℹ️ Übersicht</h3>
         Info-Box mit kurzer Beschreibung beider Seiten.
         Wer/Was ist die Seite? (z.B. "SEO-Agentur aus Niederösterreich", "Persönliche Website von Max Mustermann", "Webshop für Sportartikel")
         Format: "Seite A: ... | Seite B: ..."

      2. <h3>🔧 Technologie-Vergleich</h3>
         Vergleichs-Grid mit zwei Karten.
         Pro Seite zeige:
         - CMS (Badge) - Custom = Vorteil!
         - Tech-Stack (kurz)
         - Bewertung: Was sind die Vor-/Nachteile dieser Technik?
         
         Wichtig: "Custom/Selbstprogrammiert" ist ein VORTEIL (schneller, sicherer, flexibler)!

      3. <h3>✨ Besondere Features - Seite A</h3>
         Ausführliche Analyse aller Features von Seite A.
         Nutze Feature-Items für erkannte Features.
         Erkläre WARUM jedes Feature wichtig ist (SEO, UX, Conversion).
         
      4. <h3>✨ Besondere Features - Seite B</h3>
         Ausführliche Analyse aller Features von Seite B.
         Nutze Feature-Items.
         Erkläre WARUM jedes Feature wichtig ist.

      5. <h3>✓ Stärken & ✗ Schwächen - Seite A</h3>
         Liste mit Vorteil-Items (✓) und Nachteil-Items (✗).
         Mindestens 3-4 Stärken und 2-3 Schwächen.
         Berücksichtige: Content, Technik, Features, SEO, UX.

      6. <h3>✓ Stärken & ✗ Schwächen - Seite B</h3>
         Liste mit Vorteil-Items (✓) und Nachteil-Items (✗).
         Mindestens 3-4 Stärken und 2-3 Schwächen.
         SEI FAIR - auch kleine Seiten können Stärken haben (Design, Fokus, Technologie)!

      7. <h3>🎯 Strategische Empfehlungen</h3>
         Empfehlungs-Box mit 3-4 konkreten, priorisierten Maßnahmen.
         Was kann jede Seite von der anderen lernen?
         Konkrete Action Items.

      8. <h3>📞 Kontaktinformationen</h3>
         Kontakt-Box mit Grid (2 Spalten).
         Pro Seite: Name, E-Mail, Telefon, Adresse (falls vorhanden).
         Format übersichtlich mit Labels.

      Antworte direkt mit HTML. Sei FAIR, OBJEKTIV und AUSFÜHRLICH!
    `;

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
