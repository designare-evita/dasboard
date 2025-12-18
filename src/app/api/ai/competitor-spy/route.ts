// src/app/api/ai/competitor-spy/route.ts
import { streamTextSafe } from '@/lib/ai-config';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES, getCompactStyleGuide } from '@/lib/ai-styles';

export const runtime = 'nodejs';
export const maxDuration = 300;

// ============================================================================
// TYPEN & INTERFACES
// ============================================================================

interface TechStats {
  pageSizeKb: number;
  hasSchema: boolean;
  imageAnalysis: {
    total: number;
    withAlt: number;
    modernFormats: number; // WebP, AVIF
    score: number; // 0-100
  };
  trustSignals: {
    hasImprint: boolean;
    hasPrivacy: boolean;
    hasContact: boolean;
  };
}

// ============================================================================
// FUNKTIONEN (Scraping & Detection)
// ============================================================================

function detectCMS(html: string, $: cheerio.CheerioAPI): { cms: string; confidence: string; hints: string[]; isCustom: boolean } {
  const hints: string[] = [];
  const htmlLower = html.toLowerCase();
  const cmsScores: Record<string, number> = {};
  
  if (htmlLower.includes('wp-content')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 3;
  if (htmlLower.includes('wp-includes')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 3;
  if ($('meta[name="generator"][content*="WordPress"]').length > 0) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 5;
  if (htmlLower.includes('/wp-json/')) cmsScores['WordPress'] = (cmsScores['WordPress'] || 0) + 2;
  
  if (htmlLower.includes('shopify')) cmsScores['Shopify'] = (cmsScores['Shopify'] || 0) + 5;
  if (htmlLower.includes('wix')) cmsScores['Wix'] = (cmsScores['Wix'] || 0) + 5;
  if (htmlLower.includes('squarespace')) cmsScores['Squarespace'] = (cmsScores['Squarespace'] || 0) + 5;
  if (htmlLower.includes('typo3')) cmsScores['TYPO3'] = (cmsScores['TYPO3'] || 0) + 5;
  if (htmlLower.includes('joomla')) cmsScores['Joomla'] = (cmsScores['Joomla'] || 0) + 5;

  let detectedCms = 'Unbekannt / Custom Code';
  let maxScore = 0;
  let isCustom = true;

  for (const [cms, score] of Object.entries(cmsScores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedCms = cms;
      isCustom = false;
    }
  }

  const confidence = maxScore >= 5 ? 'Hoch' : maxScore >= 2 ? 'Mittel' : 'Niedrig';
  return { cms: detectedCms, confidence, hints, isCustom };
}

function analyzeTech(html: string, $: cheerio.CheerioAPI): TechStats {
  // 1. Seitengröße (in KB) - Indikator für Ladezeit
  const pageSizeKb = Math.round((Buffer.byteLength(html, 'utf8') / 1024) * 100) / 100;

  // 2. Schema.org / JSON-LD Detection (Wichtig für SEO Verständnis)
  const hasSchema = $('script[type="application/ld+json"]').length > 0;

  // 3. Bilder Analyse
  const images = $('img');
  let withAlt = 0;
  let modernFormats = 0;

  images.each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt');
    
    // Alt-Tag Check
    if (alt && alt.trim().length > 0) withAlt++;
    
    // Format Check (WebP/AVIF)
    if (src.toLowerCase().match(/\.(webp|avif)(\?.*)?$/)) modernFormats++;
  });

  // Einfacher Score für Bilder
  const imgScore = images.length === 0 ? 100 : Math.round(((withAlt + modernFormats) / (images.length * 2)) * 100);

  // 4. Trust Signale (E-E-A-T Basics: Ist es eine echte Firma?)
  // Wir scannen alle Links nach typischen rechtlichen Begriffen
  const allLinkText = $('a').map((_, el) => $(el).text().toLowerCase()).get().join(' ');
  
  const hasImprint = /impressum|imprint|anbieterkennzeichnung/.test(allLinkText);
  const hasPrivacy = /datenschutz|privacy|datenschutzerklärung/.test(allLinkText);
  const hasContact = /kontakt|contact/.test(allLinkText);

  return {
    pageSizeKb,
    hasSchema,
    imageAnalysis: {
      total: images.length,
      withAlt,
      modernFormats,
      score: imgScore
    },
    trustSignals: { hasImprint, hasPrivacy, hasContact }
  };
}

