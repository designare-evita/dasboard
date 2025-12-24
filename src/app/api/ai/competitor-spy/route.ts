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

interface SeoBasics {
  hasViewport: boolean;
  hasCharset: boolean;
  hasLanguage: boolean;
  language: string | null;
}

interface IndexingSignals {
  canonical: string | null;
  canonicalMatchesUrl: boolean;
  robotsMeta: string | null;
  isIndexable: boolean;
  hreflang: { lang: string; url: string }[];
  pagination: { prev: string | null; next: string | null };
}

// ============================================================================
// NEU: E-E-A-T VOLLSTÄNDIGES INTERFACE
// ============================================================================

interface EEATSignals {
  // EXPERIENCE - Erfahrung
  experience: {
    hasFirstPersonNarrative: boolean;      // "Ich habe...", "In meiner Erfahrung..."
    hasPersonalStories: boolean;           // Storytelling-Elemente
    hasCaseStudies: boolean;               // Fallstudien, Beispiele aus der Praxis
    hasTestimonials: boolean;              // Kundenstimmen, Erfahrungsberichte
    hasPortfolio: boolean;                 // Referenzen, Arbeitsproben
    experienceScore: number;               // 0-100
  };
  // EXPERTISE - Fachwissen
  expertise: {
    hasAuthorBio: boolean;                 // Autorenbeschreibung
    hasCredentials: boolean;               // Qualifikationen, Zertifikate
    hasDetailedExplanations: boolean;      // Tiefgehende Erklärungen
    hasTechnicalTerms: boolean;            // Fachbegriffe (korrekt verwendet)
    hasMethodology: boolean;               // Methodik erklärt
    hasDataDrivenContent: boolean;         // Datenbasierte Aussagen
    expertiseScore: number;                // 0-100
  };
  // AUTHORITATIVENESS - Autorität
  authoritativeness: {
    hasOrganizationSchema: boolean;        // Organization Schema
    hasPersonSchema: boolean;              // Person Schema mit Details
    hasSameAsLinks: boolean;               // Verknüpfung zu externen Profilen
    sameAsLinks: string[];                 // Konkrete Links
    hasExternalCitations: boolean;         // Zitiert externe Quellen
    hasAwards: boolean;                    // Auszeichnungen, Zertifikate
    hasMentions: boolean;                  // "Bekannt aus...", Medienerwähnungen
    hasPartnerships: boolean;              // Partner-Logos, Kooperationen
    authorityScore: number;                // 0-100
  };
  // TRUSTWORTHINESS - Vertrauenswürdigkeit
  trustworthiness: {
    hasImprint: boolean;                   // Impressum
    hasPrivacyPolicy: boolean;             // Datenschutz
    hasContact: boolean;                   // Kontaktmöglichkeit
    hasAboutPage: boolean;                 // Über uns
    hasTeamPage: boolean;                  // Team-Seite
    hasPhysicalAddress: boolean;           // Physische Adresse
    hasPhoneNumber: boolean;               // Telefonnummer
    hasSecureConnection: boolean;          // HTTPS (angenommen)
    hasTransparentPricing: boolean;        // Preise sichtbar
    hasClearCTA: boolean;                  // Klare Handlungsaufforderungen
    trustScore: number;                    // 0-100
  };
  // Dynamisch geladene Inhalte Warnung
  hasDynamicFooter: boolean;
  dynamicContentWarning: string | null;
  // Gesamt E-E-A-T
  overallScore: number;                    // 0-100
  overallRating: 'Exzellent' | 'Gut' | 'Mittel' | 'Schwach' | 'Kritisch';
}

// ============================================================================
// NEU: CONTENT-QUALITÄT & STORYTELLING INTERFACE
// ============================================================================

interface ContentQuality {
  // Basis-Metriken
  wordCount: number;
  readingTimeMin: number;
  paragraphCount: number;
  avgWordsPerParagraph: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  
  // Content-Tiefe
  thinContent: boolean;
  hasTableOfContents: boolean;
  contentDepthScore: number;
  
  // STORYTELLING & ENGAGEMENT
  storytelling: {
    hasNarrativeStructure: boolean;        // Einleitung-Hauptteil-Schluss
    hasHook: boolean;                      // Aufmerksamkeitsfänger am Anfang
    hasEmotionalLanguage: boolean;         // Emotionale Sprache
    hasAnecdotes: boolean;                 // Anekdoten, persönliche Geschichten
    hasConflictResolution: boolean;        // Problem-Lösung Struktur
    hasCallToAction: boolean;              // CTA am Ende
    storytellingScore: number;             // 0-100
  };
  
  // LESBARKEIT & STRUKTUR
  readability: {
    hasShortParagraphs: boolean;           // Absätze < 150 Wörter
    hasSubheadings: boolean;               // Regelmäßige Zwischenüberschriften
    hasBulletPoints: boolean;              // Aufzählungen
    hasNumberedLists: boolean;             // Nummerierte Listen
    hasHighlightedText: boolean;           // Hervorgehobener Text (bold, etc.)
    hasVisualBreaks: boolean;              // Bilder, Videos zwischen Text
    readabilityScore: number;              // 0-100
  };
  
  // UNIQUE VALUE
  uniqueValue: {
    hasOriginalResearch: boolean;          // Eigene Studien/Daten
    hasUniqueInsights: boolean;            // Einzigartige Einsichten
    hasActionableAdvice: boolean;          // Umsetzbare Tipps
    hasExamples: boolean;                  // Konkrete Beispiele
    hasComparisons: boolean;               // Vergleiche
    hasTools: boolean;                     // Tools, Rechner, Downloads
    uniqueValueScore: number;              // 0-100
  };
  
  // Gesamt Content Score
  overallContentScore: number;             // 0-100
  contentRating: 'Exzellent' | 'Gut' | 'Mittel' | 'Schwach';
}

// ============================================================================
// NEU: ERWEITERTE GEO SIGNALE
// ============================================================================

interface GeoSignals {
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
    hasKnowsAbout: boolean;                // knowsAbout im Person Schema
    hasJobTitle: boolean;                  // jobTitle definiert
  };
  
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
    hasCodeBlocks: boolean;                // Code-Beispiele
    citabilityScore: number;
  };
  
  factualSignals: {
    hasOriginalData: boolean;
    hasExpertQuotes: boolean;
    hasFirstPersonExpertise: boolean;
    hasSourceReferences: boolean;
    hasLastUpdated: boolean;
    hasPublishDate: boolean;
  };
  
  llmReadability: {
    hasSummary: boolean;
    hasKeyTakeaways: boolean;
    hasClearTopicSentences: boolean;
    hasInfographics: boolean;
    questionCount: number;
    answerPatternCount: number;
    hasDirectAnswers: boolean;             // Direkte Antworten auf Fragen
  };
  
  geoScore: number;
  geoRating: 'Exzellent' | 'Gut' | 'Mittel' | 'Verbesserungswürdig';
}

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
  performance: PerformanceMetrics;
  hasSchema: boolean;
  schemaDetails: {
    types: string[];
    hasMultipleSchemas: boolean;
    rawSchemas: object[];
  };
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
  seoBasics: SeoBasics;
  indexing: IndexingSignals;
  contentQuality: ContentQuality;
  socialMeta: SocialMeta;
  eeat: EEATSignals;
  geoSignals: GeoSignals;
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  const cleaned = cleanText(text);
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(word => word.length > 0).length;
}

