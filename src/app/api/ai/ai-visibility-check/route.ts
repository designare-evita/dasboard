// src/app/api/ai/ai-visibility-check/route.ts
import { streamText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { STYLES, getCompactStyleGuide } from '@/lib/ai-styles';
import { google, AI_CONFIG } from '@/lib/ai-config';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 Minuten für mehrere API-Calls

// ============================================================================
// TYPEN
// ============================================================================

interface VisibilityTestResult {
  query: string;
  mentioned: boolean;
  sentiment: 'positive' | 'neutral' | 'negative' | 'not_found';
  excerpt: string;
  competitors: string[];
}

interface DomainAnalysis {
  hasSchema: boolean;
  schemaTypes: string[];
  hasAboutPage: boolean;
  hasContactPage: boolean;
  hasAuthorInfo: boolean;
  contentQuality: 'high' | 'medium' | 'low';
  estimatedAuthority: number; // 0-100
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Extrahiert die Domain aus einer URL
 */
function extractDomain(url: string): string {
  try {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const urlObj = new URL(cleanUrl);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

/**
 * Crawlt die Website und analysiert KI-relevante Faktoren
 */
async function analyzeDomainForAI(url: string): Promise<DomainAnalysis> {
  const result: DomainAnalysis = {
    hasSchema: false,
    schemaTypes: [],
    hasAboutPage: false,
    hasContactPage: false,
    hasAuthorInfo: false,
    contentQuality: 'medium',
    estimatedAuthority: 50,
  };

  try {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIVisibilityChecker/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return result;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Schema.org JSON-LD prüfen
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        result.hasSchema = true;
        
        // Schema-Typen extrahieren
        if (json['@type']) {
          result.schemaTypes.push(json['@type']);
        }
        if (json['@graph']) {
          json['@graph'].forEach((item: any) => {
            if (item['@type'] && !result.schemaTypes.includes(item['@type'])) {
              result.schemaTypes.push(item['@type']);
            }
          });
        }
      } catch {}
    });

    // Links auf About/Kontakt Seiten prüfen
    const links = $('a').map((_, el) => $(el).attr('href')?.toLowerCase() || '').get();
    result.hasAboutPage = links.some(l => 
      l.includes('/about') || l.includes('/ueber-uns') || l.includes('/unternehmen') || l.includes('/team')
    );
    result.hasContactPage = links.some(l => 
      l.includes('/contact') || l.includes('/kontakt') || l.includes('/impressum')
    );

    // Autor-Infos prüfen
    result.hasAuthorInfo = 
      $('[rel="author"]').length > 0 ||
      $('[class*="author"]').length > 0 ||
      $('[itemprop="author"]').length > 0 ||
      result.schemaTypes.includes('Person') ||
      result.schemaTypes.includes('Author');

    // Content-Qualität schätzen (vereinfacht)
    const textLength = $('body').text().replace(/\s+/g, ' ').trim().length;
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const imgCount = $('img').length;

    if (textLength > 3000 && h2Count >= 3 && imgCount >= 2) {
      result.contentQuality = 'high';
    } else if (textLength > 1000 && h2Count >= 1) {
      result.contentQuality = 'medium';
    } else {
      result.contentQuality = 'low';
    }

    // Authority Score berechnen (vereinfacht)
    let score = 50;
    if (result.hasSchema) score += 15;
    if (result.schemaTypes.length >= 3) score += 10;
    if (result.hasAboutPage) score += 5;
    if (result.hasContactPage) score += 5;
    if (result.hasAuthorInfo) score += 10;
    if (result.contentQuality === 'high') score += 10;
    if (result.contentQuality === 'low') score -= 15;
    
    result.estimatedAuthority = Math.min(100, Math.max(0, score));

  } catch (error) {
    console.error('[AI Visibility] Domain Analysis Error:', error);
  }

  return result;
}

/**
 * Führt einen einzelnen KI-Sichtbarkeitstest durch
 */
async function testVisibilityWithGemini(
  domain: string, 
  query: string,
  branche: string
): Promise<VisibilityTestResult> {
  const result: VisibilityTestResult = {
    query,
    mentioned: false,
    sentiment: 'not_found',
    excerpt: '',
    competitors: [],
  };

  try {
    // Gemini API direkt aufrufen für strukturierte Antwort
    const { generateText } = await import('ai');
    
    const response = await generateText({
      model: google(AI_CONFIG.fallbackModel),
      prompt: `${query}

WICHTIG: Antworte natürlich und hilfreich auf die Frage. Wenn du konkrete Empfehlungen oder Webseiten kennst, nenne sie.`,
      temperature: 0.3,
    });

    const text = response.text.toLowerCase();
    const domainLower = domain.toLowerCase();

    // Prüfen ob Domain erwähnt wird
    result.mentioned = text.includes(domainLower) || 
                       text.includes(domainLower.replace('.', ' ')) ||
                       text.includes(domainLower.split('.')[0]);

    if (result.mentioned) {
      // Sentiment analysieren
      const positiveWords = ['empfehle', 'gut', 'vertrauenswürdig', 'seriös', 'qualität', 'erfahren', 'professionell'];
      const negativeWords = ['vorsicht', 'warnung', 'unseriös', 'schlecht', 'negativ', 'kritik'];
      
      const hasPositive = positiveWords.some(w => text.includes(w));
      const hasNegative = negativeWords.some(w => text.includes(w));
      
      if (hasPositive && !hasNegative) result.sentiment = 'positive';
      else if (hasNegative) result.sentiment = 'negative';
      else result.sentiment = 'neutral';
      
      // Excerpt extrahieren
      const domainIndex = text.indexOf(domainLower);
      if (domainIndex !== -1) {
        const start = Math.max(0, domainIndex - 50);
        const end = Math.min(text.length, domainIndex + domainLower.length + 100);
        result.excerpt = '...' + response.text.substring(start, end) + '...';
      }
    }

    // Konkurrenten extrahieren (URLs/Domains in der Antwort)
    const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(?:\/[^\s]*)?/g;
    const matches = response.text.match(urlRegex) || [];
    result.competitors = matches
      .map(m => m.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0])
      .filter(d => d !== domain && d.length > 3)
      .slice(0, 5);

  } catch (error) {
    console.error('[AI Visibility] Gemini Test Error:', error);
    result.excerpt = 'Fehler bei der Abfrage';
  }

  return result;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // Auth Check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    const { role } = session.user;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert' }, { status: 403 });
    }

    const { domain, branche } = await req.json();

    if (!domain) {
      return NextResponse.json({ message: 'Domain ist erforderlich' }, { status: 400 });
    }

    const cleanDomain = extractDomain(domain);
    const brancheText = branche || 'allgemein';

    console.log(`[AI Visibility] Starte Check für: ${cleanDomain} (${brancheText})`);

    // 1. Domain-Analyse (Crawling)
    const domainAnalysis = await analyzeDomainForAI(domain);
    console.log('[AI Visibility] Domain Analysis:', domainAnalysis);

    // 2. Test-Queries generieren
    const testQueries = [
      `Was weißt du über ${cleanDomain}?`,
      `Welche Anbieter für ${brancheText} kannst du empfehlen?`,
      `Ist ${cleanDomain} vertrauenswürdig?`,
      `Nenne mir die besten Webseiten für ${brancheText}`,
    ];

    // 3. Visibility Tests durchführen (parallel)
    const testResults = await Promise.all(
      testQueries.map(q => testVisibilityWithGemini(cleanDomain, q, brancheText))
    );

    console.log('[AI Visibility] Test Results:', testResults.map(r => ({ query: r.query, mentioned: r.mentioned })));

    // 4. Gesamt-Score berechnen
    const mentionCount = testResults.filter(r => r.mentioned).length;
    const mentionRate = (mentionCount / testResults.length) * 100;
    
    // Gewichteter Score
    let visibilityScore = 0;
    visibilityScore += mentionRate * 0.5; // 50% Gewicht für Erwähnungen
    visibilityScore += domainAnalysis.estimatedAuthority * 0.3; // 30% für technische Faktoren
    visibilityScore += (domainAnalysis.hasSchema ? 20 : 0) * 0.2; // 20% für Schema
    visibilityScore = Math.round(Math.min(100, visibilityScore));

    // Alle Konkurrenten sammeln
    const allCompetitors = [...new Set(testResults.flatMap(r => r.competitors))].slice(0, 8);

    // 5. Report mit Gemini generieren
    const reportDate = new Date().toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Score-Kategorie bestimmen
    let scoreCategory: { label: string; color: string; icon: string; bgColor: string };
    if (visibilityScore >= 70) {
      scoreCategory = { label: 'Gut sichtbar', color: 'text-emerald-600', icon: 'bi-check-circle-fill', bgColor: 'bg-emerald-50 border-emerald-200' };
    } else if (visibilityScore >= 40) {
      scoreCategory = { label: 'Ausbaufähig', color: 'text-amber-600', icon: 'bi-exclamation-circle-fill', bgColor: 'bg-amber-50 border-amber-200' };
    } else {
      scoreCategory = { label: 'Nicht sichtbar', color: 'text-rose-600', icon: 'bi-x-circle-fill', bgColor: 'bg-rose-50 border-rose-200' };
    }

    // Test-Ergebnisse HTML
    const testResultsHTML = testResults.map((r, i) => {
      const statusIcon = r.mentioned 
        ? '<i class="bi bi-check-circle-fill text-emerald-500"></i>' 
        : '<i class="bi bi-x-circle-fill text-rose-400"></i>';
      const statusText = r.mentioned 
        ? `<span class="text-emerald-600 font-medium">Erwähnt (${r.sentiment})</span>` 
        : '<span class="text-gray-400">Nicht erwähnt</span>';
      
      return `
        <div class="${STYLES.subpageItem} ${STYLES.flexStart} py-3">
          <div class="shrink-0">${statusIcon}</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">"${r.query}"</p>
            <p class="text-xs mt-0.5">${statusText}</p>
            ${r.excerpt ? `<p class="text-xs text-gray-500 mt-1 italic line-clamp-2">${r.excerpt}</p>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Schema-Status HTML
    const schemaHTML = domainAnalysis.hasSchema
      ? `<div class="${STYLES.flexCenter} text-emerald-600"><i class="bi bi-check-circle-fill"></i> <span class="text-sm">${domainAnalysis.schemaTypes.slice(0, 4).join(', ')}</span></div>`
      : `<div class="${STYLES.flexCenter} text-rose-500"><i class="bi bi-x-circle-fill"></i> <span class="text-sm">Kein Schema gefunden</span></div>`;

    // Konkurrenten HTML
    const competitorsHTML = allCompetitors.length > 0
      ? allCompetitors.map(c => `<span class="${STYLES.tagAmber}">${c}</span>`).join(' ')
      : '<span class="text-gray-400 text-sm italic">Keine Konkurrenten identifiziert</span>';

    // Report Prompt
    const reportPrompt = `Du bist ein HTML-Generator. Erstelle einen KI-Sichtbarkeits-Report.

${getCompactStyleGuide()}

ANALYSIERTE DATEN:
- Domain: ${cleanDomain}
- Branche: ${brancheText}
- Visibility Score: ${visibilityScore}/100
- Kategorie: ${scoreCategory.label}
- Erwähnungsrate: ${mentionRate.toFixed(0)}% (${mentionCount} von ${testResults.length} Tests)
- Schema vorhanden: ${domainAnalysis.hasSchema ? 'Ja' : 'Nein'}
- Schema-Typen: ${domainAnalysis.schemaTypes.join(', ') || 'keine'}
- About-Seite: ${domainAnalysis.hasAboutPage ? 'Ja' : 'Nein'}
- Kontakt-Seite: ${domainAnalysis.hasContactPage ? 'Ja' : 'Nein'}
- Autor-Infos: ${domainAnalysis.hasAuthorInfo ? 'Ja' : 'Nein'}
- Content-Qualität: ${domainAnalysis.contentQuality}
- Authority Score: ${domainAnalysis.estimatedAuthority}/100
- Konkurrenten in KI-Antworten: ${allCompetitors.join(', ') || 'keine'}

GENERIERE DIESES HTML (beginne direkt mit <div>):

<div class="${STYLES.container}">

<!-- HEADER -->
<div class="${STYLES.cardHeader} flex items-center justify-between">
  <div>
    <p class="text-indigo-200 text-[10px] uppercase tracking-wider font-medium"><i class="bi bi-robot"></i> KI-Sichtbarkeits-Audit</p>
    <h2 class="text-lg font-bold mt-0.5">${cleanDomain}</h2>
    <p class="text-indigo-200 text-xs mt-1">Branche: ${brancheText}</p>
  </div>
  <div class="text-right">
    <div class="text-3xl font-black text-white">${visibilityScore}</div>
    <div class="text-[10px] text-indigo-200 uppercase">Score</div>
  </div>
</div>

<!-- SCORE CARD -->
<div class="${scoreCategory.bgColor} border rounded-xl p-4 ${STYLES.flexCenter} justify-between">
  <div class="${STYLES.flexCenter}">
    <i class="${scoreCategory.icon} ${scoreCategory.color} text-xl"></i>
    <div>
      <p class="font-bold ${scoreCategory.color}">${scoreCategory.label}</p>
      <p class="text-xs text-gray-600">${mentionCount} von ${testResults.length} KI-Tests erfolgreich</p>
    </div>
  </div>
  <div class="text-right">
    <div class="text-2xl font-bold ${scoreCategory.color}">${mentionRate.toFixed(0)}%</div>
    <div class="text-[10px] text-gray-500 uppercase">Erwähnungsrate</div>
  </div>
</div>

<!-- METRIKEN -->
<div class="${STYLES.grid4}">
  <div class="${STYLES.metricCard}">
    <div class="${STYLES.metricValue} ${domainAnalysis.hasSchema ? 'text-emerald-600' : 'text-rose-500'}">${domainAnalysis.hasSchema ? '✓' : '✗'}</div>
    <div class="${STYLES.metricLabel}">Schema</div>
  </div>
  <div class="${STYLES.metricCard}">
    <div class="${STYLES.metricValue} ${domainAnalysis.hasAuthorInfo ? 'text-emerald-600' : 'text-rose-500'}">${domainAnalysis.hasAuthorInfo ? '✓' : '✗'}</div>
    <div class="${STYLES.metricLabel}">E-E-A-T</div>
  </div>
  <div class="${STYLES.metricCard}">
    <div class="${STYLES.metricValue}">${domainAnalysis.estimatedAuthority}</div>
    <div class="${STYLES.metricLabel}">Authority</div>
  </div>
  <div class="${STYLES.metricCard}">
    <div class="${STYLES.metricValue} ${domainAnalysis.contentQuality === 'high' ? 'text-emerald-600' : domainAnalysis.contentQuality === 'low' ? 'text-rose-500' : 'text-amber-500'}">${domainAnalysis.contentQuality === 'high' ? 'A' : domainAnalysis.contentQuality === 'medium' ? 'B' : 'C'}</div>
    <div class="${STYLES.metricLabel}">Content</div>
  </div>
</div>

<!-- TEST-ERGEBNISSE -->
<div class="${STYLES.card}">
  <h4 class="${STYLES.h4}"><i class="bi bi-list-check ${STYLES.iconIndigo}"></i> Gemini Test-Ergebnisse</h4>
  <div class="divide-y divide-gray-100">
    ${testResultsHTML}
  </div>
</div>

<!-- SCHEMA STATUS -->
<div class="${STYLES.card}">
  <h4 class="${STYLES.h4}"><i class="bi bi-code-slash ${STYLES.iconIndigo}"></i> Strukturierte Daten (Schema.org)</h4>
  ${schemaHTML}
  ${!domainAnalysis.hasSchema ? `
  <div class="${STYLES.warningBox} mt-3">
    <p class="${STYLES.pSmall}"><i class="bi bi-exclamation-triangle"></i> <strong>Wichtig:</strong> Ohne Schema.org Markup ist es für KI-Systeme schwerer, den Inhalt zu verstehen und zu zitieren.</p>
  </div>
  ` : ''}
</div>

<!-- KONKURRENTEN -->
${allCompetitors.length > 0 ? `
<div class="${STYLES.card}">
  <h4 class="${STYLES.h4}"><i class="bi bi-people ${STYLES.iconIndigo}"></i> Konkurrenten in KI-Antworten</h4>
  <p class="${STYLES.pSmall} mb-3">Diese Domains werden von Gemini bei Fragen zu "${brancheText}" erwähnt:</p>
  <div class="flex flex-wrap gap-2">
    ${competitorsHTML}
  </div>
</div>
` : ''}

<!-- EMPFEHLUNGEN -->
<div class="${STYLES.recommendBox}">
  <h4 class="font-semibold text-white mb-3"><i class="bi bi-lightbulb-fill"></i> Top 3 Empfehlungen für bessere KI-Sichtbarkeit</h4>
  <div class="${STYLES.listCompact}">
    [GENERIERE 3 konkrete, priorisierte Empfehlungen basierend auf den Analysedaten. Format:
    <div class="${STYLES.flexCenter} bg-white/10 rounded-lg p-2 mb-2">
      <span class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white shrink-0">1</span>
      <span class="text-sm text-indigo-100">Empfehlung hier</span>
    </div>]
  </div>
</div>

<!-- E-E-A-T CHECK -->
<div class="${STYLES.card}">
  <h4 class="${STYLES.h4}"><i class="bi bi-shield-check ${STYLES.iconIndigo}"></i> E-E-A-T Signale (Experience, Expertise, Authority, Trust)</h4>
  <div class="space-y-2">
    <div class="${STYLES.flexCenter} justify-between py-2 border-b border-gray-100">
      <span class="text-sm text-gray-700">About/Team-Seite</span>
      <span class="${domainAnalysis.hasAboutPage ? 'text-emerald-600' : 'text-rose-500'}">${domainAnalysis.hasAboutPage ? '<i class="bi bi-check-circle-fill"></i> Vorhanden' : '<i class="bi bi-x-circle-fill"></i> Fehlt'}</span>
    </div>
    <div class="${STYLES.flexCenter} justify-between py-2 border-b border-gray-100">
      <span class="text-sm text-gray-700">Kontakt/Impressum</span>
      <span class="${domainAnalysis.hasContactPage ? 'text-emerald-600' : 'text-rose-500'}">${domainAnalysis.hasContactPage ? '<i class="bi bi-check-circle-fill"></i> Vorhanden' : '<i class="bi bi-x-circle-fill"></i> Fehlt'}</span>
    </div>
    <div class="${STYLES.flexCenter} justify-between py-2">
      <span class="text-sm text-gray-700">Autor-Informationen</span>
      <span class="${domainAnalysis.hasAuthorInfo ? 'text-emerald-600' : 'text-rose-500'}">${domainAnalysis.hasAuthorInfo ? '<i class="bi bi-check-circle-fill"></i> Vorhanden' : '<i class="bi bi-x-circle-fill"></i> Fehlt'}</span>
    </div>
  </div>
</div>

<!-- FAZIT -->
<div class="${visibilityScore >= 70 ? STYLES.fazitPositive : visibilityScore >= 40 ? STYLES.fazitWarning : STYLES.fazitNegative}">
  <div class="${STYLES.flexStart}">
    <i class="bi ${visibilityScore >= 70 ? 'bi-trophy-fill text-emerald-600' : visibilityScore >= 40 ? 'bi-exclamation-triangle-fill text-amber-600' : 'bi-exclamation-octagon-fill text-rose-600'} text-xl"></i>
    <div>
      <p class="font-bold text-sm ${visibilityScore >= 70 ? 'text-emerald-800' : visibilityScore >= 40 ? 'text-amber-800' : 'text-rose-800'}">[GENERIERE Fazit-Titel basierend auf Score ${visibilityScore}]</p>
      <p class="${STYLES.pSmall} ${visibilityScore >= 70 ? 'text-emerald-700' : visibilityScore >= 40 ? 'text-amber-700' : 'text-rose-700'}">[GENERIERE 1-2 Sätze Fazit mit konkretem Ausblick]</p>
    </div>
  </div>
</div>

<!-- FOOTER -->
<p class="${STYLES.footer}"><i class="bi bi-robot"></i> KI-Sichtbarkeits-Check · Powered by Gemini · ${reportDate}</p>

</div>

Ersetze alle [GENERIERE...] Platzhalter mit echtem, relevantem Content basierend auf den Analysedaten!
Beginne JETZT mit <div class="${STYLES.container}">:`;

    // Stream Response
    const result = streamText({
      model: google(AI_CONFIG.fallbackModel),
      prompt: reportPrompt,
      temperature: 0.4,
    });

    return result.toTextStreamResponse({
      headers: {
        'X-Visibility-Score': visibilityScore.toString(),
        'X-Mention-Rate': mentionRate.toFixed(0),
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('❌ AI Visibility Check Error:', error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
