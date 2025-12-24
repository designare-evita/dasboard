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

// NEU: SEO Basics Interface
interface SeoBasics {
  hasViewport: boolean;
  hasCharset: boolean;
  hasLanguage: boolean;
  language: string | null;
}

// NEU: Canonical & Indexierungs-Interface
interface IndexingSignals {
  canonical: string | null;
  canonicalMatchesUrl: boolean;
  robotsMeta: string | null;
  isIndexable: boolean;
  hreflang: { lang: string; url: string }[];
  pagination: { prev: string | null; next: string | null };
}

// NEU: Content-Metriken Interface
interface ContentMetrics {
  wordCount: number;
  readingTimeMin: number;
  paragraphCount: number;
  avgWordsPerParagraph: number;
  thinContent: boolean;
  hasTableOfContents: boolean;
  contentDepthScore: number; // 0-100
}

// NEU: Open Graph & Social Interface
interface SocialMeta {
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
    type: string | null;
    url: string | null;
  };
  twitter: {
    card: string | null;
    site: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
  };
  hasSocialProfiles: boolean;
  socialProfileLinks: string[];
}

// NEU: GEO (Generative Engine Optimization) Interface
interface GeoSignals {
  // Entitäts-Klarheit
  entityClarity: {
    schemaTypes: string[];
    hasOrganizationSchema: boolean;
    hasPersonSchema: boolean;
    hasArticleSchema: boolean;
    hasFaqSchema: boolean;
    hasHowToSchema: boolean;
    hasBreadcrumbSchema: boolean;
    hasProductSchema: boolean;
    hasLocalBusinessSchema: boolean;
    sameAsLinks: string[];
  };
  // Zitierbarkeit für LLMs
  citability: {
    hasDefinitions: boolean;
    hasFaqStructure: boolean;
    hasHowToStructure: boolean;
    hasNumberedLists: boolean;
    hasBulletLists: boolean;
    hasDataTables: boolean;
    hasStatistics: boolean;
    hasCitations: boolean;
    hasQuotes: boolean;
    citabilityScore: number; // 0-100
  };
  // Fakten & Expertise
  factualSignals: {
    hasOriginalData: boolean;
    hasExpertQuotes: boolean;
    hasFirstPersonExpertise: boolean;
    hasSourceReferences: boolean;
    hasLastUpdated: boolean;
  };
  // Content-Struktur für LLM-Extraktion
  llmReadability: {
    hasSummary: boolean;
    hasKeyTakeaways: boolean;
    hasClearTopicSentences: boolean;
    hasInfographics: boolean;
    questionCount: number;
    answerPatternCount: number;
  };
  // Gesamt GEO Score
  geoScore: number; // 0-100
  geoRating: 'Exzellent' | 'Gut' | 'Mittel' | 'Verbesserungswürdig';
}

// NEU: Performance-Erweiterung
interface PerformanceMetrics {
  ttfbMs: number;
  rating: 'Schnell' | 'Mittel' | 'Langsam';
  htmlSizeKb: number;
  resourceHints: {
    preconnect: number;
    prefetch: number;
    preload: number;
    dnsPrefetch: number;
  };
  hasCriticalCss: boolean;
  renderBlockingScripts: number;
  asyncScripts: number;
  deferScripts: number;
}

interface TechStats {
  pageSizeKb: number;
  // ERWEITERT: Performance Metrik
  performance: PerformanceMetrics;
  hasSchema: boolean;
  // NEU: Schema Details
  schemaDetails: {
    types: string[];
    hasMultipleSchemas: boolean;
    rawSchemas: object[];
  };
  // Struktur Metriken (unverändert)
  structure: {
    headings: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number };
    hasMainH1: boolean;
    headingHierarchyValid: boolean;
    h1Text: string[];
  };
  imageAnalysis: {
    total: number;
    withAlt: number;
    withEmptyAlt: number;
    modernFormats: number;
    lazyLoaded: number;
    score: number;
  };
  trustSignals: {
    hasImprint: boolean;
    hasPrivacy: boolean;
    hasContact: boolean;
    hasAuthor: boolean;
    hasDate: boolean;
    hasAboutPage: boolean;
    hasTeamPage: boolean;
    authorName: string | null;
    publishDate: string | null;
    modifiedDate: string | null;
  };
  linkStructure: {
    internal: LinkInfo[];
    externalCount: number;
    internalCount: number;
    externalLinksSample: LinkInfo[];
    brokenLinkCandidates: number;
    nofollowCount: number;
  };
  codeQuality: {
    semanticScore: number;
    semanticTagsFound: string[];
    domDepth: number;
    isBuilder: boolean;
  };
  // NEU: Zusätzliche Analysen
  seoBasics: SeoBasics;
  indexing: IndexingSignals;
  contentMetrics: ContentMetrics;
  socialMeta: SocialMeta;
  geoSignals: GeoSignals;
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Extrahiert sauberen Text ohne HTML-Tags
 */
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Zählt Wörter in einem Text
 */
function countWords(text: string): number {
  const cleaned = cleanText(text);
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(word => word.length > 0).length;
}

// ============================================================================
// FUNKTIONEN (Scraping & Detection)
// ============================================================================

function detectCMS(html: string, $: cheerio.CheerioAPI): { cms: string; isBuilder: boolean } {
  const htmlLower = html.toLowerCase();
  
  // CMS Definitionen
  const builders = ['wix', 'squarespace', 'jimdo', 'shopify', 'weebly', 'webflow', 'elementor', 'divi', 'clickfunnels'];
  
  let detectedCms = 'Custom Code / Unbekannt';
  
  // Checks
  if (htmlLower.includes('wp-content')) detectedCms = 'WordPress';
  else if (htmlLower.includes('wix.com') || htmlLower.includes('wix-')) detectedCms = 'Wix';
  else if (htmlLower.includes('squarespace')) detectedCms = 'Squarespace';
  else if (htmlLower.includes('jimdo')) detectedCms = 'Jimdo';
  else if (htmlLower.includes('shopify')) detectedCms = 'Shopify';
  else if (htmlLower.includes('typo3')) detectedCms = 'TYPO3';
  else if (htmlLower.includes('joomla')) detectedCms = 'Joomla';
  else if (htmlLower.includes('webflow')) detectedCms = 'Webflow';
  else if (htmlLower.includes('next.js') || htmlLower.includes('__next')) detectedCms = 'Next.js (React)';
  else if (htmlLower.includes('nuxt')) detectedCms = 'Nuxt.js (Vue)';
  else if (htmlLower.includes('gatsby')) detectedCms = 'Gatsby';
  else if (htmlLower.includes('drupal')) detectedCms = 'Drupal';
  else if (htmlLower.includes('contao')) detectedCms = 'Contao';
  else if (htmlLower.includes('craft')) detectedCms = 'Craft CMS';

  // Ist es ein Baukasten?
  const isBuilder = builders.some(b => detectedCms.toLowerCase().includes(b) || htmlLower.includes(b));

  return { cms: detectedCms, isBuilder };
}