function countSentences(text: string): number {
  const cleaned = cleanText(text);
  if (!cleaned) return 0;
  // Zähle Satzenden (. ! ?)
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 10);
  return sentences.length;
}

// ============================================================================
// CMS DETECTION
// ============================================================================

function detectCMS(html: string, $: cheerio.CheerioAPI): { cms: string; isBuilder: boolean } {
  const htmlLower = html.toLowerCase();
  const builders = ['wix', 'squarespace', 'jimdo', 'shopify', 'weebly', 'webflow', 'elementor', 'divi', 'clickfunnels'];
  
  let detectedCms = 'Custom Code / Unbekannt';
  
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

  const isBuilder = builders.some(b => detectedCms.toLowerCase().includes(b) || htmlLower.includes(b));
  return { cms: detectedCms, isBuilder };
}

// ============================================================================
// SEO BASICS
// ============================================================================

function analyzeSeoBasics($: cheerio.CheerioAPI): SeoBasics {
  return {
    hasViewport: $('meta[name="viewport"]').length > 0,
    hasCharset: $('meta[charset]').length > 0 || $('meta[http-equiv="Content-Type"]').length > 0,
    hasLanguage: !!$('html').attr('lang'),
    language: $('html').attr('lang') || null
  };
}

// ============================================================================
// INDEXIERUNG
// ============================================================================

function analyzeIndexing($: cheerio.CheerioAPI, baseUrl: string): IndexingSignals {
  const canonicalTag = $('link[rel="canonical"]').attr('href');
  let canonicalMatchesUrl = false;
  
  if (canonicalTag) {
    try {
      const canonicalUrl = new URL(canonicalTag, baseUrl).href;
      const normalizedBase = new URL(baseUrl).href;
      canonicalMatchesUrl = canonicalUrl === normalizedBase;
    } catch {}
  }
  
  const robotsMeta = $('meta[name="robots"]').attr('content') || null;
  const isIndexable = !robotsMeta || (!robotsMeta.includes('noindex') && !robotsMeta.includes('none'));
  
  const hreflang: { lang: string; url: string }[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang');
    const url = $(el).attr('href');
    if (lang && url) hreflang.push({ lang, url });
  });
  
  return {
    canonical: canonicalTag || null,
    canonicalMatchesUrl,
    robotsMeta,
    isIndexable,
    hreflang,
    pagination: {
      prev: $('link[rel="prev"]').attr('href') || null,
      next: $('link[rel="next"]').attr('href') || null
    }
  };
}

// ============================================================================
// SCHEMA.ORG ANALYSE (GEFIXT: @graph Support)
// ============================================================================

interface SchemaAnalysis {
  types: string[];
  hasMultipleSchemas: boolean;
  rawSchemas: object[];
  sameAsLinks: string[];
  personData: {
    name: string | null;
    jobTitle: string | null;
    hasKnowsAbout: boolean;
    hasSameAs: boolean;
  } | null;
  organizationData: {
    name: string | null;
    hasSameAs: boolean;
  } | null;
}

function analyzeSchemaDetails($: cheerio.CheerioAPI): SchemaAnalysis {
  const schemas: object[] = [];
  const types: string[] = [];
  const sameAsLinks: string[] = [];
  let personData: SchemaAnalysis['personData'] = null;
  let organizationData: SchemaAnalysis['organizationData'] = null;
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      
      const parsed = JSON.parse(content);
      schemas.push(parsed);
      
      // Rekursive Extraktion für @graph Strukturen
      const extractFromObject = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        // Typ extrahieren
        if (obj['@type']) {
          const objTypes = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
          types.push(...objTypes);
          
          // Person Schema Daten
          if (objTypes.some(t => t.toLowerCase() === 'person')) {
            personData = {
              name: obj.name || null,
              jobTitle: obj.jobTitle || null,
              hasKnowsAbout: !!obj.knowsAbout,
              hasSameAs: !!obj.sameAs
            };
          }
          
          // Organization Schema Daten
          if (objTypes.some(t => t.toLowerCase().includes('organization'))) {
            organizationData = {
              name: obj.name || null,
              hasSameAs: !!obj.sameAs
            };
          }
        }
        
        // sameAs extrahieren (GEFIXT!)
        if (obj.sameAs) {
          const links = Array.isArray(obj.sameAs) ? obj.sameAs : [obj.sameAs];
          sameAsLinks.push(...links.filter((l: any) => typeof l === 'string'));
        }
        
        // @graph durchsuchen
        if (obj['@graph'] && Array.isArray(obj['@graph'])) {
          obj['@graph'].forEach(extractFromObject);
        }
      };
      
      extractFromObject(parsed);
    } catch {}
  });
  
  return {
    types: [...new Set(types)],
    hasMultipleSchemas: schemas.length > 1,
    rawSchemas: schemas,
    sameAsLinks: [...new Set(sameAsLinks)],
    personData,
    organizationData
  };
}

// ============================================================================
// E-E-A-T ANALYSE (NEU & VOLLSTÄNDIG)
// ============================================================================