async function scrapeContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      next: { revalidate: 3600 }
    });

    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);

    // 1. Tech-Analyse VOR dem Bereinigen durchführen (da wir hier noch Scripts etc brauchen)
    const techStats = analyzeTech(html, $);
    const cmsData = detectCMS(html, $);

    // 2. Unnötige Elemente entfernen für Content-Extraktion
    $('script, style, nav, footer, iframe, svg, noscript').remove();

    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const h1 = $('h1').map((_, el) => $(el).text().trim()).get().join(' | ');
    
    // 3. Content bereinigen
    let content = $('main').text().trim() || $('article').text().trim() || $('body').text().trim();
    content = content.replace(/\s+/g, ' ').substring(0, 8000);

    return { title, description, h1, content, cmsData, techStats };
  } catch (error) {
    console.error(`Fehler beim Scrapen von ${url}:`, error);
    return null;
  }
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('[Competitor Spy] Empfangener Body:', JSON.stringify(body, null, 2));
    
    const targetUrl = body.targetUrl || body.myUrl || body.url || body.target || body.siteUrl || body.domain;
    const competitorUrl = body.competitorUrl || body.competitor || body.compareUrl;
    const keywords = body.keywords || body.keyword || '';

    if (!targetUrl) {
      return NextResponse.json({ 
        message: 'Ziel-URL ist erforderlich',
        receivedFields: Object.keys(body),
        hint: 'Sende die URL als "targetUrl", "url" oder "target"'
      }, { status: 400 });
    }

    // URL validieren
    let normalizedUrl = targetUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // 1. Daten holen (Parallel für Performance)
    const [targetData, competitorData] = await Promise.all([
      scrapeContent(normalizedUrl),
      competitorUrl ? scrapeContent(competitorUrl) : Promise.resolve(null)
    ]);

    if (!targetData) {
      return NextResponse.json({ message: 'Konnte Ziel-URL nicht analysieren' }, { status: 400 });
    }

    // 2. Modus bestimmen
    const isCompareMode = !!(competitorUrl && competitorData);
    const compactStyles = getCompactStyleGuide();

    // 3. Prompt Vorbereitung (Daten in String wandeln)
    const formatTechSummary = (stats: TechStats) => `
      - HTML-Größe: ${stats.pageSizeKb} KB
      - Schema.org (JSON-LD): ${stats.hasSchema ? 'JA' : 'NEIN'}
      - Bilder: ${stats.imageAnalysis.total} total, davon modern (WebP/AVIF): ${stats.imageAnalysis.modernFormats}, mit Alt-Tag: ${stats.imageAnalysis.withAlt}.
      - Trust: ${stats.trustSignals.hasImprint ? 'Impressum da,' : 'Kein Impressum,'} ${stats.trustSignals.hasPrivacy ? 'Datenschutz da' : 'Kein Datenschutz'}.
    `;

    const basePrompt = `
      Du bist ein Elite-SEO-Analyst mit Fokus auf Technical SEO und E-E-A-T (Experience, Expertise, Authoritativeness, Trust).
      
      ZIEL-URL: ${normalizedUrl}
      TITEL: ${targetData.title}
      CMS: ${targetData.cmsData.cms}
      KEYWORDS: ${keywords || 'Nicht angegeben'}
      
      TECHNISCHE HARD-FACTS:
      ${formatTechSummary(targetData.techStats)}
      
      INHALT (Auszug):
      ${targetData.content.substring(0, 2000)}...
    `;

    // 4. Prompt Logik
    const singlePrompt = `
      ${basePrompt}
      
      AUFGABE:
      Erstelle eine technische und inhaltliche Tiefenanalyse. Sei kritisch.
      
      FORMAT:
      Nutze NUR HTML (kein Markdown). Nutze diese Tailwind-Klassen:
      ${compactStyles}
      
      STRUKTUR:
      1. <div class="${STYLES.card}">
         <h3 class="${STYLES.h3}"><i class="bi bi-cpu"></i> Tech & Performance Check</h3>
         <div class="grid grid-cols-2 gap-4 text-sm">
           <div>
             <strong>HTML-Größe:</strong> ${targetData.techStats.pageSizeKb} KB<br>
             <span class="text-xs text-gray-500">${targetData.techStats.pageSizeKb > 100 ? '⚠️ Eher groß (Code Bloat?)' : '✅ Schlank'}</span>
           </div>
           <div>
             <strong>Bilder-Optimierung:</strong> 
             ${targetData.techStats.imageAnalysis.modernFormats > 0 ? '✅ WebP/AVIF genutzt' : '❌ Veraltete Formate'}
           </div>
           <div>
             <strong>Schema.org:</strong> 
             ${targetData.techStats.hasSchema ? '<span class="text-green-600">✅ Vorhanden</span>' : '<span class="text-red-500">❌ Fehlt (Wichtig!)</span>'}
           </div>
           <div>
            <strong>Tech-Stack:</strong> ${targetData.cmsData.cms}
           </div>
         </div>
      </div>

      2. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-journal-check"></i> E-E-A-T & Qualität</h3>
         <ul class="${STYLES.list}">
           <li>
             <strong>Trust-Signale:</strong> 
             ${targetData.techStats.trustSignals.hasImprint && targetData.techStats.trustSignals.hasPrivacy ? '✅ Rechtliche Pflichtseiten gefunden' : '⚠️ Impressum/Datenschutz nicht eindeutig erkannt'}
           </li>
           <li>
             <strong>Einzigartigkeit:</strong> 
             [Analysiere hier: Wirkt der Text generisch/KI-geschrieben oder bietet er echte Insights? Gib eine Einschätzung.]
           </li>
           <li>
             <strong>Expertise:</strong> 
             [Analysiere: Wird klar, wer hier spricht? Gibt es Autoren-Hinweise oder "Wir"-Sprache?]
           </li>
         </ul>
      </div>

      3. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-lightbulb"></i> Sofort-Maßnahmen</h3>
         Nenne 3 konkrete Verbesserungen (Mix aus Technik und Content).
      </div>
      
      Antworte NUR mit HTML.
    `;

    const comparePrompt = `
      ${basePrompt}
      
      VERGLEICH MIT WETTBEWERBER:
      URL: ${competitorUrl}
      TITEL: ${competitorData?.title}
      CMS: ${competitorData?.cmsData.cms}
      
      TECHNISCHE HARD-FACTS (WETTBEWERBER):
      ${competitorData ? formatTechSummary(competitorData.techStats) : 'Keine Daten'}
      
      INHALT WETTBEWERBER (Auszug):
      ${competitorData?.content.substring(0, 2000)}...

      AUFGABE:
      Analysiere die Wettbewerbslücke (Gap Analysis). Warum rankt der Gegner besser? 
      Vergleiche Technik (Ladezeit-Indikatoren, Modernität) und Content-Qualität (E-E-A-T).

      FORMAT:
      Nutze NUR HTML (kein Markdown). Nutze diese Tailwind-Klassen:
      ${compactStyles}

      STRUKTUR:
      1. <div class="${STYLES.grid2} gap-4 mb-4">
           <div class="${STYLES.card}">
             <h4 class="${STYLES.h4} text-gray-500">Meine Seite</h4>
             <div class="text-2xl font-bold mb-2 text-indigo-600">${targetData.techStats.pageSizeKb} KB</div>
             <div class="text-sm space-y-1">
               <div>CMS: ${targetData.cmsData.cms}</div>
               <div>Schema: ${targetData.techStats.hasSchema ? '✅' : '❌'}</div>
               <div>Moderne Bilder: ${targetData.techStats.imageAnalysis.modernFormats > 0 ? '✅' : '❌'}</div>
             </div>
           </div>
           
           <div class="${STYLES.card} border-indigo-100 bg-indigo-50">
             <h4 class="${STYLES.h4} text-gray-500">Wettbewerber</h4>
             <div class="text-2xl font-bold mb-2 text-indigo-600">${competitorData?.techStats.pageSizeKb} KB</div>
             <div class="text-sm space-y-1">
               <div>CMS: ${competitorData?.cmsData.cms}</div>
               <div>Schema: ${competitorData?.techStats.hasSchema ? '✅' : '❌'}</div>
               <div>Moderne Bilder: ${competitorData?.techStats.imageAnalysis.modernFormats ? '✅' : '❌'}</div>
             </div>
           </div>
         </div>

      2. <div class="${STYLES.card}">
           <h3 class="${STYLES.h3}"><i class="bi bi-trophy"></i> Tech & Content Gap</h3>
           <p>Analysiere die Unterschiede in den obigen Daten und im Textinhalt:</p>
           <ul class="${STYLES.list} mt-2">
             <li><strong>Technik-Vorteil:</strong> Wer hat die modernere Basis (WebP, Schema, Code-Größe)?</li>
             <li><strong>Content-Tiefe (E-E-A-T):</strong> Wer wirkt vertrauenswürdiger und warum? (Vergleiche Länge, Ansprache, Expertise).</li>
             <li><strong>Keyword-Fokus:</strong> Nutzt der Wettbewerber den Platz im Title/H1 besser?</li>
           </ul>
      </div>

      3. <div class="${STYLES.card} mt-4">
           <h3 class="${STYLES.h3}"><i class="bi bi-rocket-takeoff"></i> Attacke-Plan</h3>
           Wie können wir ihn technisch UND inhaltlich überholen? 3 aggressive Strategien.
      </div>

      Antworte NUR mit HTML.
    `;

    const finalPrompt = isCompareMode ? comparePrompt : singlePrompt;

    const result = await streamTextSafe({
      prompt: finalPrompt,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ Competitor Spy Error:', errorMessage);
    return NextResponse.json(
      { message: 'Analyse fehlgeschlagen', error: errorMessage },
      { status: 500 }
    );
  }
}