/**
 * NEU: Analysiert SEO-Grundlagen
 */
function analyzeSeoBasics($: cheerio.CheerioAPI): SeoBasics {
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const hasCharset = $('meta[charset]').length > 0 || $('meta[http-equiv="Content-Type"]').length > 0;
  const htmlLang = $('html').attr('lang');
  const hasLanguage = !!htmlLang;
  
  return {
    hasViewport,
    hasCharset,
    hasLanguage,
    language: htmlLang || null
  };
}

/**
 * NEU: Analysiert Indexierungs-Signale
 */
function analyzeIndexing($: cheerio.CheerioAPI, baseUrl: string): IndexingSignals {
  // Canonical
  const canonicalTag = $('link[rel="canonical"]').attr('href');
  let canonicalMatchesUrl = false;
  if (canonicalTag) {
    try {
      const canonicalUrl = new URL(canonicalTag, baseUrl).href;
      const normalizedBase = new URL(baseUrl).href;
      canonicalMatchesUrl = canonicalUrl === normalizedBase;
    } catch {}
  }
  
  // Robots Meta
  const robotsMeta = $('meta[name="robots"]').attr('content') || null;
  const isIndexable = !robotsMeta || (!robotsMeta.includes('noindex') && !robotsMeta.includes('none'));
  
  // Hreflang
  const hreflang: { lang: string; url: string }[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang');
    const url = $(el).attr('href');
    if (lang && url) {
      hreflang.push({ lang, url });
    }
  });
  
  // Pagination
  const prev = $('link[rel="prev"]').attr('href') || null;
  const next = $('link[rel="next"]').attr('href') || null;
  
  return {
    canonical: canonicalTag || null,
    canonicalMatchesUrl,
    robotsMeta,
    isIndexable,
    hreflang,
    pagination: { prev, next }
  };
}

/**
 * NEU: Analysiert Content-Metriken
 */
function analyzeContentMetrics($: cheerio.CheerioAPI): ContentMetrics {
  // Clone für saubere Textextraktion
  const $clone = cheerio.load($.html());
  $clone('script, style, nav, footer, header, aside, iframe, svg, noscript').remove();
  
  const mainContent = $clone('main').text() || $clone('article').text() || $clone('body').text();
  const cleanedContent = cleanText(mainContent);
  
  const wordCount = countWords(cleanedContent);
  const readingTimeMin = Math.ceil(wordCount / 200); // ~200 WPM durchschnittlich
  
  // Paragraphen zählen
  const paragraphs = $('p').filter((_, el) => {
    const text = $(el).text().trim();
    return text.length > 50; // Mindestens 50 Zeichen
  });
  const paragraphCount = paragraphs.length;
  const avgWordsPerParagraph = paragraphCount > 0 ? Math.round(wordCount / paragraphCount) : 0;
  
  // Thin Content Check
  const thinContent = wordCount < 300;
  
  // Table of Contents Detection
  const hasTableOfContents = 
    $('[class*="toc"], [id*="toc"], [class*="table-of-contents"], nav[class*="content"]').length > 0 ||
    $('a[href^="#"]').length >= 5; // Mindestens 5 Anker-Links
  
  // Content Depth Score
  let contentDepthScore = 0;
  if (wordCount >= 300) contentDepthScore += 20;
  if (wordCount >= 800) contentDepthScore += 20;
  if (wordCount >= 1500) contentDepthScore += 20;
  if (paragraphCount >= 5) contentDepthScore += 15;
  if (hasTableOfContents) contentDepthScore += 15;
  if ($('h2').length >= 3) contentDepthScore += 10;
  contentDepthScore = Math.min(contentDepthScore, 100);
  
  return {
    wordCount,
    readingTimeMin,
    paragraphCount,
    avgWordsPerParagraph,
    thinContent,
    hasTableOfContents,
    contentDepthScore
  };
}

/**
 * NEU: Analysiert Social Meta Tags
 */
function analyzeSocialMeta($: cheerio.CheerioAPI): SocialMeta {
  // Open Graph
  const og = {
    title: $('meta[property="og:title"]').attr('content') || null,
    description: $('meta[property="og:description"]').attr('content') || null,
    image: $('meta[property="og:image"]').attr('content') || null,
    type: $('meta[property="og:type"]').attr('content') || null,
    url: $('meta[property="og:url"]').attr('content') || null
  };
  
  // Twitter Cards
  const twitter = {
    card: $('meta[name="twitter:card"]').attr('content') || null,
    site: $('meta[name="twitter:site"]').attr('content') || null,
    title: $('meta[name="twitter:title"]').attr('content') || null,
    description: $('meta[name="twitter:description"]').attr('content') || null,
    image: $('meta[name="twitter:image"]').attr('content') || null
  };
  
  // Social Profile Links
  const socialDomains = ['facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'xing.com', 'pinterest.com'];
  const socialProfileLinks: string[] = [];
  
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (socialDomains.some(domain => href.includes(domain))) {
      if (!socialProfileLinks.includes(href)) {
        socialProfileLinks.push(href);
      }
    }
  });
  
  return {
    og,
    twitter,
    hasSocialProfiles: socialProfileLinks.length > 0,
    socialProfileLinks: socialProfileLinks.slice(0, 10)
  };
}

/**
 * NEU: Analysiert Schema.org Daten im Detail
 */
function analyzeSchemaDetails($: cheerio.CheerioAPI): { types: string[]; hasMultipleSchemas: boolean; rawSchemas: object[] } {
  const schemas: object[] = [];
  const types: string[] = [];
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        schemas.push(parsed);
        
        // Typen extrahieren (auch aus @graph)
        const extractTypes = (obj: any) => {
          if (obj['@type']) {
            const objTypes = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
            types.push(...objTypes);
          }
          if (obj['@graph'] && Array.isArray(obj['@graph'])) {
            obj['@graph'].forEach(extractTypes);
          }
        };
        extractTypes(parsed);
      }
    } catch {}
  });
  
  return {
    types: [...new Set(types)],
    hasMultipleSchemas: schemas.length > 1,
    rawSchemas: schemas
  };
}

/**
 * NEU: Analysiert GEO (Generative Engine Optimization) Signale
 */