function analyzeEEAT($: cheerio.CheerioAPI, html: string, schemaData: SchemaAnalysis): EEATSignals {
  const bodyText = $('body').text();
  const bodyTextLower = bodyText.toLowerCase();
  const htmlLower = html.toLowerCase();
  
  // Dynamischer Content Check
  const hasDynamicFooter = $('#footer-placeholder, [id*="footer-placeholder"], footer:empty').length > 0;
  const hasDynamicHeader = $('#header-placeholder, [id*="header-placeholder"]').length > 0;
  const dynamicContentWarning = (hasDynamicFooter || hasDynamicHeader) 
    ? 'Teile der Seite werden dynamisch geladen (JS). Trust-Signale wie Impressum/Datenschutz könnten vorhanden sein, aber nicht im statischen HTML sichtbar.'
    : null;
  
  // === EXPERIENCE (Erfahrung) ===
  const hasFirstPersonNarrative = 
    /\b(ich habe|in meiner erfahrung|ich arbeite seit|ich bin seit|meine erfahrung|aus meiner sicht)\b/i.test(bodyText);
  
  const hasPersonalStories = 
    /\b(eines tages|ich erinnere mich|vor einiger zeit|als ich|dabei ist mir aufgefallen|mein weg)\b/i.test(bodyText) ||
    $('[class*="story"], [class*="testimonial"], [class*="case-study"]').length > 0;
  
  const hasCaseStudies = 
    /\b(fallstudie|case study|praxisbeispiel|kundenbeispiel|erfolgsgeschichte|projekt:|referenz)\b/i.test(bodyText) ||
    $('[class*="case"], [class*="portfolio"], [class*="project"]').length > 0;
  
  const hasTestimonials = 
    $('[class*="testimonial"], [class*="review"], [class*="kundenstimme"], blockquote[class*="quote"]').length > 0 ||
    /\b(kunde sagt|kundenmeinung|bewertung|rezension)\b/i.test(bodyTextLower);
  
  const hasPortfolio = 
    $('[class*="portfolio"], [class*="referenz"], [class*="work"], [class*="projekt"]').length > 0 ||
    /\b(portfolio|referenzen|unsere arbeit|projekte|arbeitsproben)\b/i.test(bodyTextLower);
  
  let experienceScore = 0;
  if (hasFirstPersonNarrative) experienceScore += 25;
  if (hasPersonalStories) experienceScore += 20;
  if (hasCaseStudies) experienceScore += 25;
  if (hasTestimonials) experienceScore += 15;
  if (hasPortfolio) experienceScore += 15;
  experienceScore = Math.min(experienceScore, 100);
  
  // === EXPERTISE (Fachwissen) ===
  const hasAuthorBio = 
    $('[class*="author-bio"], [class*="about-author"], [class*="verfasser"]').length > 0 ||
    schemaData.personData?.jobTitle !== null ||
    /\b(über den autor|über mich|zur person|vita|biografie)\b/i.test(bodyTextLower);
  
  const hasCredentials = 
    /\b(zertifiziert|diplom|master|bachelor|dr\.|prof\.|certified|qualifikation|ausbildung)\b/i.test(bodyText) ||
    schemaData.personData?.hasKnowsAbout === true;
  
  const hasDetailedExplanations = 
    countWords(bodyText) > 800 &&
    $('h2, h3').length >= 3;
  
  const hasTechnicalTerms = 
    /\b(api|framework|algorithmus|datenbank|server|backend|frontend|seo|ux|ui|kpi|roi)\b/i.test(bodyText);
  
  const hasMethodology = 
    /\b(methode|vorgehen|prozess|schritt für schritt|anleitung|workflow|so funktioniert)\b/i.test(bodyTextLower);
  
  const hasDataDrivenContent = 
    /\d+\s*%|\d+\s*(prozent|euro|dollar|nutzer|kunden|projekte)/i.test(bodyText);
  
  let expertiseScore = 0;
  if (hasAuthorBio) expertiseScore += 20;
  if (hasCredentials) expertiseScore += 20;
  if (hasDetailedExplanations) expertiseScore += 20;
  if (hasTechnicalTerms) expertiseScore += 15;
  if (hasMethodology) expertiseScore += 15;
  if (hasDataDrivenContent) expertiseScore += 10;
  expertiseScore = Math.min(expertiseScore, 100);
  
  // === AUTHORITATIVENESS (Autorität) ===
  const hasOrganizationSchema = schemaData.types.some(t => t.toLowerCase().includes('organization'));
  const hasPersonSchema = schemaData.types.some(t => t.toLowerCase() === 'person');
  const hasSameAsLinks = schemaData.sameAsLinks.length > 0;
  
  const hasExternalCitations = 
    $('a[href*="wikipedia"], a[href*="doi.org"], a[href*="scholar.google"], cite, [class*="source"]').length > 0 ||
    /\b(quelle:|laut|gemäß|studie von|nach angaben)\b/i.test(bodyText);
  
  const hasAwards = 
    /\b(auszeichnung|award|preis|gewinner|zertifikat|siegel|top \d+)\b/i.test(bodyTextLower) ||
    $('[class*="award"], [class*="badge"], [class*="certificate"]').length > 0;
  
  const hasMentions = 
    /\b(bekannt aus|featured in|erwähnt in|gesehen bei|presse|media)\b/i.test(bodyTextLower) ||
    $('[class*="press"], [class*="media"], [class*="featured"]').length > 0;
  
  const hasPartnerships = 
    /\b(partner|kooperation|zusammenarbeit|kunde von|arbeitet mit)\b/i.test(bodyTextLower) ||
    $('[class*="partner"], [class*="client"], [class*="logo-wall"]').length > 0;
  
  let authorityScore = 0;
  if (hasOrganizationSchema || hasPersonSchema) authorityScore += 20;
  if (hasSameAsLinks) authorityScore += 25;
  if (hasExternalCitations) authorityScore += 20;
  if (hasAwards) authorityScore += 15;
  if (hasMentions) authorityScore += 10;
  if (hasPartnerships) authorityScore += 10;
  authorityScore = Math.min(authorityScore, 100);
  
  // === TRUSTWORTHINESS (Vertrauen) ===
  // GEFIXT: Berücksichtigt auch Schema und verschiedene Schreibweisen
  const allLinkText = $('a').map((_, el) => $(el).text().toLowerCase()).get().join(' ');
  const allLinkHrefs = $('a').map((_, el) => $(el).attr('href')?.toLowerCase() || '').get().join(' ');
  
  const hasImprint = 
    /impressum|imprint|anbieterkennzeichnung|legal notice/.test(allLinkText) ||
    /impressum|imprint|legal/.test(allLinkHrefs);
  
  const hasPrivacyPolicy = 
    /datenschutz|privacy|dsgvo|gdpr/.test(allLinkText) ||
    /datenschutz|privacy|dsgvo/.test(allLinkHrefs);
  
  const hasContact = 
    /kontakt|contact|anfrage/.test(allLinkText) ||
    /kontakt|contact/.test(allLinkHrefs) ||
    $('a[href^="mailto:"], a[href^="tel:"]').length > 0;
  
  const hasAboutPage = 
    /über uns|about|über mich|wir sind/.test(allLinkText) ||
    /about|ueber/.test(allLinkHrefs);
  
  const hasTeamPage = 
    /team|mitarbeiter|ansprechpartner/.test(allLinkText);
  
  const hasPhysicalAddress = 
    /\b\d{4,5}\s+\w+|\bstraße|gasse|weg|platz|allee\b/i.test(bodyText) ||
    schemaData.rawSchemas.some((s: any) => 
      JSON.stringify(s).includes('PostalAddress') || 
      JSON.stringify(s).includes('addressLocality')
    );
  
  const hasPhoneNumber = 
    /\+\d{2}|tel:|telefon|\d{3,4}[\s/-]\d+/i.test(bodyText) ||
    $('a[href^="tel:"]').length > 0;
  
  const hasTransparentPricing = 
    /\b(preis|€|\d+\s*euro|kostenlos|gratis|ab\s+\d+)\b/i.test(bodyText) ||
    $('[class*="price"], [class*="preis"]').length > 0;
  
  const hasClearCTA = 
    $('button, [class*="cta"], [class*="btn"], a[class*="button"]').length > 0;
  
  let trustScore = 0;
  if (hasImprint) trustScore += 20;
  if (hasPrivacyPolicy) trustScore += 15;
  if (hasContact) trustScore += 15;
  if (hasAboutPage) trustScore += 10;
  if (hasTeamPage) trustScore += 5;
  if (hasPhysicalAddress) trustScore += 15;
  if (hasPhoneNumber) trustScore += 10;
  if (hasTransparentPricing) trustScore += 5;
  if (hasClearCTA) trustScore += 5;
  
  // Wenn dynamischer Footer, Score nicht zu hart bestrafen
  if (hasDynamicFooter && trustScore < 50) {
    trustScore = Math.max(trustScore, 30); // Mindestens 30 wegen Unsicherheit
  }
  trustScore = Math.min(trustScore, 100);
  
  // === GESAMT E-E-A-T SCORE ===
  const overallScore = Math.round(
    (experienceScore * 0.2) + 
    (expertiseScore * 0.25) + 
    (authorityScore * 0.25) + 
    (trustScore * 0.3)
  );
  
  let overallRating: EEATSignals['overallRating'] = 'Kritisch';
  if (overallScore >= 80) overallRating = 'Exzellent';
  else if (overallScore >= 60) overallRating = 'Gut';
  else if (overallScore >= 40) overallRating = 'Mittel';
  else if (overallScore >= 20) overallRating = 'Schwach';
  
  return {
    experience: {
      hasFirstPersonNarrative,
      hasPersonalStories,
      hasCaseStudies,
      hasTestimonials,
      hasPortfolio,
      experienceScore
    },
    expertise: {
      hasAuthorBio,
      hasCredentials,
      hasDetailedExplanations,
      hasTechnicalTerms,
      hasMethodology,
      hasDataDrivenContent,
      expertiseScore
    },
    authoritativeness: {
      hasOrganizationSchema,
      hasPersonSchema,
      hasSameAsLinks,
      sameAsLinks: schemaData.sameAsLinks,
      hasExternalCitations,
      hasAwards,
      hasMentions,
      hasPartnerships,
      authorityScore
    },
    trustworthiness: {
      hasImprint,
      hasPrivacyPolicy,
      hasContact,
      hasAboutPage,
      hasTeamPage,
      hasPhysicalAddress,
      hasPhoneNumber,
      hasSecureConnection: true, // Annahme HTTPS
      hasTransparentPricing,
      hasClearCTA,
      trustScore
    },
    hasDynamicFooter,
    dynamicContentWarning,
    overallScore,
    overallRating
  };
}

