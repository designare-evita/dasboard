// src/app/api/ai/competitor-spy/route.ts
import { streamTextSafe } from '@/lib/ai-config';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES, getCompactStyleGuide } from '@/lib/ai-styles';

export const runtime = 'nodejs';
export const maxDuration = 300;

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

    $('script, style, nav, footer, iframe, svg, noscript').remove();

    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const h1 = $('h1').map((_, el) => $(el).text().trim()).get().join(' | ');
    
    let content = $('main').text().trim() || $('article').text().trim() || $('body').text().trim();
    content = content.replace(/\s+/g, ' ').substring(0, 8000);

    const cmsData = detectCMS(html, $);

    return { title, description, h1, content, cmsData };
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
    
    // DEBUG: Logge den empfangenen Body
    console.log('[Competitor Spy] Empfangener Body:', JSON.stringify(body, null, 2));
    
    // FIX: Akzeptiere verschiedene Feldnamen für die URL
    const targetUrl = body.targetUrl || body.url || body.target || body.siteUrl || body.domain;
    const competitorUrl = body.competitorUrl || body.competitor || body.compareUrl;
    const keywords = body.keywords || body.keyword || '';

    // DEBUG: Logge die extrahierten Werte
    console.log('[Competitor Spy] Extrahierte Werte:', { targetUrl, competitorUrl, keywords });

    if (!targetUrl) {
      console.error('[Competitor Spy] Keine URL gefunden in Body:', Object.keys(body));
      return NextResponse.json({ 
        message: 'Ziel-URL ist erforderlich',
        receivedFields: Object.keys(body),
        hint: 'Sende die URL als "targetUrl", "url" oder "target"'
      }, { status: 400 });
    }

    // URL validieren und ggf. Protokoll hinzufügen
    let normalizedUrl = targetUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // 1. Daten holen
    const [targetData, competitorData] = await Promise.all([
      scrapeContent(normalizedUrl),
      competitorUrl ? scrapeContent(competitorUrl) : Promise.resolve(null)
    ]);

    if (!targetData) {
      return NextResponse.json({ message: 'Konnte Ziel-URL nicht analysieren' }, { status: 400 });
    }

    // 2. Modus bestimmen (Einzelanalyse vs. Vergleich)
    const isCompareMode = !!(competitorUrl && competitorData);
    const compactStyles = getCompactStyleGuide();

    // 3. Prompts bauen
    const basePrompt = `
      Du bist ein Elite-SEO-Analyst. Analysiere die Webseite(n) strategisch.
      
      ZIEL-URL: ${normalizedUrl}
      TITEL: ${targetData.title}
      CMS: ${targetData.cmsData.cms}
      KEYWORDS: ${keywords || 'Nicht angegeben'}
      
      INHALT (Auszug):
      ${targetData.content.substring(0, 2000)}...
    `;

    const singlePrompt = `
      ${basePrompt}
      
      AUFGABE:
      Erstelle eine gnadenlose Kurzanalyse der Seite.
      
      FORMAT:
      Nutze NUR HTML (kein Markdown). Nutze diese Tailwind-Klassen für Styling:
      ${compactStyles}
      
      STRUKTUR:
      1. <div class="${STYLES.card}">
         <h3 class="${STYLES.h3}"><i class="bi bi-speedometer2"></i> Quick Check</h3>
         <ul class="${STYLES.list}">
           <li><strong>Titel:</strong> ${targetData.title.length > 60 ? '⚠️ Zu lang' : '✅ Optimal'}</li>
           <li><strong>H1:</strong> ${targetData.h1 ? '✅ Vorhanden' : '❌ Fehlt'}</li>
           <li><strong>Tech-Stack:</strong> ${targetData.cmsData.cms} (${targetData.cmsData.isCustom ? 'Individuell' : 'Standard'})</li>
         </ul>
      </div>

      2. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-shield-exclamation"></i> Schwachstellen</h3>
         Finde 3 kritische Fehler im Content oder der Struktur, die Rankings verhindern.
         Formatiere als Liste mit <i class="bi bi-x-circle text-red-500"></i>.
      </div>

      3. <div class="${STYLES.card} mt-4">
         <h3 class="${STYLES.h3}"><i class="bi bi-lightbulb"></i> Sofort-Maßnahmen</h3>
         3 konkrete Handlungsempfehlungen.
      </div>
      
      Antworte NUR mit HTML.
    `;

    const comparePrompt = `
      ${basePrompt}
      
      VERGLEICH MIT WETTBEWERBER:
      URL: ${competitorUrl}
      TITEL: ${competitorData?.title}
      CMS: ${competitorData?.cmsData.cms}
      INHALT (Auszug):
      ${competitorData?.content.substring(0, 2000)}...

      AUFGABE:
      Warum rankt der Wettbewerber vielleicht besser? Finde die "Unfair Advantages".

      FORMAT:
      Nutze NUR HTML (kein Markdown). Nutze diese Tailwind-Klassen:
      ${compactStyles}

      STRUKTUR:
      1. <div class="${STYLES.grid2} gap-4 mb-4">
           <div class="${STYLES.card}">
             <h4 class="${STYLES.h4}">Meine Seite</h4>
             <div class="text-sm">CMS: ${targetData.cmsData.cms}</div>
             <div class="text-xs text-gray-500">${targetData.title.substring(0, 40)}...</div>
           </div>
           <div class="${STYLES.card} border-indigo-100 bg-indigo-50">
             <h4 class="${STYLES.h4}">Wettbewerber</h4>
             <div class="text-sm">CMS: ${competitorData?.cmsData.cms}</div>
             <div class="text-xs text-gray-500">${competitorData?.title.substring(0, 40)}...</div>
           </div>
         </div>

      2. <div class="${STYLES.card}">
           <h3 class="${STYLES.h3}"><i class="bi bi-trophy"></i> Wo der Gegner gewinnt</h3>
           Analysiere Content-Tiefe, Keyword-Fokus und Struktur. Nenne 3 Punkte, die der Gegner besser macht.
      </div>

      3. <div class="${STYLES.card} mt-4">
           <h3 class="${STYLES.h3}"><i class="bi bi-rocket-takeoff"></i> Attacke-Plan</h3>
           Wie können wir ihn überholen? 3 aggressive Strategien für ${targetData.cmsData.cms}.
      </div>
      
      4. <div class="${STYLES.warningBox} mt-4">
           <i class="bi bi-info-circle"></i> <strong>Insight:</strong> Ein kurzer strategischer Satz zur CMS-Situation (z.B. wenn Gegner WordPress hat und wir Custom Code).
      </div>

      Antworte NUR mit HTML. Kompakt!
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