function analyzeGeoSignals($: cheerio.CheerioAPI, html: string, schemaTypes: string[]): GeoSignals {
  const bodyText = $('body').text();
  const bodyTextLower = bodyText.toLowerCase();
  
  // === ENTITÄTS-KLARHEIT ===
  const sameAsLinks: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.sameAs) {
          const links = Array.isArray(parsed.sameAs) ? parsed.sameAs : [parsed.sameAs];
          sameAsLinks.push(...links);
        }
      }
    } catch {}
  });
  
  const entityClarity = {
    schemaTypes,
    hasOrganizationSchema: schemaTypes.some(t => t.toLowerCase().includes('organization')),
    hasPersonSchema: schemaTypes.some(t => t.toLowerCase() === 'person'),
    hasArticleSchema: schemaTypes.some(t => t.toLowerCase().includes('article')),
    hasFaqSchema: schemaTypes.some(t => t.toLowerCase() === 'faqpage'),
    hasHowToSchema: schemaTypes.some(t => t.toLowerCase() === 'howto'),
    hasBreadcrumbSchema: schemaTypes.some(t => t.toLowerCase().includes('breadcrumb')),
    hasProductSchema: schemaTypes.some(t => t.toLowerCase() === 'product'),
    hasLocalBusinessSchema: schemaTypes.some(t => t.toLowerCase().includes('localbusiness')),
    sameAsLinks
  };
  
  // === ZITIERBARKEIT FÜR LLMs ===
  // Definitionen erkennen ("X ist...", "X bezeichnet...", "X bedeutet...")
  const definitionPatterns = /(ist|sind|bezeichnet|bedeutet|definiert als|versteht man|nennt man)\s+[^.]{10,}\./gi;
  const hasDefinitions = definitionPatterns.test(bodyText);
  
  // FAQ-Struktur
  const hasFaqStructure = 
    entityClarity.hasFaqSchema ||
    $('[itemtype*="FAQPage"], .faq, #faq, [class*="faq"]').length > 0 ||
    $('details, summary').length >= 3 ||
    $('h2, h3, h4').filter((_, el) => /\?$/.test($(el).text().trim())).length >= 3;
  
  // HowTo-Struktur
  const hasHowToStructure = 
    entityClarity.hasHowToSchema ||
    $('[class*="step"], [class*="how-to"], ol li').length >= 3;
  
  // Listen
  const hasNumberedLists = $('ol').length > 0;
  const hasBulletLists = $('ul').filter((_, el) => $(el).find('li').length >= 3).length > 0;
  
  // Datentabellen
  const hasDataTables = $('table').filter((_, el) => $(el).find('tr').length >= 3).length > 0;
  
  // Statistiken & Zahlen
  const statisticPatterns = /\d+(\.\d+)?%|\d{1,3}([.,]\d{3})+|\d+\s*(Prozent|Euro|Dollar|USD|EUR|Millionen|Milliarden)/gi;
  const hasStatistics = statisticPatterns.test(bodyText);
  
  // Zitate & Quellenangaben
  const hasCitations = 
    $('cite, blockquote[cite], [class*="source"], [class*="reference"], [class*="citation"], sup a').length > 0 ||
    /Quelle:|laut\s+\w+|gemäß|nach Angaben|Studie zeigt/i.test(bodyText);
  
  // Direkte Zitate
  const hasQuotes = 
    $('blockquote, q').length > 0 ||
    /"[^"]{20,}"/.test(bodyText) ||
    /„[^"]{20,}"/.test(bodyText);
  
  // Zitierbarkeits-Score
  let citabilityScore = 0;
  if (hasDefinitions) citabilityScore += 15;
  if (hasFaqStructure) citabilityScore += 20;
  if (hasHowToStructure) citabilityScore += 15;
  if (hasNumberedLists || hasBulletLists) citabilityScore += 10;
  if (hasDataTables) citabilityScore += 15;
  if (hasStatistics) citabilityScore += 10;
  if (hasCitations) citabilityScore += 10;
  if (hasQuotes) citabilityScore += 5;
  citabilityScore = Math.min(citabilityScore, 100);
  
  const citability = {
    hasDefinitions,
    hasFaqStructure,
    hasHowToStructure,
    hasNumberedLists,
    hasBulletLists,
    hasDataTables,
    hasStatistics,
    hasCitations,
    hasQuotes,
    citabilityScore
  };
  
  // === FAKTEN & EXPERTISE ===
  const hasOriginalData = 
    /unsere (Studie|Analyse|Daten|Umfrage|Erhebung)/i.test(bodyText) ||
    /wir haben (untersucht|analysiert|getestet|gemessen)/i.test(bodyText);
  
  const hasExpertQuotes = 
    /sagt|erklärt|betont|meint|so\s+\w+\s*:/i.test(bodyText) &&
    $('blockquote').length > 0;
  
  const hasFirstPersonExpertise = 
    /in meiner (Erfahrung|Praxis|Arbeit)|seit \d+ Jahren|als (Experte|Spezialist|Fachmann|Berater)/i.test(bodyText);
  
  const hasSourceReferences = 
    $('a[href*="doi.org"], a[href*="pubmed"], a[href*="scholar.google"], [class*="footnote"]').length > 0 ||
    /\[\d+\]|\(et al\.\)|\(vgl\.|siehe auch/i.test(bodyText);
  
  const hasLastUpdated = 
    $('[class*="updated"], [class*="modified"], time[datetime]').length > 0 ||
    /aktualisiert|zuletzt geändert|stand:/i.test(bodyTextLower);
  
  const factualSignals = {
    hasOriginalData,
    hasExpertQuotes,
    hasFirstPersonExpertise,
    hasSourceReferences,
    hasLastUpdated
  };
  
  // === LLM-LESBARKEIT ===
  const hasSummary = 
    $('[class*="summary"], [class*="tldr"], [class*="fazit"], [class*="zusammenfassung"]').length > 0 ||
    /zusammenfassung|fazit|im überblick|key takeaways|das wichtigste/i.test(bodyTextLower);
  
  const hasKeyTakeaways = 
    $('[class*="takeaway"], [class*="highlight"], [class*="key-point"]').length > 0 ||
    /wichtigste punkte|kernaussagen|merke dir/i.test(bodyTextLower);
  
  const hasClearTopicSentences = $('p strong:first-child, p b:first-child').length >= 3;
  
  const hasInfographics = 
    $('figure, [class*="infographic"], svg[class*="chart"], canvas').length > 0;
  
  // Fragen im Content
  const questionHeadings = $('h1, h2, h3, h4').filter((_, el) => /\?/.test($(el).text())).length;
  const questionCount = questionHeadings + (bodyText.match(/\?/g) || []).length;
  
  // Antwort-Muster ("Die Antwort ist...", "Kurz gesagt...")
  const answerPatterns = /die antwort|kurz gesagt|einfach erklärt|das bedeutet|konkret heißt das/gi;
  const answerPatternCount = (bodyText.match(answerPatterns) || []).length;
  
  const llmReadability = {
    hasSummary,
    hasKeyTakeaways,
    hasClearTopicSentences,
    hasInfographics,
    questionCount: Math.min(questionCount, 50),
    answerPatternCount
  };
  
  // === GESAMT GEO SCORE ===
  let geoScore = 0;
  
  // Entitäts-Klarheit (max 25)
  if (schemaTypes.length > 0) geoScore += 10;
  if (entityClarity.hasOrganizationSchema || entityClarity.hasPersonSchema) geoScore += 8;
  if (entityClarity.hasFaqSchema || entityClarity.hasHowToSchema) geoScore += 7;
  
  // Zitierbarkeit (max 35)
  geoScore += Math.round(citabilityScore * 0.35);
  
  // Fakten & Expertise (max 20)
  if (factualSignals.hasOriginalData) geoScore += 5;
  if (factualSignals.hasExpertQuotes) geoScore += 5;
  if (factualSignals.hasFirstPersonExpertise) geoScore += 5;
  if (factualSignals.hasSourceReferences) geoScore += 5;
  
  // LLM-Lesbarkeit (max 20)
  if (llmReadability.hasSummary) geoScore += 5;
  if (llmReadability.hasKeyTakeaways) geoScore += 5;
  if (llmReadability.questionCount >= 3) geoScore += 5;
  if (llmReadability.answerPatternCount >= 2) geoScore += 5;
  
  geoScore = Math.min(geoScore, 100);
  
  // Rating
  let geoRating: 'Exzellent' | 'Gut' | 'Mittel' | 'Verbesserungswürdig' = 'Verbesserungswürdig';
  if (geoScore >= 75) geoRating = 'Exzellent';
  else if (geoScore >= 50) geoRating = 'Gut';
  else if (geoScore >= 30) geoRating = 'Mittel';
  
  return {
    entityClarity,
    citability,
    factualSignals,
    llmReadability,
    geoScore,
    geoRating
  };
}

/**
 * ERWEITERTE Hauptanalyse-Funktion
 */
function analyzeTech(html: string, $: cheerio.CheerioAPI, baseUrl: string, ttfbMs: number): TechStats {
  // 1. Seitengröße
  const pageSizeKb = Math.round((Buffer.byteLength(html, 'utf8') / 1024) * 100) / 100;

  // 1b. ERWEITERTE Performance Bewertung
  let perfRating: 'Schnell' | 'Mittel' | 'Langsam' = 'Mittel';
  if (ttfbMs < 300) perfRating = 'Schnell';
  else if (ttfbMs > 800) perfRating = 'Langsam';
  
  // Resource Hints
  const resourceHints = {
    preconnect: $('link[rel="preconnect"]').length,
    prefetch: $('link[rel="prefetch"]').length,
    preload: $('link[rel="preload"]').length,
    dnsPrefetch: $('link[rel="dns-prefetch"]').length
  };
  
  // Critical CSS Detection
  const hasCriticalCss = $('style').filter((_, el) => {
    const content = $(el).html() || '';
    return content.length > 100 && content.length < 50000;
  }).length > 0;
  
  // Script Analysis
  const allScripts = $('script[src]');
  let renderBlockingScripts = 0;
  let asyncScripts = 0;
  let deferScripts = 0;
  
  allScripts.each((_, el) => {
    const hasAsync = $(el).attr('async') !== undefined;
    const hasDefer = $(el).attr('defer') !== undefined;
    if (hasAsync) asyncScripts++;
    else if (hasDefer) deferScripts++;
    else renderBlockingScripts++;
  });
  
  const performance: PerformanceMetrics = {
    ttfbMs,
    rating: perfRating,
    htmlSizeKb: pageSizeKb,
    resourceHints,
    hasCriticalCss,
    renderBlockingScripts,
    asyncScripts,
    deferScripts
  };

  // 2. Semantisches HTML & Code Qualität
  const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
  const foundTags = semanticTags.filter(tag => $(tag).length > 0);
  
  // ERWEITERTE Heading-Analyse
  const headings = {
    h1: $('h1').length,
    h2: $('h2').length,
    h3: $('h3').length,
    h4: $('h4').length,
    h5: $('h5').length,
    h6: $('h6').length
  };
  
  const h1Texts = $('h1').map((_, el) => $(el).text().trim()).get();
  
  // Heading Hierarchie Check
  let headingHierarchyValid = true;
  if (headings.h1 !== 1) headingHierarchyValid = false;
  if (headings.h3 > 0 && headings.h2 === 0) headingHierarchyValid = false;

  let semanticScore = Math.round((foundTags.length / semanticTags.length) * 100);
  if (headings.h1 === 1) semanticScore += 10; 
  if (semanticScore > 100) semanticScore = 100;

  const domDepth = $('*').length;

  // 3. Schema & Meta-Daten
  const hasSchema = $('script[type="application/ld+json"]').length > 0;
  const schemaDetails = analyzeSchemaDetails($);

  // 3a. ERWEITERTE Autor-Erkennung
  const hasAuthor = 
    $('meta[name="author"]').length > 0 || 
    $('meta[property="article:author"]').length > 0 ||
    $('link[rel~="author"]').length > 0 ||
    $('a[rel~="author"]').length > 0 ||
    $('[itemprop="author"]').length > 0 ||
    $('.author-name, .post-author, .author, .byline').length > 0;
  
  // Autor-Name extrahieren
  let authorName: string | null = null;
  const authorMeta = $('meta[name="author"]').attr('content');
  if (authorMeta) {
    authorName = authorMeta;
  } else {
    const authorEl = $('[itemprop="author"], .author-name, .author, .byline').first().text().trim();
    if (authorEl && authorEl.length < 100) authorName = authorEl;
  }

  // 3b. ERWEITERTE Datums-Erkennung
  const hasDate = 
    $('meta[property="article:published_time"]').length > 0 || 
    $('meta[property="og:updated_time"]').length > 0 ||
    $('meta[name="date"]').length > 0 ||
    $('time').length > 0 ||
    $('[itemprop="datePublished"]').length > 0 ||
    $('[itemprop="dateModified"]').length > 0 ||
    $('.date, .published, .entry-date, .post-date, .meta-date').length > 0;
  
  // Datum extrahieren
  const publishDate = $('meta[property="article:published_time"]').attr('content') ||
    $('time[datetime]').first().attr('datetime') ||
    $('[itemprop="datePublished"]').attr('content') || null;
  
  const modifiedDate = $('meta[property="article:modified_time"]').attr('content') ||
    $('[itemprop="dateModified"]').attr('content') || null;
  
  // About/Team Page Detection
  const allLinkHrefs = $('a').map((_, el) => $(el).attr('href')?.toLowerCase() || '').get().join(' ');
  const hasAboutPage = /über-uns|about|ueber-uns|wir-sind/.test(allLinkHrefs);
  const hasTeamPage = /team|mitarbeiter|ansprechpartner/.test(allLinkHrefs);

  // 4. ERWEITERTE Bilder-Analyse
  const images = $('img');
  let withAlt = 0;
  let withEmptyAlt = 0;
  let modernFormats = 0;
  let lazyLoaded = 0;
  
  images.each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    const alt = $(el).attr('alt');
    const loading = $(el).attr('loading');
    
    if (alt !== undefined) {
      if (alt.trim().length > 0) withAlt++;
      else withEmptyAlt++;
    }
    if (src.toLowerCase().match(/\.(webp|avif)(\?.*)?$/)) modernFormats++;
    if (loading === 'lazy' || $(el).attr('data-src')) lazyLoaded++;
  });
  
  const imgScore = images.length === 0 ? 100 : Math.round(((withAlt + modernFormats) / (images.length * 2)) * 100);

  // 5. ERWEITERTE Link Struktur & Trust
  const allLinkText = $('a').map((_, el) => $(el).text().toLowerCase()).get().join(' ');
  const hasImprint = /impressum|imprint|anbieterkennzeichnung/.test(allLinkText);
  const hasPrivacy = /datenschutz|privacy|dsgvo/.test(allLinkText);
  const hasContact = /kontakt|contact/.test(allLinkText);

  const internalLinks: LinkInfo[] = [];
  const externalLinksSample: LinkInfo[] = [];
  let externalCount = 0;
  let nofollowCount = 0;
  let brokenLinkCandidates = 0;
  
  let currentHost = '';
  try {
    currentHost = new URL(baseUrl).hostname.replace(/^www\./, '');
  } catch (e) {
    console.error('Base URL Invalid:', baseUrl);
  }

  $('a').each((_, el) => {
    const rawHref = $(el).attr('href');
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    const rel = $(el).attr('rel') || '';

    if (rel.includes('nofollow')) nofollowCount++;
    
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:') || text.length < 2) return;

    try {
      const absoluteUrl = new URL(rawHref, baseUrl);
      const linkHost = absoluteUrl.hostname.replace(/^www\./, '');
      
      const isInternal = linkHost === currentHost;
      const linkObj = { text: text.substring(0, 60), href: absoluteUrl.href, isInternal };

      if (isInternal) {
        if (!internalLinks.some(l => l.href === absoluteUrl.href)) {
          internalLinks.push(linkObj);
        }
      } else {
        externalCount++;
        if (externalLinksSample.length < 5 && !externalLinksSample.some(l => l.href === absoluteUrl.href)) {
          externalLinksSample.push(linkObj);
        }
      }
    } catch (e) {
      brokenLinkCandidates++;
    }
  });

  const cmsInfo = detectCMS(html, $);
  
  // NEU: Zusätzliche Analysen
  const seoBasics = analyzeSeoBasics($);
  const indexing = analyzeIndexing($, baseUrl);
  const contentMetrics = analyzeContentMetrics($);
  const socialMeta = analyzeSocialMeta($);
  const geoSignals = analyzeGeoSignals($, html, schemaDetails.types);

  return {
    pageSizeKb,
    performance,
    hasSchema,
    schemaDetails,
    structure: {
      headings,
      hasMainH1: headings.h1 > 0,
      headingHierarchyValid,
      h1Text: h1Texts
    },
    imageAnalysis: {
      total: images.length,
      withAlt,
      withEmptyAlt,
      modernFormats,
      lazyLoaded,
      score: imgScore
    },
    trustSignals: {
      hasImprint,
      hasPrivacy,
      hasContact,
      hasAuthor,
      hasDate,
      hasAboutPage,
      hasTeamPage,
      authorName,
      publishDate,
      modifiedDate
    },
    linkStructure: {
      internal: internalLinks.slice(0, 25),
      internalCount: internalLinks.length,
      externalCount,
      externalLinksSample,
      brokenLinkCandidates,
      nofollowCount
    },
    codeQuality: {
      semanticScore,
      semanticTagsFound: foundTags,
      domDepth,
      isBuilder: cmsInfo.isBuilder
    },
    seoBasics,
    indexing,
    contentMetrics,
    socialMeta,
    geoSignals
  };
}