// ============================================================================
// CONTENT QUALITÄT & STORYTELLING ANALYSE (NEU)
// ============================================================================

function analyzeContentQuality($: cheerio.CheerioAPI): ContentQuality {
  // Clone für saubere Textextraktion
  const $clone = cheerio.load($.html());
  $clone('script, style, nav, footer, header, aside, iframe, svg, noscript').remove();
  
  const mainContent = $clone('main').text() || $clone('article').text() || $clone('body').text();
  const cleanedContent = cleanText(mainContent);
  
  const wordCount = countWords(cleanedContent);
  const sentenceCount = countSentences(cleanedContent);
  const readingTimeMin = Math.ceil(wordCount / 200);
  
  const paragraphs = $('p').filter((_, el) => $(el).text().trim().length > 50);
  const paragraphCount = paragraphs.length;
  const avgWordsPerParagraph = paragraphCount > 0 ? Math.round(wordCount / paragraphCount) : 0;
  const avgWordsPerSentence = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;
  
  const thinContent = wordCount < 300;
  const hasTableOfContents = 
    $('[class*="toc"], [id*="toc"], [class*="table-of-contents"], nav[class*="content"]').length > 0 ||
    $('a[href^="#"]').length >= 5;
  
  // Content Depth Score
  let contentDepthScore = 0;
  if (wordCount >= 300) contentDepthScore += 15;
  if (wordCount >= 600) contentDepthScore += 15;
  if (wordCount >= 1000) contentDepthScore += 15;
  if (wordCount >= 1500) contentDepthScore += 10;
  if (paragraphCount >= 5) contentDepthScore += 15;
  if (hasTableOfContents) contentDepthScore += 15;
  if ($('h2').length >= 3) contentDepthScore += 15;
  contentDepthScore = Math.min(contentDepthScore, 100);
  
  // === STORYTELLING ===
  const bodyText = $('body').text();
  
  const hasNarrativeStructure = 
    $('h1').length > 0 && 
    $('h2, h3').length >= 2 &&
    $('p').length >= 3;
  
  const hasHook = 
    /\b(stell dir vor|kennst du|hast du dich|wusstest du|achtung|spoiler|geheimnis)\b/i.test(bodyText.substring(0, 500));
  
  const hasEmotionalLanguage = 
    /\b(erstaunlich|unglaublich|fantastisch|frustrierend|nervig|liebe|hasse|begeistert|enttäuscht)\b/i.test(bodyText);
  
  const hasAnecdotes = 
    /\b(eines tages|kürzlich|vor kurzem|ich erinnere|lustigerweise|interessanterweise)\b/i.test(bodyText);
  
  const hasConflictResolution = 
    /\b(problem|lösung|herausforderung|aber|jedoch|stattdessen|die antwort|so geht's)\b/i.test(bodyText);
  
  const hasCallToAction = 
    $('[class*="cta"], button, [class*="btn"]').length > 0 ||
    /\b(jetzt|hier klicken|mehr erfahren|kontakt|anfragen|starten)\b/i.test(bodyText);
  
  let storytellingScore = 0;
  if (hasNarrativeStructure) storytellingScore += 20;
  if (hasHook) storytellingScore += 20;
  if (hasEmotionalLanguage) storytellingScore += 15;
  if (hasAnecdotes) storytellingScore += 20;
  if (hasConflictResolution) storytellingScore += 15;
  if (hasCallToAction) storytellingScore += 10;
  storytellingScore = Math.min(storytellingScore, 100);
  
  // === LESBARKEIT ===
  const hasShortParagraphs = avgWordsPerParagraph < 150;
  const hasSubheadings = $('h2, h3, h4').length >= 3;
  
  // GEFIXT: Listen-Detection
  const hasBulletPoints = $('ul').filter((_, el) => $(el).find('li').length >= 2).length > 0;
  const hasNumberedLists = $('ol').filter((_, el) => $(el).find('li').length >= 2).length > 0;
  
  const hasHighlightedText = 
    $('strong, b, em, mark, [class*="highlight"]').length >= 3;
  
  const hasVisualBreaks = 
    $('img, video, figure, [class*="image"], svg').length > 0;
  
  let readabilityScore = 0;
  if (hasShortParagraphs) readabilityScore += 15;
  if (hasSubheadings) readabilityScore += 20;
  if (hasBulletPoints) readabilityScore += 20;
  if (hasNumberedLists) readabilityScore += 15;
  if (hasHighlightedText) readabilityScore += 15;
  if (hasVisualBreaks) readabilityScore += 15;
  readabilityScore = Math.min(readabilityScore, 100);
  
  // === UNIQUE VALUE ===
  const hasOriginalResearch = 
    /\b(unsere studie|wir haben getestet|unsere analyse|eigene daten|selbst entwickelt)\b/i.test(bodyText);
  
  const hasUniqueInsights = 
    /\b(mein tipp|geheimtipp|insider|wenig bekannt|kaum jemand weiß)\b/i.test(bodyText);
  
  const hasActionableAdvice = 
    /\b(so geht's|schritt|anleitung|tipp|trick|checklist|to-do)\b/i.test(bodyText) ||
    $('ol li, [class*="step"]').length >= 3;
  
  const hasExamples = 
    /\b(beispiel|zum beispiel|etwa|wie z\.?b\.?|konkret)\b/i.test(bodyText);
  
  const hasComparisons = 
    /\b(vergleich|vs\.|versus|im gegensatz|anders als|besser als)\b/i.test(bodyText) ||
    $('table').length > 0;
  
  const hasTools = 
    $('[class*="calculator"], [class*="tool"], [class*="generator"], form, [class*="download"]').length > 0 ||
    /\b(rechner|tool|generator|download|vorlage|template)\b/i.test(bodyText);
  
  let uniqueValueScore = 0;
  if (hasOriginalResearch) uniqueValueScore += 25;
  if (hasUniqueInsights) uniqueValueScore += 20;
  if (hasActionableAdvice) uniqueValueScore += 20;
  if (hasExamples) uniqueValueScore += 15;
  if (hasComparisons) uniqueValueScore += 10;
  if (hasTools) uniqueValueScore += 10;
  uniqueValueScore = Math.min(uniqueValueScore, 100);
  
  // === GESAMT CONTENT SCORE ===
  const overallContentScore = Math.round(
    (contentDepthScore * 0.25) +
    (storytellingScore * 0.25) +
    (readabilityScore * 0.25) +
    (uniqueValueScore * 0.25)
  );
  
  let contentRating: ContentQuality['contentRating'] = 'Schwach';
  if (overallContentScore >= 75) contentRating = 'Exzellent';
  else if (overallContentScore >= 55) contentRating = 'Gut';
  else if (overallContentScore >= 35) contentRating = 'Mittel';
  
  return {
    wordCount,
    readingTimeMin,
    paragraphCount,
    avgWordsPerParagraph,
    sentenceCount,
    avgWordsPerSentence,
    thinContent,
    hasTableOfContents,
    contentDepthScore,
    storytelling: {
      hasNarrativeStructure,
      hasHook,
      hasEmotionalLanguage,
      hasAnecdotes,
      hasConflictResolution,
      hasCallToAction,
      storytellingScore
    },
    readability: {
      hasShortParagraphs,
      hasSubheadings,
      hasBulletPoints,
      hasNumberedLists,
      hasHighlightedText,
      hasVisualBreaks,
      readabilityScore
    },
    uniqueValue: {
      hasOriginalResearch,
      hasUniqueInsights,
      hasActionableAdvice,
      hasExamples,
      hasComparisons,
      hasTools,
      uniqueValueScore
    },
    overallContentScore,
    contentRating
  };
}

// ============================================================================
// GEO SIGNALE (ERWEITERT & GEFIXT)
// ============================================================================

function analyzeGeoSignals($: cheerio.CheerioAPI, html: string, schemaData: SchemaAnalysis): GeoSignals {
  const bodyText = $('body').text();
  const bodyTextLower = bodyText.toLowerCase();
  
  // Entity Clarity (mit sameAs aus schemaData)
  const entityClarity = {
    schemaTypes: schemaData.types,
    hasOrganizationSchema: schemaData.types.some(t => t.toLowerCase().includes('organization')),
    hasPersonSchema: schemaData.types.some(t => t.toLowerCase() === 'person'),
    hasArticleSchema: schemaData.types.some(t => t.toLowerCase().includes('article')),
    hasFaqSchema: schemaData.types.some(t => t.toLowerCase() === 'faqpage'),
    hasHowToSchema: schemaData.types.some(t => t.toLowerCase() === 'howto'),
    hasBreadcrumbSchema: schemaData.types.some(t => t.toLowerCase().includes('breadcrumb')),
    hasProductSchema: schemaData.types.some(t => t.toLowerCase() === 'product'),
    hasLocalBusinessSchema: schemaData.types.some(t => t.toLowerCase().includes('localbusiness')),
    sameAsLinks: schemaData.sameAsLinks,
    hasKnowsAbout: schemaData.personData?.hasKnowsAbout || false,
    hasJobTitle: schemaData.personData?.jobTitle !== null
  };
  
  // Citability
  const definitionPatterns = /(ist|sind|bezeichnet|bedeutet|definiert als|versteht man|nennt man)\s+[^.]{10,}\./gi;
  const hasDefinitions = definitionPatterns.test(bodyText);
  
  const hasFaqStructure = 
    entityClarity.hasFaqSchema ||
    $('details summary, [class*="faq"], [id*="faq"], .accordion').length >= 3 ||
    $('h2, h3, h4').filter((_, el) => /\?$/.test($(el).text().trim())).length >= 3;
  
  const hasHowToStructure = 
    entityClarity.hasHowToSchema ||
    $('[class*="step"], [class*="how-to"], ol li').length >= 3;
  
  // GEFIXT: Listen korrekt erkennen
  const hasNumberedLists = $('ol').filter((_, el) => $(el).find('li').length >= 2).length > 0;
  const hasBulletLists = $('ul').filter((_, el) => $(el).find('li').length >= 2).length > 0;
  
  const hasDataTables = $('table').filter((_, el) => $(el).find('tr').length >= 2).length > 0;
  
  const statisticPatterns = /\d+(\.\d+)?%|\d{1,3}([.,]\d{3})+|\d+\s*(prozent|euro|dollar|usd|eur|millionen|milliarden)/gi;
  const hasStatistics = statisticPatterns.test(bodyText);
  
  const hasCitations = 
    $('cite, blockquote[cite], [class*="source"], [class*="reference"], sup a').length > 0 ||
    /quelle:|laut\s+\w+|gemäß|nach angaben|studie zeigt|research|study/i.test(bodyText);
  
  const hasQuotes = 
    $('blockquote, q').length > 0 ||
    /"[^"]{20,}"/.test(bodyText) ||
    /„[^"]{20,}"/.test(bodyText);
  
  const hasCodeBlocks = $('pre, code, [class*="code"]').length > 0;
  
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
  
  // Factual Signals
  const hasOriginalData = 
    /unsere (studie|analyse|daten|umfrage|erhebung)/i.test(bodyText) ||
    /wir haben (untersucht|analysiert|getestet|gemessen)/i.test(bodyText);
  
  const hasExpertQuotes = 
    /sagt|erklärt|betont|meint|so\s+\w+\s*:/i.test(bodyText) && $('blockquote').length > 0;
  
  const hasFirstPersonExpertise = 
    /in meiner (erfahrung|praxis|arbeit)|seit \d+ jahren|als (experte|spezialist|fachmann|berater)/i.test(bodyText);
  
  const hasSourceReferences = 
    $('a[href*="doi.org"], a[href*="pubmed"], a[href*="scholar.google"], [class*="footnote"]').length > 0 ||
    /\[\d+\]|\(et al\.\)|\(vgl\.|siehe auch/i.test(bodyText);
  
  const hasLastUpdated = 
    $('[class*="updated"], [class*="modified"], time[datetime]').length > 0 ||
    /aktualisiert|zuletzt geändert|stand:/i.test(bodyTextLower);
  
  const hasPublishDate = 
    $('meta[property="article:published_time"], time[datetime], [class*="date"]').length > 0;
  
  // LLM Readability
  const hasSummary = 
    $('[class*="summary"], [class*="tldr"], [class*="fazit"], [class*="zusammenfassung"]').length > 0 ||
    /zusammenfassung|fazit|im überblick|key takeaways|das wichtigste|tl;dr/i.test(bodyTextLower);
  
  const hasKeyTakeaways = 
    $('[class*="takeaway"], [class*="highlight"], [class*="key-point"]').length > 0 ||
    /wichtigste punkte|kernaussagen|merke dir/i.test(bodyTextLower);
  
  const hasClearTopicSentences = $('p strong:first-child, p b:first-child').length >= 3;
  
  const hasInfographics = $('figure, [class*="infographic"], svg, canvas').length > 0;
  
  const questionHeadings = $('h1, h2, h3, h4').filter((_, el) => /\?/.test($(el).text())).length;
  const questionCount = Math.min(questionHeadings + (bodyText.match(/\?/g) || []).length, 50);
  
  const answerPatterns = /die antwort|kurz gesagt|einfach erklärt|das bedeutet|konkret heißt das/gi;
  const answerPatternCount = (bodyText.match(answerPatterns) || []).length;
  
  const hasDirectAnswers = 
    /^(ja|nein|das ist|es ist|man kann|du kannst)/im.test(bodyText);
  
  // GEO Score
  let geoScore = 0;
  
  // Entity (max 30)
  if (schemaData.types.length > 0) geoScore += 10;
  if (entityClarity.hasOrganizationSchema || entityClarity.hasPersonSchema) geoScore += 10;
  if (schemaData.sameAsLinks.length > 0) geoScore += 10;
  
  // Citability (max 35)
  geoScore += Math.round(citabilityScore * 0.35);
  
  // Factual (max 20)
  if (hasOriginalData) geoScore += 5;
  if (hasExpertQuotes) geoScore += 5;
  if (hasFirstPersonExpertise) geoScore += 5;
  if (hasSourceReferences) geoScore += 5;
  
  // LLM Readability (max 15)
  if (hasSummary) geoScore += 5;
  if (hasKeyTakeaways) geoScore += 5;
  if (questionCount >= 3 && answerPatternCount >= 1) geoScore += 5;
  
  geoScore = Math.min(geoScore, 100);
  
  let geoRating: GeoSignals['geoRating'] = 'Verbesserungswürdig';
  if (geoScore >= 75) geoRating = 'Exzellent';
  else if (geoScore >= 50) geoRating = 'Gut';
  else if (geoScore >= 30) geoRating = 'Mittel';
  
  return {
    entityClarity,
    citability: {
      hasDefinitions,
      hasFaqStructure,
      hasHowToStructure,
      hasNumberedLists,
      hasBulletLists,
      hasDataTables,
      hasStatistics,
      hasCitations,
      hasQuotes,
      hasCodeBlocks,
      citabilityScore
    },
    factualSignals: {
      hasOriginalData,
      hasExpertQuotes,
      hasFirstPersonExpertise,
      hasSourceReferences,
      hasLastUpdated,
      hasPublishDate
    },
    llmReadability: {
      hasSummary,
      hasKeyTakeaways,
      hasClearTopicSentences,
      hasInfographics,
      questionCount,
      answerPatternCount,
      hasDirectAnswers
    },
    geoScore,
    geoRating
  };
}

// ============================================================================
// SOCIAL META
// ============================================================================

function analyzeSocialMeta($: cheerio.CheerioAPI): SocialMeta {
  const og = {
    title: $('meta[property="og:title"]').attr('content') || null,
    description: $('meta[property="og:description"]').attr('content') || null,
    image: $('meta[property="og:image"]').attr('content') || null,
    type: $('meta[property="og:type"]').attr('content') || null,
    url: $('meta[property="og:url"]').attr('content') || null
  };
  
  const twitter = {
    card: $('meta[name="twitter:card"]').attr('content') || null,
    site: $('meta[name="twitter:site"]').attr('content') || null,
    title: $('meta[name="twitter:title"]').attr('content') || null,
    description: $('meta[name="twitter:description"]').attr('content') || null,
    image: $('meta[name="twitter:image"]').attr('content') || null
  };
  
  const socialDomains = ['facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'xing.com', 'pinterest.com', 'github.com'];
  const socialProfileLinks: string[] = [];
  
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (socialDomains.some(domain => href.includes(domain)) && !socialProfileLinks.includes(href)) {
      socialProfileLinks.push(href);
    }
  });
  
  return {
    og,
    twitter,
    hasSocialProfiles: socialProfileLinks.length > 0,
    socialProfileLinks: socialProfileLinks.slice(0, 10)
  };
}

// ============================================================================
// HAUPTANALYSE
// ============================================================================

function analyzeTech(html: string, $: cheerio.CheerioAPI, baseUrl: string, ttfbMs: number): TechStats {
  const pageSizeKb = Math.round((Buffer.byteLength(html, 'utf8') / 1024) * 100) / 100;
  
  // Performance
  let perfRating: 'Schnell' | 'Mittel' | 'Langsam' = 'Mittel';
  if (ttfbMs < 300) perfRating = 'Schnell';
  else if (ttfbMs > 800) perfRating = 'Langsam';
  
  const resourceHints = {
    preconnect: $('link[rel="preconnect"]').length,
    prefetch: $('link[rel="prefetch"]').length,
    preload: $('link[rel="preload"]').length,
    dnsPrefetch: $('link[rel="dns-prefetch"]').length
  };
  
  const hasCriticalCss = $('style').filter((_, el) => {
    const content = $(el).html() || '';
    return content.length > 100 && content.length < 50000;
  }).length > 0;
  
  const allScripts = $('script[src]');
  let renderBlockingScripts = 0, asyncScripts = 0, deferScripts = 0;
  
  allScripts.each((_, el) => {
    const hasAsync = $(el).attr('async') !== undefined;
    const hasDefer = $(el).attr('defer') !== undefined;
    const isModule = $(el).attr('type') === 'module';
    if (hasAsync || isModule) asyncScripts++;
    else if (hasDefer) deferScripts++;
    else renderBlockingScripts++;
  });
  
  // Structure
  const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
  const foundTags = semanticTags.filter(tag => $(tag).length > 0);
  
  const headings = {
    h1: $('h1').length,
    h2: $('h2').length,
    h3: $('h3').length,
    h4: $('h4').length,
    h5: $('h5').length,
    h6: $('h6').length
  };
  
  const h1Texts = $('h1').map((_, el) => $(el).text().trim()).get();
  let headingHierarchyValid = headings.h1 === 1 && !(headings.h3 > 0 && headings.h2 === 0);
  
  let semanticScore = Math.round((foundTags.length / semanticTags.length) * 100);
  if (headings.h1 === 1) semanticScore += 10;
  semanticScore = Math.min(semanticScore, 100);
  
  // Schema
  const schemaData = analyzeSchemaDetails($);
  const hasSchema = schemaData.types.length > 0;
  
  // Images
  const images = $('img');
  let withAlt = 0, withEmptyAlt = 0, modernFormats = 0, lazyLoaded = 0;
  
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
  
  // Links
  let currentHost = '';
  try { currentHost = new URL(baseUrl).hostname.replace(/^www\./, ''); } catch {}
  
  const internalLinks: LinkInfo[] = [];
  const externalLinksSample: LinkInfo[] = [];
  let externalCount = 0, nofollowCount = 0, brokenLinkCandidates = 0;
  
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
        if (!internalLinks.some(l => l.href === absoluteUrl.href)) internalLinks.push(linkObj);
      } else {
        externalCount++;
        if (externalLinksSample.length < 5 && !externalLinksSample.some(l => l.href === absoluteUrl.href)) {
          externalLinksSample.push(linkObj);
        }
      }
    } catch { brokenLinkCandidates++; }
  });
  
  const cmsInfo = detectCMS(html, $);
  
  // Alle Analysen
  const seoBasics = analyzeSeoBasics($);
  const indexing = analyzeIndexing($, baseUrl);
  const contentQuality = analyzeContentQuality($);
  const socialMeta = analyzeSocialMeta($);
  const eeat = analyzeEEAT($, html, schemaData);
  const geoSignals = analyzeGeoSignals($, html, schemaData);
  
  return {
    pageSizeKb,
    performance: {
      ttfbMs,
      rating: perfRating,
      htmlSizeKb: pageSizeKb,
      resourceHints,
      hasCriticalCss,
      renderBlockingScripts,
      asyncScripts,
      deferScripts
    },
    hasSchema,
    schemaDetails: {
      types: schemaData.types,
      hasMultipleSchemas: schemaData.hasMultipleSchemas,
      rawSchemas: schemaData.rawSchemas
    },
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
      domDepth: $('*').length,
      isBuilder: cmsInfo.isBuilder
    },
    seoBasics,
    indexing,
    contentQuality,
    socialMeta,
    eeat,
    geoSignals
  };
}

