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
      htmlLower.includes('openai') || htmlLower.includes('gpt') || $('[class*="chat"]').length > 2) {
    features.push('🤖 KI-Assistent / Chatbot');
  }
  if (htmlLower.includes('livechat') || htmlLower.includes('tawk.to') || htmlLower.includes('intercom')) {
    features.push('💬 Live-Chat');
  }
  if ($('video').length > 0 || htmlLower.includes('youtube.com/embed')) {
    features.push('🎬 Video-Content');
  }
  if (htmlLower.includes('gsap') || htmlLower.includes('lottie') || html.includes('data-aos=')) {
    features.push('✨ Animationen');
  }
  if (html.includes('dark:') || htmlLower.includes('dark-mode')) {
    features.push('🌙 Dark Mode');
  }
  if ($('link[rel="manifest"]').length > 0) {
    features.push('📱 PWA-fähig');
  }
  if (htmlLower.includes('warenkorb') || htmlLower.includes('woocommerce') || htmlLower.includes('shop')) {
    features.push('🛒 E-Commerce');
  }
  if (htmlLower.includes('calendly') || htmlLower.includes('booking') || htmlLower.includes('termin')) {
    features.push('📅 Terminbuchung');
  }
  if (htmlLower.includes('newsletter') || htmlLower.includes('mailchimp')) {
    features.push('📧 Newsletter');
  }
  if ($('script[type="application/ld+json"]').length > 0) {
    features.push('📊 Schema.org Daten');
  }
  if (htmlLower.includes('testimonial') || htmlLower.includes('bewertung') || htmlLower.includes('referenz')) {
    features.push('⭐ Testimonials/Referenzen');
  }
  if ($('link[hreflang]').length > 1) {
    features.push('🌍 Mehrsprachig');
  }
  if (htmlLower.includes('/blog') || htmlLower.includes('artikel')) {
    features.push('📝 Blog');
  }
  if (htmlLower.includes('faq')) {
    features.push('❓ FAQ');
  }
  if (htmlLower.includes('kontakt') || htmlLower.includes('contact')) {
    features.push('📞 Kontaktseite');
  }
  
  return features;
}

// Hauptmenü-Links extrahieren
function extractMainNavLinks(html: string, $: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: string[] = [];
  const baseUrlObj = new URL(baseUrl);
  const baseDomain = baseUrlObj.origin;
  
  // Suche in nav, header oder typischen Menü-Containern
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
      
      // Relative URLs zu absoluten machen
      if (href.startsWith('/')) {
        href = baseDomain + href;
      } else if (!href.startsWith('http')) {
        href = baseDomain + '/' + href;
      }
      
      // Nur interne Links, keine Anker, keine Dateien
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
  
  return links.slice(0, 5); // Max 5 Unterseiten
}