async function scrapeContent(url: string) {
  try {
    const startTime = Date.now();

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      next: { revalidate: 3600 }
    });

    const ttfb = Date.now() - startTime;

    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);

    const cmsData = detectCMS(html, $);
    const techStats = analyzeTech(html, $, url, ttfb);

    // Aufräumen für Text-Content
    $('script, style, nav, footer, iframe, svg, noscript').remove();

    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const h1 = $('h1').map((_, el) => $(el).text().trim()).get().join(' | ');
    
    let content = $('main').text().trim() || $('article').text().trim() || $('body').text().trim();
    content = content.replace(/\s+/g, ' ').substring(0, 8000);

    return { title, description, h1, content, cmsData, techStats };
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
    
    const targetUrl = body.targetUrl || body.myUrl || body.url || body.target || body.siteUrl || body.domain;
    const competitorUrl = body.competitorUrl || body.competitor || body.compareUrl;
    const keywords = body.keywords || body.keyword || '';

    if (!targetUrl) return NextResponse.json({ message: 'URL fehlt' }, { status: 400 });

    let normalizedUrl = targetUrl.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl;

    const [targetData, competitorData] = await Promise.all([
      scrapeContent(normalizedUrl),
      competitorUrl ? scrapeContent(competitorUrl) : Promise.resolve(null)
    ]);

    if (!targetData) return NextResponse.json({ message: 'Analyse fehlgeschlagen' }, { status: 400 });

    const isCompareMode = !!(competitorUrl && competitorData);
    const compactStyles = getCompactStyleGuide();

    // ------------------------------------------------------------------
    // PROMPT CONSTRUCTION (ERWEITERT mit SEO & GEO)
    // ------------------------------------------------------------------

    const formatData = (data: any, url: string) => `
      ZIEL-URL: ${url}
      TITEL: ${data.title}
      META-DESCRIPTION: ${data.description || 'FEHLT'}
      
      ═══════════════════════════════════════════════════════════════
      TECHNISCHE SEO-FAKTEN
      ═══════════════════════════════════════════════════════════════
      
      PERFORMANCE:
      - HTTP Status: 200 OK
      - Ladezeit (TTFB): ${data.techStats.performance.ttfbMs}ms (${data.techStats.performance.rating})
      - HTML-Größe: ${data.techStats.performance.htmlSizeKb} KB
      - Resource Hints: ${data.techStats.performance.resourceHints.preload} Preload, ${data.techStats.performance.resourceHints.preconnect} Preconnect
      - Render-Blocking Scripts: ${data.techStats.performance.renderBlockingScripts}
      - Async/Defer Scripts: ${data.techStats.performance.asyncScripts}/${data.techStats.performance.deferScripts}
      
      SEO BASICS:
      - Viewport Meta: ${data.techStats.seoBasics.hasViewport ? '✅' : '❌'}
      - Charset: ${data.techStats.seoBasics.hasCharset ? '✅' : '❌'}
      - Sprache: ${data.techStats.seoBasics.language || 'NICHT GESETZT'}
      - CMS/Framework: ${data.cmsData.cms}
      
      INDEXIERUNG:
      - Canonical: ${data.techStats.indexing.canonical || 'FEHLT'}
      - Canonical = URL: ${data.techStats.indexing.canonicalMatchesUrl ? '✅' : '❌'}
      - Robots Meta: ${data.techStats.indexing.robotsMeta || 'nicht gesetzt'}
      - Indexierbar: ${data.techStats.indexing.isIndexable ? '✅ JA' : '❌ NEIN'}
      - Hreflang Tags: ${data.techStats.indexing.hreflang.length} Sprachen
      
      HTML STRUKTUR:
      - H1: ${data.techStats.structure.headings.h1}x ("${data.techStats.structure.h1Text.join('", "')}")
      - H2: ${data.techStats.structure.headings.h2}x
      - H3: ${data.techStats.structure.headings.h3}x
      - Hierarchie valide: ${data.techStats.structure.headingHierarchyValid ? '✅' : '❌'}
      - Semantische Tags: ${data.techStats.codeQuality.semanticTagsFound.join(', ')}
      - Semantik-Score: ${data.techStats.codeQuality.semanticScore}/100
      
      SCHEMA.ORG (STRUKTURIERTE DATEN):
      - JSON-LD vorhanden: ${data.techStats.hasSchema ? '✅ JA' : '❌ NEIN'}
      - Schema-Typen: ${data.techStats.schemaDetails.types.length > 0 ? data.techStats.schemaDetails.types.join(', ') : 'KEINE'}
      - Organization Schema: ${data.techStats.geoSignals.entityClarity.hasOrganizationSchema ? '✅' : '❌'}
      - Person Schema: ${data.techStats.geoSignals.entityClarity.hasPersonSchema ? '✅' : '❌'}
      - Article Schema: ${data.techStats.geoSignals.entityClarity.hasArticleSchema ? '✅' : '❌'}
      - FAQ Schema: ${data.techStats.geoSignals.entityClarity.hasFaqSchema ? '✅' : '❌'}
      - HowTo Schema: ${data.techStats.geoSignals.entityClarity.hasHowToSchema ? '✅' : '❌'}
      - Breadcrumb Schema: ${data.techStats.geoSignals.entityClarity.hasBreadcrumbSchema ? '✅' : '❌'}
      
      ═══════════════════════════════════════════════════════════════
      E-E-A-T SIGNALE
      ═══════════════════════════════════════════════════════════════
      
      EXPERTISE & AUTORITÄT:
      - Autor erkannt: ${data.techStats.trustSignals.hasAuthor ? '✅' : '❌'}
      - Autor-Name: ${data.techStats.trustSignals.authorName || 'NICHT GEFUNDEN'}
      - Veröffentlichungsdatum: ${data.techStats.trustSignals.publishDate || 'FEHLT'}
      - Aktualisierungsdatum: ${data.techStats.trustSignals.modifiedDate || 'FEHLT'}
      - About-Seite verlinkt: ${data.techStats.trustSignals.hasAboutPage ? '✅' : '❌'}
      - Team-Seite verlinkt: ${data.techStats.trustSignals.hasTeamPage ? '✅' : '❌'}
      
      VERTRAUENS-SIGNALE:
      - Impressum: ${data.techStats.trustSignals.hasImprint ? '✅' : '❌'}
      - Datenschutz: ${data.techStats.trustSignals.hasPrivacy ? '✅' : '❌'}
      - Kontakt: ${data.techStats.trustSignals.hasContact ? '✅' : '❌'}
      
      SOCIAL MEDIA:
      - Social Profiles verlinkt: ${data.techStats.socialMeta.hasSocialProfiles ? '✅' : '❌'}
      - Profile: ${data.techStats.socialMeta.socialProfileLinks.slice(0, 3).join(', ') || 'KEINE'}
      - Open Graph vollständig: ${data.techStats.socialMeta.og.title && data.techStats.socialMeta.og.image ? '✅' : '❌'}
      - Twitter Card: ${data.techStats.socialMeta.twitter.card || 'FEHLT'}
      
      ═══════════════════════════════════════════════════════════════
      CONTENT-ANALYSE
      ═══════════════════════════════════════════════════════════════
      
      - Wortanzahl: ${data.techStats.contentMetrics.wordCount}
      - Lesezeit: ~${data.techStats.contentMetrics.readingTimeMin} Min.
      - Absätze: ${data.techStats.contentMetrics.paragraphCount}
      - Thin Content: ${data.techStats.contentMetrics.thinContent ? '⚠️ JA (<300 Wörter)' : '✅ NEIN'}
      - Inhaltsverzeichnis: ${data.techStats.contentMetrics.hasTableOfContents ? '✅' : '❌'}
      - Content-Tiefe Score: ${data.techStats.contentMetrics.contentDepthScore}/100
      
      BILDER:
      - Gesamt: ${data.techStats.imageAnalysis.total}
      - Mit Alt-Text: ${data.techStats.imageAnalysis.withAlt}
      - Leere Alt-Tags: ${data.techStats.imageAnalysis.withEmptyAlt}
      - WebP/AVIF: ${data.techStats.imageAnalysis.modernFormats}
      - Lazy Loading: ${data.techStats.imageAnalysis.lazyLoaded}
      - Bild-Score: ${data.techStats.imageAnalysis.score}/100
      
      LINKS:
      - Interne Links: ${data.techStats.linkStructure.internalCount}
      - Externe Links: ${data.techStats.linkStructure.externalCount}
      - Nofollow Links: ${data.techStats.linkStructure.nofollowCount}
      - Potentiell defekte Links: ${data.techStats.linkStructure.brokenLinkCandidates}
      
      ═══════════════════════════════════════════════════════════════
      GEO-ANALYSE (Generative Engine Optimization)
      ═══════════════════════════════════════════════════════════════
      
      GESAMT GEO-SCORE: ${data.techStats.geoSignals.geoScore}/100 (${data.techStats.geoSignals.geoRating})
      
      ENTITÄTS-KLARHEIT (für LLMs):
      - Schema-Typen definiert: ${data.techStats.geoSignals.entityClarity.schemaTypes.length > 0 ? '✅' : '❌'}
      - sameAs Verlinkungen: ${data.techStats.geoSignals.entityClarity.sameAsLinks.length > 0 ? data.techStats.geoSignals.entityClarity.sameAsLinks.slice(0, 2).join(', ') : 'KEINE'}
      
      ZITIERBARKEIT FÜR KI (Score: ${data.techStats.geoSignals.citability.citabilityScore}/100):
      - Definitionen im Text: ${data.techStats.geoSignals.citability.hasDefinitions ? '✅' : '❌'}
      - FAQ-Struktur: ${data.techStats.geoSignals.citability.hasFaqStructure ? '✅' : '❌'}
      - HowTo/Anleitungen: ${data.techStats.geoSignals.citability.hasHowToStructure ? '✅' : '❌'}
      - Nummerierte Listen: ${data.techStats.geoSignals.citability.hasNumberedLists ? '✅' : '❌'}
      - Datentabellen: ${data.techStats.geoSignals.citability.hasDataTables ? '✅' : '❌'}
      - Statistiken/Zahlen: ${data.techStats.geoSignals.citability.hasStatistics ? '✅' : '❌'}
      - Quellenangaben: ${data.techStats.geoSignals.citability.hasCitations ? '✅' : '❌'}
      - Zitate: ${data.techStats.geoSignals.citability.hasQuotes ? '✅' : '❌'}
      
      FAKTEN & EXPERTISE:
      - Originaldaten: ${data.techStats.geoSignals.factualSignals.hasOriginalData ? '✅' : '❌'}
      - Expertenzitate: ${data.techStats.geoSignals.factualSignals.hasExpertQuotes ? '✅' : '❌'}
      - First-Person Expertise: ${data.techStats.geoSignals.factualSignals.hasFirstPersonExpertise ? '✅' : '❌'}
      - Quellenreferenzen: ${data.techStats.geoSignals.factualSignals.hasSourceReferences ? '✅' : '❌'}
      - Aktualisierungshinweis: ${data.techStats.geoSignals.factualSignals.hasLastUpdated ? '✅' : '❌'}
      
      LLM-LESBARKEIT:
      - Zusammenfassung/Fazit: ${data.techStats.geoSignals.llmReadability.hasSummary ? '✅' : '❌'}
      - Key Takeaways: ${data.techStats.geoSignals.llmReadability.hasKeyTakeaways ? '✅' : '❌'}
      - Fragen im Content: ${data.techStats.geoSignals.llmReadability.questionCount}
      - Antwort-Patterns: ${data.techStats.geoSignals.llmReadability.answerPatternCount}
      - Infografiken: ${data.techStats.geoSignals.llmReadability.hasInfographics ? '✅' : '❌'}
      
      ═══════════════════════════════════════════════════════════════
      CONTENT PREVIEW (erste 2000 Zeichen)
      ═══════════════════════════════════════════════════════════════
      ${data.content.substring(0, 2000)}...
    `;

    const basePrompt = `
      Du bist ein erfahrener SEO- und GEO-Auditor (Google Quality Rater Guidelines 2024 + AI Search Optimization).
      
      Analysiere die folgenden Daten der Webseite. 
      
      WICHTIG:
      - Bewerte SOWOHL klassische SEO-Faktoren ALS AUCH GEO (Generative Engine Optimization)
      - Erwähne IMMER den Status von Schema.org, Autor-Signalen und GEO-Score
      - Gib konkrete, umsetzbare Empfehlungen
      - Priorisiere nach Impact (Hoch/Mittel/Niedrig)

      DATEN:
      ${formatData(targetData, normalizedUrl)}
    `;

    const singlePrompt = `
      ${basePrompt}
      
      AUFGABE:
      Erstelle einen professionellen SEO & GEO Audit-Report als HTML.
      
      STYLE GUIDE: ${compactStyles}
      
      STRUKTUR DER ANTWORT (Halte dich exakt an dieses HTML-Gerüst):
      
      <div class="${STYLES.card} mb-6">
         <div class="flex justify-between items-center mb-4 border-b pb-2">
            <h3 class="${STYLES.h3} m-0">🔍 SEO & GEO Audit</h3>
            <div class="flex gap-2">
               <span class="text-xs font-mono bg-gray-100 px-2 py-1 rounded">TTFB: ${targetData.techStats.performance.ttfbMs}ms</span>
               <span class="text-xs font-mono px-2 py-1 rounded ${targetData.techStats.geoSignals.geoScore >= 50 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">GEO: ${targetData.techStats.geoSignals.geoScore}/100</span>
            </div>
         </div>
         
         <div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <div class="p-3 rounded bg-slate-50 border border-slate-200">
               <div class="text-xs text-gray-500 uppercase">Schema.org</div>
               <div class="font-bold ${targetData.techStats.hasSchema ? 'text-green-600' : 'text-red-600'}">
                  ${targetData.techStats.hasSchema ? '✅ ' + targetData.techStats.schemaDetails.types.length + ' Typen' : '❌ Fehlt'}
               </div>
            </div>
            <div class="p-3 rounded bg-slate-50 border border-slate-200">
               <div class="text-xs text-gray-500 uppercase">Autor</div>
               <div class="font-bold ${targetData.techStats.trustSignals.hasAuthor ? 'text-green-600' : 'text-red-600'}">
                 ${targetData.techStats.trustSignals.hasAuthor ? '✅ Erkannt' : '❌ Fehlt'}
               </div>
            </div>
            <div class="p-3 rounded bg-slate-50 border border-slate-200">
               <div class="text-xs text-gray-500 uppercase">Indexierbar</div>
               <div class="font-bold ${targetData.techStats.indexing.isIndexable ? 'text-green-600' : 'text-red-600'}">
                  ${targetData.techStats.indexing.isIndexable ? '✅ Ja' : '❌ Nein'}
               </div>
            </div>
            <div class="p-3 rounded bg-slate-50 border border-slate-200">
               <div class="text-xs text-gray-500 uppercase">Content</div>
               <div class="font-bold ${targetData.techStats.contentMetrics.thinContent ? 'text-red-600' : 'text-green-600'}">
                  ${targetData.techStats.contentMetrics.wordCount} Wörter
               </div>
            </div>
            <div class="p-3 rounded bg-slate-50 border border-slate-200">
               <div class="text-xs text-gray-500 uppercase">Zitierbarkeit</div>
               <div class="font-bold ${targetData.techStats.geoSignals.citability.citabilityScore >= 50 ? 'text-green-600' : 'text-yellow-600'}">
                  ${targetData.techStats.geoSignals.citability.citabilityScore}/100
               </div>
            </div>
         </div>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
      
          <div class="${STYLES.card}">
             <h3 class="${STYLES.h3} text-indigo-700"><i class="bi bi-shield-check"></i> E-E-A-T Analyse</h3>
             <ul class="${STYLES.list} space-y-3">
                <li>
                    <strong>Strukturierte Daten:</strong> 
                    ${targetData.techStats.hasSchema 
                      ? '<span>✅ ' + targetData.techStats.schemaDetails.types.join(', ') + '</span>' 
                      : '<span class="text-red-600">❌ Kein Schema-Markup. Implementiere mindestens Organization + Article/WebPage!</span>'}
                </li>
                <li>
                    <strong>Autor & Identität:</strong>
                    ${targetData.techStats.trustSignals.hasAuthor 
                      ? '✅ Autor erkannt' + (targetData.techStats.trustSignals.authorName ? ': ' + targetData.techStats.trustSignals.authorName : '')
                      : '⚠️ Kein Autoren-Signal im Code gefunden.'}
                </li>
                <li>
                    <strong>Aktualität:</strong>
                    ${targetData.techStats.trustSignals.publishDate 
                      ? '✅ Veröffentlicht: ' + targetData.techStats.trustSignals.publishDate 
                      : '❌ Kein Veröffentlichungsdatum erkennbar'}
                </li>
                <li>
                    <strong>Trust-Signale:</strong>
                    Impressum: ${targetData.techStats.trustSignals.hasImprint ? '✅' : '❌'} | 
                    Datenschutz: ${targetData.techStats.trustSignals.hasPrivacy ? '✅' : '❌'} | 
                    Kontakt: ${targetData.techStats.trustSignals.hasContact ? '✅' : '❌'}
                </li>
             </ul>
          </div>

          <div class="${STYLES.card}">
             <h3 class="${STYLES.h3} text-purple-700"><i class="bi bi-robot"></i> GEO-Analyse (KI-Optimierung)</h3>
             <div class="mb-3 p-2 rounded ${targetData.techStats.geoSignals.geoRating === 'Exzellent' ? 'bg-green-50' : targetData.techStats.geoSignals.geoRating === 'Gut' ? 'bg-blue-50' : 'bg-yellow-50'}">
                <span class="font-bold">GEO-Score: ${targetData.techStats.geoSignals.geoScore}/100</span> - ${targetData.techStats.geoSignals.geoRating}
             </div>
             <ul class="${STYLES.list} space-y-2 text-sm">
                <li>FAQ-Schema/Struktur: ${targetData.techStats.geoSignals.citability.hasFaqStructure ? '✅' : '❌'}</li>
                <li>Definitionen im Text: ${targetData.techStats.geoSignals.citability.hasDefinitions ? '✅' : '❌'}</li>
                <li>Statistiken & Fakten: ${targetData.techStats.geoSignals.citability.hasStatistics ? '✅' : '❌'}</li>
                <li>Quellenangaben: ${targetData.techStats.geoSignals.citability.hasCitations ? '✅' : '❌'}</li>
                <li>Zusammenfassung/Fazit: ${targetData.techStats.geoSignals.llmReadability.hasSummary ? '✅' : '❌'}</li>
             </ul>
          </div>
      </div>

      <div class="grid md:grid-cols-2 gap-6 mt-6">
          <div class="${STYLES.card}">
             <h3 class="${STYLES.h3} text-emerald-700"><i class="bi bi-code-slash"></i> Technisches SEO</h3>
             <ul class="${STYLES.list} space-y-3">
                <li>
                    <strong>Überschriften:</strong>
                    ${targetData.techStats.structure.headings.h1 === 1 
                      ? '✅ Genau eine H1' 
                      : '⚠️ ' + targetData.techStats.structure.headings.h1 + ' H1-Tags'}
                    (H2: ${targetData.techStats.structure.headings.h2}, H3: ${targetData.techStats.structure.headings.h3})
                </li>
                <li>
                    <strong>Canonical:</strong>
                    ${targetData.techStats.indexing.canonical 
                      ? (targetData.techStats.indexing.canonicalMatchesUrl ? '✅ Self-referencing' : '⚠️ Zeigt auf andere URL') 
                      : '❌ Fehlt'}
                </li>
                <li>
                    <strong>Performance:</strong>
                    TTFB ${targetData.techStats.performance.rating} (${targetData.techStats.performance.ttfbMs}ms),
                    ${targetData.techStats.performance.renderBlockingScripts} blocking Scripts
                </li>
                <li>
                    <strong>Bilder:</strong>
                    ${targetData.techStats.imageAnalysis.withAlt}/${targetData.techStats.imageAnalysis.total} mit Alt-Text,
                    ${targetData.techStats.imageAnalysis.modernFormats} WebP/AVIF
                </li>
             </ul>
          </div>

          <div class="${STYLES.card}">
             <h3 class="${STYLES.h3} text-orange-700"><i class="bi bi-share"></i> Social & Links</h3>
             <ul class="${STYLES.list} space-y-3">
                <li>
                    <strong>Open Graph:</strong>
                    ${targetData.techStats.socialMeta.og.title && targetData.techStats.socialMeta.og.image 
                      ? '✅ Vollständig' 
                      : '⚠️ Unvollständig'}
                </li>
                <li>
                    <strong>Twitter Card:</strong>
                    ${targetData.techStats.socialMeta.twitter.card || '❌ Fehlt'}
                </li>
                <li>
                    <strong>Interne Links:</strong>
                    ${targetData.techStats.linkStructure.internalCount}
                    ${targetData.techStats.linkStructure.internalCount < 5 ? '⚠️ Wenig' : '✅'}
                </li>
                <li>
                    <strong>Externe Links:</strong>
                    ${targetData.techStats.linkStructure.externalCount}
                    (${targetData.techStats.linkStructure.nofollowCount} nofollow)
                </li>
             </ul>
          </div>
      </div>

      <div class="${STYLES.card} mt-6 bg-gradient-to-r from-indigo-50 to-purple-50">
         <h3 class="${STYLES.h3}"><i class="bi bi-list-check"></i> Priorisierter Maßnahmen-Plan</h3>
         <p class="mb-3 text-sm text-gray-600">Sortiert nach Impact für SEO & GEO:</p>
         
         <div class="space-y-4">
            <div>
               <h4 class="font-bold text-red-600 text-sm mb-2">🔴 HOHE PRIORITÄT</h4>
               <ol class="list-decimal pl-5 space-y-1 text-sm">
                  ${!targetData.techStats.hasSchema ? '<li><strong>Schema.org implementieren:</strong> Mindestens Organization + Article/WebPage Schema als JSON-LD einbauen.</li>' : ''}
                  ${!targetData.techStats.trustSignals.hasAuthor ? '<li><strong>Autor-Signal hinzufügen:</strong> Meta-Author Tag + Author Schema mit Credentials.</li>' : ''}
                  ${!targetData.techStats.indexing.canonical ? '<li><strong>Canonical Tag setzen:</strong> Self-referencing Canonical auf jeder Seite.</li>' : ''}
                  ${targetData.techStats.contentMetrics.thinContent ? '<li><strong>Content erweitern:</strong> Aktuell nur ' + targetData.techStats.contentMetrics.wordCount + ' Wörter. Mindestens 800+ anstreben.</li>' : ''}
                  ${!targetData.techStats.geoSignals.citability.hasFaqStructure ? '<li><strong>FAQ-Bereich ergänzen:</strong> 3-5 häufige Fragen mit Schema-Markup für KI-Sichtbarkeit.</li>' : ''}
               </ol>
            </div>
            
            <div>
               <h4 class="font-bold text-yellow-600 text-sm mb-2">🟡 MITTLERE PRIORITÄT</h4>
               <ol class="list-decimal pl-5 space-y-1 text-sm">
                  ${!targetData.techStats.geoSignals.citability.hasDefinitions ? '<li><strong>Definitionen einbauen:</strong> Wichtige Begriffe klar definieren ("X ist..." Sätze).</li>' : ''}
                  ${!targetData.techStats.geoSignals.llmReadability.hasSummary ? '<li><strong>Zusammenfassung ergänzen:</strong> TL;DR oder Fazit-Box am Anfang/Ende.</li>' : ''}
                  ${!targetData.techStats.socialMeta.og.image ? '<li><strong>OG-Image setzen:</strong> Ansprechendes Vorschaubild für Social Shares.</li>' : ''}
                  ${targetData.techStats.imageAnalysis.total > 0 && targetData.techStats.imageAnalysis.withAlt < targetData.techStats.imageAnalysis.total ? '<li><strong>Alt-Texte vervollständigen:</strong> ' + (targetData.techStats.imageAnalysis.total - targetData.techStats.imageAnalysis.withAlt) + ' Bilder ohne Alt-Text.</li>' : ''}
               </ol>
            </div>
         </div>
      </div>
      
      Antworte NUR mit HTML. Keine Einleitung, kein Markdown.
    `;

    // Stream zurückgeben (wie im Original)
    const result = await streamTextSafe({
      prompt: singlePrompt,
    });
    
    return result.toTextStreamResponse();

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