// ============================================================================
// SCRAPER
// ============================================================================

async function scrapeContent(url: string) {
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0; +https://example.com/bot)' },
      next: { revalidate: 3600 }
    });
    
    const ttfb = Date.now() - startTime;
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const cmsData = detectCMS(html, $);
    const techStats = analyzeTech(html, $, url, ttfb);
    
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
    
    const compactStyles = getCompactStyleGuide();
    const ts = targetData.techStats;
    
    // Dynamischer Footer Hinweis
    const dynamicWarning = ts.eeat.dynamicContentWarning 
      ? `\n⚠️ HINWEIS: ${ts.eeat.dynamicContentWarning}` 
      : '';

    const formatData = () => `
═══════════════════════════════════════════════════════════════
URL: ${normalizedUrl}
TITEL: ${targetData.title}
META-DESCRIPTION: ${targetData.description || 'FEHLT'}
${dynamicWarning}

═══════════════════════════════════════════════════════════════
E-E-A-T ANALYSE (Experience, Expertise, Authority, Trust)
═══════════════════════════════════════════════════════════════

GESAMT E-E-A-T: ${ts.eeat.overallScore}/100 (${ts.eeat.overallRating})

EXPERIENCE (Erfahrung) - Score: ${ts.eeat.experience.experienceScore}/100
- First-Person Narrative: ${ts.eeat.experience.hasFirstPersonNarrative ? '✅' : '❌'}
- Persönliche Geschichten: ${ts.eeat.experience.hasPersonalStories ? '✅' : '❌'}
- Fallstudien/Case Studies: ${ts.eeat.experience.hasCaseStudies ? '✅' : '❌'}
- Testimonials/Kundenstimmen: ${ts.eeat.experience.hasTestimonials ? '✅' : '❌'}
- Portfolio/Referenzen: ${ts.eeat.experience.hasPortfolio ? '✅' : '❌'}

EXPERTISE (Fachwissen) - Score: ${ts.eeat.expertise.expertiseScore}/100
- Autor-Bio vorhanden: ${ts.eeat.expertise.hasAuthorBio ? '✅' : '❌'}
- Credentials/Qualifikationen: ${ts.eeat.expertise.hasCredentials ? '✅' : '❌'}
- Tiefgehende Erklärungen: ${ts.eeat.expertise.hasDetailedExplanations ? '✅' : '❌'}
- Fachbegriffe korrekt: ${ts.eeat.expertise.hasTechnicalTerms ? '✅' : '❌'}
- Methodik erklärt: ${ts.eeat.expertise.hasMethodology ? '✅' : '❌'}
- Datenbasierter Content: ${ts.eeat.expertise.hasDataDrivenContent ? '✅' : '❌'}

AUTHORITY (Autorität) - Score: ${ts.eeat.authoritativeness.authorityScore}/100
- Organization Schema: ${ts.eeat.authoritativeness.hasOrganizationSchema ? '✅' : '❌'}
- Person Schema: ${ts.eeat.authoritativeness.hasPersonSchema ? '✅' : '❌'}
- sameAs Links: ${ts.eeat.authoritativeness.hasSameAsLinks ? '✅ ' + ts.eeat.authoritativeness.sameAsLinks.slice(0, 2).join(', ') : '❌ FEHLT'}
- Externe Zitierungen: ${ts.eeat.authoritativeness.hasExternalCitations ? '✅' : '❌'}
- Awards/Auszeichnungen: ${ts.eeat.authoritativeness.hasAwards ? '✅' : '❌'}
- Medienerwähnungen: ${ts.eeat.authoritativeness.hasMentions ? '✅' : '❌'}
- Partnerschaften: ${ts.eeat.authoritativeness.hasPartnerships ? '✅' : '❌'}

TRUST (Vertrauen) - Score: ${ts.eeat.trustworthiness.trustScore}/100
- Impressum: ${ts.eeat.trustworthiness.hasImprint ? '✅' : '❌'}
- Datenschutz: ${ts.eeat.trustworthiness.hasPrivacyPolicy ? '✅' : '❌'}
- Kontakt: ${ts.eeat.trustworthiness.hasContact ? '✅' : '❌'}
- Über-uns Seite: ${ts.eeat.trustworthiness.hasAboutPage ? '✅' : '❌'}
- Team-Seite: ${ts.eeat.trustworthiness.hasTeamPage ? '✅' : '❌'}
- Physische Adresse: ${ts.eeat.trustworthiness.hasPhysicalAddress ? '✅' : '❌'}
- Telefonnummer: ${ts.eeat.trustworthiness.hasPhoneNumber ? '✅' : '❌'}

═══════════════════════════════════════════════════════════════
CONTENT-QUALITÄT & STORYTELLING
═══════════════════════════════════════════════════════════════

GESAMT CONTENT: ${ts.contentQuality.overallContentScore}/100 (${ts.contentQuality.contentRating})

BASIS-METRIKEN:
- Wortanzahl: ${ts.contentQuality.wordCount}
- Lesezeit: ~${ts.contentQuality.readingTimeMin} Min.
- Absätze: ${ts.contentQuality.paragraphCount}
- Thin Content: ${ts.contentQuality.thinContent ? '⚠️ JA (<300 Wörter)' : '✅ NEIN'}

STORYTELLING - Score: ${ts.contentQuality.storytelling.storytellingScore}/100
- Narrative Struktur: ${ts.contentQuality.storytelling.hasNarrativeStructure ? '✅' : '❌'}
- Hook/Aufmerksamkeitsfänger: ${ts.contentQuality.storytelling.hasHook ? '✅' : '❌'}
- Emotionale Sprache: ${ts.contentQuality.storytelling.hasEmotionalLanguage ? '✅' : '❌'}
- Anekdoten: ${ts.contentQuality.storytelling.hasAnecdotes ? '✅' : '❌'}
- Problem-Lösung Struktur: ${ts.contentQuality.storytelling.hasConflictResolution ? '✅' : '❌'}
- Call-to-Action: ${ts.contentQuality.storytelling.hasCallToAction ? '✅' : '❌'}

LESBARKEIT - Score: ${ts.contentQuality.readability.readabilityScore}/100
- Kurze Absätze: ${ts.contentQuality.readability.hasShortParagraphs ? '✅' : '❌'}
- Zwischenüberschriften: ${ts.contentQuality.readability.hasSubheadings ? '✅' : '❌'}
- Aufzählungen: ${ts.contentQuality.readability.hasBulletPoints ? '✅' : '❌'}
- Nummerierte Listen: ${ts.contentQuality.readability.hasNumberedLists ? '✅' : '❌'}
- Hervorgehobener Text: ${ts.contentQuality.readability.hasHighlightedText ? '✅' : '❌'}
- Visuelle Breaks: ${ts.contentQuality.readability.hasVisualBreaks ? '✅' : '❌'}

UNIQUE VALUE - Score: ${ts.contentQuality.uniqueValue.uniqueValueScore}/100
- Eigene Forschung/Daten: ${ts.contentQuality.uniqueValue.hasOriginalResearch ? '✅' : '❌'}
- Einzigartige Insights: ${ts.contentQuality.uniqueValue.hasUniqueInsights ? '✅' : '❌'}
- Umsetzbare Tipps: ${ts.contentQuality.uniqueValue.hasActionableAdvice ? '✅' : '❌'}
- Konkrete Beispiele: ${ts.contentQuality.uniqueValue.hasExamples ? '✅' : '❌'}
- Vergleiche: ${ts.contentQuality.uniqueValue.hasComparisons ? '✅' : '❌'}
- Tools/Downloads: ${ts.contentQuality.uniqueValue.hasTools ? '✅' : '❌'}

═══════════════════════════════════════════════════════════════
GEO-ANALYSE (Generative Engine Optimization)
═══════════════════════════════════════════════════════════════

GESAMT GEO-SCORE: ${ts.geoSignals.geoScore}/100 (${ts.geoSignals.geoRating})

ENTITÄTS-KLARHEIT:
- Schema-Typen: ${ts.geoSignals.entityClarity.schemaTypes.join(', ') || 'KEINE'}
- sameAs Links: ${ts.geoSignals.entityClarity.sameAsLinks.length > 0 ? '✅ ' + ts.geoSignals.entityClarity.sameAsLinks.join(', ') : '❌ KEINE'}
- knowsAbout: ${ts.geoSignals.entityClarity.hasKnowsAbout ? '✅' : '❌'}
- jobTitle: ${ts.geoSignals.entityClarity.hasJobTitle ? '✅' : '❌'}

ZITIERBARKEIT (Score: ${ts.geoSignals.citability.citabilityScore}/100):
- Definitionen: ${ts.geoSignals.citability.hasDefinitions ? '✅' : '❌'}
- FAQ-Struktur: ${ts.geoSignals.citability.hasFaqStructure ? '✅' : '❌'}
- Listen (Bullet/Numbered): ${ts.geoSignals.citability.hasBulletLists || ts.geoSignals.citability.hasNumberedLists ? '✅' : '❌'}
- Datentabellen: ${ts.geoSignals.citability.hasDataTables ? '✅' : '❌'}
- Statistiken: ${ts.geoSignals.citability.hasStatistics ? '✅' : '❌'}
- Quellenangaben: ${ts.geoSignals.citability.hasCitations ? '✅' : '❌'}

LLM-READABILITY:
- Zusammenfassung: ${ts.geoSignals.llmReadability.hasSummary ? '✅' : '❌'}
- Key Takeaways: ${ts.geoSignals.llmReadability.hasKeyTakeaways ? '✅' : '❌'}
- Fragen im Content: ${ts.geoSignals.llmReadability.questionCount}
- Direkte Antworten: ${ts.geoSignals.llmReadability.hasDirectAnswers ? '✅' : '❌'}

═══════════════════════════════════════════════════════════════
TECHNISCHES SEO
═══════════════════════════════════════════════════════════════

PERFORMANCE:
- TTFB: ${ts.performance.ttfbMs}ms (${ts.performance.rating})
- HTML-Größe: ${ts.performance.htmlSizeKb} KB
- Render-Blocking: ${ts.performance.renderBlockingScripts} Scripts
- Async/Defer: ${ts.performance.asyncScripts}/${ts.performance.deferScripts}

STRUKTUR:
- H1: ${ts.structure.headings.h1}x | H2: ${ts.structure.headings.h2}x | H3: ${ts.structure.headings.h3}x
- Semantik-Score: ${ts.codeQuality.semanticScore}/100
- Canonical: ${ts.indexing.canonical ? (ts.indexing.canonicalMatchesUrl ? '✅ Self-ref' : '⚠️ Andere URL') : '❌ FEHLT'}

BILDER:
- Gesamt: ${ts.imageAnalysis.total}
- Mit Alt: ${ts.imageAnalysis.withAlt}
- WebP/AVIF: ${ts.imageAnalysis.modernFormats}
- Lazy Load: ${ts.imageAnalysis.lazyLoaded}

LINKS:
- Intern: ${ts.linkStructure.internalCount}
- Extern: ${ts.linkStructure.externalCount}

SOCIAL:
- OG vollständig: ${ts.socialMeta.og.title && ts.socialMeta.og.image ? '✅' : '❌'}
- Twitter Card: ${ts.socialMeta.twitter.card || '❌ FEHLT'}
`;

    const prompt = `
Du bist ein erfahrener SEO-, E-E-A-T- und GEO-Experte. Analysiere die Daten und erstelle einen professionellen Audit-Report.

WICHTIG:
- Bewerte alle 4 E-E-A-T Dimensionen einzeln
- Gib konkrete, umsetzbare Empfehlungen
- Priorisiere nach Impact
- Sei präzise und direkt

DATEN:
${formatData()}

STYLE: ${compactStyles}

Erstelle den Report als HTML mit dieser Struktur:

1. HEADER mit Scores (E-E-A-T, Content, GEO, Tech)
2. E-E-A-T Detailanalyse (alle 4 Dimensionen)
3. Content & Storytelling Bewertung
4. GEO-Readiness
5. Technisches SEO
6. Priorisierter Maßnahmenplan (Hoch/Mittel/Nice-to-have)

Antworte NUR mit HTML. Keine Einleitung.
`;

    const result = await streamTextSafe({ prompt });
    return result.toTextStreamResponse();
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