// Unterseite scrapen (vereinfacht)
async function scrapeSubpage(url: string): Promise<{ url: string; title: string; h1: string; wordCount: number }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
      signal: AbortSignal.timeout(5000) // 5s Timeout
    });
    
    if (!res.ok) return { url, title: 'Fehler', h1: '', wordCount: 0 };
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const title = $('title').text().trim().slice(0, 60);
    const h1 = $('h1').first().text().trim().slice(0, 60);
    
    $('script, style, nav, footer, head').remove();
    const wordCount = $('body').text().replace(/\s+/g, ' ').trim().split(/\s+/).length;
    
    // Pfad extrahieren
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
  
  // Meta ZUERST
  const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';
  
  // CMS, Tech, Features
  const cmsInfo = detectCMS(html, $);
  const techStack = detectTechStack(html);
  const features = detectFeatures(html, $);
  
  // Menü-Links extrahieren
  const navLinks = extractMainNavLinks(html, $, url);
  
  // Unterseiten parallel scrapen
  const subpagePromises = navLinks.map(link => scrapeSubpage(link));
  const subpages = await Promise.all(subpagePromises);
  
  // Aufräumen für Content
  $('script, style, nav, footer, iframe, svg, noscript, head').remove();
  
  const h1 = $('h1').first().text().trim();
  const h2Elements: string[] = [];
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 80) h2Elements.push(text);
  });
  
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = text.split(/\s+/).filter(w => w.length > 1).length;
  
  // Texte
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
    subpages: subpages.filter(s => s.wordCount > 0)
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
        techStack: [], features: [], subpages: []
      })),
      scrapeUrl(competitorUrl).catch(e => ({ 
        error: true, url: competitorUrl, title: 'Fehler', metaDesc: '', h1: '', h2Elements: [], h2Count: 0,
        text: '', wordCount: 0, uniqueTexts: [],
        cms: { cms: 'Fehler', confidence: 'n/a', hints: [e.message], isCustom: false },
        techStack: [], features: [], subpages: []
      }))
    ]);

    const prompt = `
Du bist ein SEO-Stratege. Analysiere zwei Webseiten FAIR und OBJEKTIV.

══════════════════════════════════════════════════════════════════════════════
SEITE A: ${myData.url}
══════════════════════════════════════════════════════════════════════════════

📄 META:
• Title: "${myData.title}"
• Meta-Beschreibung: "${myData.metaDesc || '(keine)'}"
• H1: "${myData.h1}"
• H2 (${myData.h2Count}): ${myData.h2Elements.join(' | ') || '(keine)'}
• Wörter: ~${myData.wordCount}

🔧 TECHNIK:
• CMS: ${myData.cms.cms} ${myData.cms.isCustom ? '⭐' : ''}
• Details: ${myData.cms.hints.join(', ') || '-'}
• Tech: ${myData.techStack.join(', ') || '-'}

✨ FEATURES: ${myData.features.join(', ') || 'keine erkannt'}

📑 UNTERSEITEN (Menü):
${myData.subpages.length > 0 ? myData.subpages.map(s => `• ${s.url} - "${s.title}" (~${s.wordCount} Wörter)`).join('\n') : '(keine gescraped)'}

📝 TEXT-AUSZUG:
"${myData.uniqueTexts.slice(0, 2).join(' ... ').slice(0, 400)}..."

══════════════════════════════════════════════════════════════════════════════
SEITE B: ${competitorData.url}
══════════════════════════════════════════════════════════════════════════════

📄 META:
• Title: "${competitorData.title}"
• Meta-Beschreibung: "${competitorData.metaDesc || '(keine)'}"
• H1: "${competitorData.h1}"
• H2 (${competitorData.h2Count}): ${competitorData.h2Elements.join(' | ') || '(keine)'}
• Wörter: ~${competitorData.wordCount}

🔧 TECHNIK:
• CMS: ${competitorData.cms.cms} ${competitorData.cms.isCustom ? '⭐' : ''}
• Details: ${competitorData.cms.hints.join(', ') || '-'}
• Tech: ${competitorData.techStack.join(', ') || '-'}

✨ FEATURES: ${competitorData.features.join(', ') || 'keine erkannt'}

📑 UNTERSEITEN (Menü):
${competitorData.subpages.length > 0 ? competitorData.subpages.map(s => `• ${s.url} - "${s.title}" (~${s.wordCount} Wörter)`).join('\n') : '(keine gescraped)'}

📝 TEXT-AUSZUG:
"${competitorData.uniqueTexts.slice(0, 2).join(' ... ').slice(0, 400)}..."

══════════════════════════════════════════════════════════════════════════════
FORMATIERUNG (STRIKT - KEIN MARKDOWN!)
══════════════════════════════════════════════════════════════════════════════

NUR HTML mit Tailwind. Keine **, ##, * !

STYLING (kompakt, wenig Abstände):
- Überschrift: <h3 class="font-bold text-indigo-900 mt-4 mb-2 text-base flex items-center gap-2">TITEL</h3>
- Fließtext: <p class="mb-2 text-gray-600 text-sm leading-snug">TEXT</p>
- Info-Box: <div class="bg-blue-50 border border-blue-100 p-3 rounded-lg mb-3 text-sm">
- 2-Spalten Grid: <div class="grid grid-cols-2 gap-3 mb-3">
- Karte: <div class="bg-white p-3 rounded-lg border border-gray-200">
- Karten-Titel: <h4 class="font-bold text-gray-800 text-sm mb-2 pb-1 border-b border-gray-100">TITEL</h4>
- Badge CMS: <span class="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-medium">CMS</span>
- Badge Custom: <span class="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-medium">⭐ CUSTOM</span>
- Listen: <ul class="space-y-1 text-sm">
- Vorteil: <li class="flex items-start gap-1.5 text-gray-700"><span class="text-emerald-600 font-bold">✓</span><span>Text</span></li>
- Nachteil: <li class="flex items-start gap-1.5 text-gray-700"><span class="text-rose-500 font-bold">✗</span><span>Text</span></li>
- Feature: <li class="flex items-start gap-1.5 text-gray-700"><span class="text-purple-600">★</span><span>Text</span></li>
- Empfehlungs-Box: <div class="bg-indigo-600 text-white p-3 rounded-lg mt-3 text-sm">
- Subpage-Item: <div class="text-xs text-gray-500 py-1 border-b border-gray-50">📄 /pfad - Titel</div>

══════════════════════════════════════════════════════════════════════════════
ERSTELLE DIESEN REPORT (kompakt!):
══════════════════════════════════════════════════════════════════════════════

1. <h3>ℹ️ Übersicht</h3>
   Info-Box mit EINER Zeile pro Seite.
   Was ist die Seite? (z.B. "A: SEO-Agentur aus NÖ | B: Portfolio eines Webentwicklers")

2. <h3>🔧 Technologie</h3>
   2-Spalten Grid. Pro Seite eine Karte mit:
   - CMS (Badge) - Custom = Vorteil!
   - Tech-Stack (kurz)
   - 2-3 Sätze Bewertung

3. <h3>✨ Features</h3>
   2-Spalten Grid. Pro Seite eine Karte mit:
   - Liste aller Features (★ Items)
   - Kurze Erklärung der wichtigsten
   - Was fehlt?

4. <h3>📑 Seitenstruktur</h3>
   2-Spalten Grid. Pro Seite eine Karte mit:
   - Unterseiten aus dem Menü (Subpage-Items)
   - Bewertung der Struktur

5. <h3>💪 Stärken & Schwächen</h3>
   2-Spalten Grid. Pro Seite eine Karte mit:
   - 3-4 Stärken
   - 2-3 Schwächen 
   Sei FAIR! Custom-Entwicklung ist ein Vorteil!

6. <h3>🎯 Empfehlungen</h3>
   Empfehlungs-Box mit 3 konkreten Maßnahmen.
   Was kann verbessert werden?

Antworte NUR mit HTML. Kompakt, wenig Abstände!
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
