// src/app/api/ai/competitor-spy/route.ts
// OPTION C: Harte Fakten per Code + Qualitätsbewertung per KI
import { streamTextSafe } from '@/lib/ai-config';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { STYLES, getCompactStyleGuide } from '@/lib/ai-styles';
import { URL } from 'url';

export const runtime = 'nodejs';
export const maxDuration = 300;

// ============================================================================
// INTERFACES - HARTE FAKTEN (vom Code extrahiert)
// ============================================================================

interface ExtractedFacts {
  // META & BASICS
  meta: {
    url: string;
    title: string;
    description: string | null;
    author: string | null;
    language: string | null;
    canonical: string | null;
    canonicalMatchesUrl: boolean;
    robotsMeta: string | null;
    isIndexable: boolean;
    hasViewport: boolean;
    hasCharset: boolean;
  };

  // PERFORMANCE
  performance: {
    ttfbMs: number;
    ttfbRating: 'Exzellent' | 'Gut' | 'Mittel' | 'Langsam';
    htmlSizeKb: number;
    preloadCount: number;
    preconnectCount: number;
    renderBlockingScripts: number;
    asyncScripts: number;
    deferScripts: number;
    moduleScripts: number;
    totalScripts: number;
    inlineStylesCount: number;
    externalStylesCount: number;
  };

  // SCHEMA.ORG - VOLLSTÄNDIG EXTRAHIERT
  schema: {
    hasSchema: boolean;
    schemaCount: number;
    types: string[];
    
    // Person Schema Details
    person: {
      exists: boolean;
      name: string | null;
      jobTitle: string | null;
      description: string | null;
      image: string | null;
      sameAs: string[];
      knowsAbout: string[];
      hasAddress: boolean;
      addressLocality: string | null;
    } | null;
    
    // Organization Schema Details
    organization: {
      exists: boolean;
      name: string | null;
      description: string | null;
      logo: string | null;
      sameAs: string[];
      hasContactPoint: boolean;
    } | null;
    
    // FAQ Schema Details
    faq: {
      exists: boolean;
      questionCount: number;
      questions: { question: string; answerPreview: string }[];
    } | null;
    
    // Article Schema
    article: {
      exists: boolean;
      headline: string | null;
      datePublished: string | null;
      dateModified: string | null;
      author: string | null;
    } | null;
    
    // Weitere Schema-Typen
    hasBreadcrumb: boolean;
    hasHowTo: boolean;
    hasProduct: boolean;
    hasLocalBusiness: boolean;
    hasWebSite: boolean;
    
    // Raw für KI-Analyse
    rawSchemaJson: string;
  };

  // HTML STRUKTUR
  structure: {
    // Headings
    headings: {
      h1Count: number;
      h1Texts: string[];
      h2Count: number;
      h2Texts: string[];
      h3Count: number;
      h3Texts: string[];
      h4Count: number;
      h5Count: number;
      h6Count: number;
      totalHeadings: number;
      hierarchyValid: boolean;
    };
    
    // Semantische Tags
    semanticTags: {
      hasHeader: boolean;
      hasNav: boolean;
      hasMain: boolean;
      hasArticle: boolean;
      hasSection: boolean;
      hasAside: boolean;
      hasFooter: boolean;
      hasFigure: boolean;
      hasDetails: boolean;
      detailsCount: number;
      foundTags: string[];
      semanticScore: number;
    };
    
    // Listen
    lists: {
      ulCount: number;
      olCount: number;
      totalListItems: number;
      listsWithMoreThan3Items: number;
    };
    
    // Tabellen
    tables: {
      count: number;
      tablesWithHeaders: number;
      totalRows: number;
    };
    
    // Formulare
    forms: {
      count: number;
      hasSearchForm: boolean;
      hasContactForm: boolean;
    };
    
    // Code-Blöcke
    codeBlocks: {
      preCount: number;
      codeCount: number;
      hasCodeExamples: boolean;
    };
  };

  // CONTENT EXTRAKTION
  content: {
    // Metriken
    wordCount: number;
    characterCount: number;
    sentenceCount: number;
    paragraphCount: number;
    avgWordsPerSentence: number;
    avgWordsPerParagraph: number;
    readingTimeMinutes: number;
    
    // Content Samples für KI
    samples: {
      introText: string;           // Erste 500 Zeichen
      mainContent: string;         // Hauptinhalt (bis 3000 Zeichen)
      faqContent: string;          // FAQ Bereich extrahiert
      aboutContent: string;        // Über-Bereich falls vorhanden
      closingText: string;         // Letzte 300 Zeichen
    };
    
    // Textuelle Elemente
    hasBlockquotes: boolean;
    blockquoteCount: number;
    blockquoteTexts: string[];
    
    hasEmphasis: boolean;
    strongCount: number;
    emCount: number;
    
    // Spezielle Textmuster (nur Vorkommen zählen, KI bewertet)
    questionMarksInText: number;
    exclamationMarksInText: number;
    
    // Details/Summary (FAQ-artig)
    detailsSummary: {
      count: number;
      items: { summary: string; contentPreview: string }[];
    };
  };

  // BILDER
  images: {
    total: number;
    withAlt: number;
    withEmptyAlt: number;
    withoutAlt: number;
    withTitle: number;
    lazyLoaded: number;
    webpCount: number;
    avifCount: number;
    svgCount: number;
    altTexts: string[];
    imageScore: number;
  };

  // LINKS
  links: {
    // Intern
    internal: {
      count: number;
      uniqueCount: number;
      samples: { text: string; href: string }[];
    };
    
    // Extern
    external: {
      count: number;
      uniqueCount: number;
      domainsLinked: string[];
      samples: { text: string; href: string; domain: string }[];
      nofollowCount: number;
      newTabCount: number;
    };
    
    // Spezielle Links
    mailtoLinks: number;
    telLinks: number;
    anchorLinks: number;
    downloadLinks: number;
    socialLinks: { platform: string; url: string }[];
    
    // Potentielle Probleme
    emptyLinks: number;
    javascriptLinks: number;
  };

  // SOCIAL & OPEN GRAPH
  social: {
    openGraph: {
      hasOg: boolean;
      title: string | null;
      description: string | null;
      image: string | null;
      type: string | null;
      url: string | null;
      siteName: string | null;
      locale: string | null;
      completeness: number; // 0-100
    };
    
    twitter: {
      hasTwitterCard: boolean;
      card: string | null;
      site: string | null;
      creator: string | null;
      title: string | null;
      description: string | null;
      image: string | null;
      completeness: number;
    };
    
    socialProfiles: {
      found: boolean;
      platforms: string[];
      links: { platform: string; url: string }[];
    };
  };

  // TRUST SIGNALE (nur Fakten, KI bewertet)
  trustSignals: {
    // Links zu rechtlichen Seiten
    hasImprintLink: boolean;
    imprintLinkText: string | null;
    hasPrivacyLink: boolean;
    privacyLinkText: string | null;
    hasContactLink: boolean;
    contactLinkText: string | null;
    hasAboutLink: boolean;
    aboutLinkText: string | null;
    hasTermsLink: boolean;
    
    // Kontaktinformationen im Content
    emailAddressesFound: string[];
    phoneNumbersFound: string[];
    physicalAddressFound: boolean;
    
    // Footer Analyse
    hasFooter: boolean;
    footerIsDynamic: boolean;
    
    // Sicherheit
    hasHttps: boolean;
  };

  // CMS & TECHNOLOGIE
  technology: {
    detectedCms: string;
    isPageBuilder: boolean;
    detectedFrameworks: string[];
    detectedLibraries: string[];
    usesJquery: boolean;
    usesReact: boolean;
    usesVue: boolean;
    usesAngular: boolean;
    hasServiceWorker: boolean;
    hasManifest: boolean;
  };

  // INTERNATIONALISIERUNG
  i18n: {
    declaredLanguage: string | null;
    hreflangTags: { lang: string; url: string }[];
    hasMultipleLanguages: boolean;
  };

  // DYNAMISCHER CONTENT WARNUNG
  dynamicContent: {
    hasDynamicFooter: boolean;
    hasDynamicHeader: boolean;
    hasDynamicNavigation: boolean;
    hasPlaceholders: boolean;
    placeholderIds: string[];
    warning: string | null;
  };
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, maxLength: number): string {
  const cleaned = cleanText(text);
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength) + '...';
}

function countWords(text: string): number {
  const cleaned = cleanText(text);
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(word => word.length > 0).length;
}

function countSentences(text: string): number {
  const cleaned = cleanText(text);
  if (!cleaned) return 0;
  return cleaned.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function identifySocialPlatform(url: string): string | null {
  const platforms: Record<string, string[]> = {
    'LinkedIn': ['linkedin.com'],
    'GitHub': ['github.com'],
    'Twitter/X': ['twitter.com', 'x.com'],
    'Facebook': ['facebook.com', 'fb.com'],
    'Instagram': ['instagram.com'],
    'YouTube': ['youtube.com', 'youtu.be'],
    'TikTok': ['tiktok.com'],
    'Xing': ['xing.com'],
    'Pinterest': ['pinterest.com'],
    'Dribbble': ['dribbble.com'],
    'Behance': ['behance.net'],
    'Medium': ['medium.com'],
    'Reddit': ['reddit.com'],
    'Discord': ['discord.gg', 'discord.com'],
    'Telegram': ['t.me', 'telegram.me'],
    'WhatsApp': ['wa.me', 'whatsapp.com'],
  };
  
  const urlLower = url.toLowerCase();
  for (const [platform, domains] of Object.entries(platforms)) {
    if (domains.some(d => urlLower.includes(d))) {
      return platform;
    }
  }
  return null;
}

// ============================================================================
// SCHEMA EXTRAKTION (VOLLSTÄNDIG)
// ============================================================================

function extractSchemaData($: cheerio.CheerioAPI): ExtractedFacts['schema'] {
  const schemas: any[] = [];
  const types: string[] = [];
  
  let personData: ExtractedFacts['schema']['person'] = null;
  let orgData: ExtractedFacts['schema']['organization'] = null;
  let faqData: ExtractedFacts['schema']['faq'] = null;
  let articleData: ExtractedFacts['schema']['article'] = null;
  
  let hasBreadcrumb = false;
  let hasHowTo = false;
  let hasProduct = false;
  let hasLocalBusiness = false;
  let hasWebSite = false;
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;
      
      const parsed = JSON.parse(content);
      schemas.push(parsed);
      
      // Rekursive Extraktion
      const processObject = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        const objType = obj['@type'];
        if (objType) {
          const typeList = Array.isArray(objType) ? objType : [objType];
          types.push(...typeList);
          
          typeList.forEach(t => {
            const typeLower = t.toLowerCase();
            
            // Person
            if (typeLower === 'person') {
              const knowsAboutItems: string[] = [];
              if (obj.knowsAbout) {
                const ka = Array.isArray(obj.knowsAbout) ? obj.knowsAbout : [obj.knowsAbout];
                ka.forEach((item: any) => {
                  if (typeof item === 'string') knowsAboutItems.push(item);
                  else if (item.name) knowsAboutItems.push(item.name);
                });
              }
              
              personData = {
                exists: true,
                name: obj.name || null,
                jobTitle: obj.jobTitle || null,
                description: obj.description || null,
                image: typeof obj.image === 'string' ? obj.image : obj.image?.url || null,
                sameAs: Array.isArray(obj.sameAs) ? obj.sameAs : (obj.sameAs ? [obj.sameAs] : []),
                knowsAbout: knowsAboutItems,
                hasAddress: !!obj.address,
                addressLocality: obj.address?.addressLocality || obj.homeLocation?.name || null,
              };
            }
            
            // Organization
            if (typeLower.includes('organization') || typeLower === 'localbusiness') {
              orgData = {
                exists: true,
                name: obj.name || null,
                description: obj.description || null,
                logo: typeof obj.logo === 'string' ? obj.logo : obj.logo?.url || null,
                sameAs: Array.isArray(obj.sameAs) ? obj.sameAs : (obj.sameAs ? [obj.sameAs] : []),
                hasContactPoint: !!obj.contactPoint,
              };
            }
            
            // FAQ
            if (typeLower === 'faqpage') {
              const questions: { question: string; answerPreview: string }[] = [];
              const mainEntity = obj.mainEntity || [];
              const qaList = Array.isArray(mainEntity) ? mainEntity : [mainEntity];
              
              qaList.forEach((qa: any) => {
                if (qa['@type'] === 'Question' && qa.name && qa.acceptedAnswer) {
                  questions.push({
                    question: qa.name,
                    answerPreview: truncate(qa.acceptedAnswer.text || '', 200),
                  });
                }
              });
              
              faqData = {
                exists: true,
                questionCount: questions.length,
                questions,
              };
            }
            
            // Article
            if (typeLower.includes('article')) {
              articleData = {
                exists: true,
                headline: obj.headline || null,
                datePublished: obj.datePublished || null,
                dateModified: obj.dateModified || null,
                author: typeof obj.author === 'string' ? obj.author : obj.author?.name || null,
              };
            }
            
            // Andere Typen
            if (typeLower.includes('breadcrumb')) hasBreadcrumb = true;
            if (typeLower === 'howto') hasHowTo = true;
            if (typeLower === 'product') hasProduct = true;
            if (typeLower.includes('localbusiness')) hasLocalBusiness = true;
            if (typeLower === 'website') hasWebSite = true;
          });
        }
        
        // @graph durchsuchen
        if (obj['@graph'] && Array.isArray(obj['@graph'])) {
          obj['@graph'].forEach(processObject);
        }
      };
      
      processObject(parsed);
    } catch (e) {
      // JSON Parse Error ignorieren
    }
  });
  
  return {
    hasSchema: schemas.length > 0,
    schemaCount: schemas.length,
    types: [...new Set(types)],
    person: personData,
    organization: orgData,
    faq: faqData,
    article: articleData,
    hasBreadcrumb,
    hasHowTo,
    hasProduct,
    hasLocalBusiness,
    hasWebSite,
    rawSchemaJson: JSON.stringify(schemas, null, 2).substring(0, 5000),
  };
}

// ============================================================================
// CONTENT EXTRAKTION
// ============================================================================

function extractContent($: cheerio.CheerioAPI): ExtractedFacts['content'] {
  // Clone für Text-Extraktion
  const $clone = cheerio.load($.html());
  $clone('script, style, noscript, iframe, svg').remove();
  
  const bodyText = $clone('body').text();
  const mainText = $clone('main').text() || $clone('article').text() || bodyText;
  const cleanedMain = cleanText(mainText);
  
  const wordCount = countWords(cleanedMain);
  const sentenceCount = countSentences(cleanedMain);
  const paragraphs = $('p').filter((_, el) => $(el).text().trim().length > 30);
  const paragraphCount = paragraphs.length;
  
  // Content Samples
  const introText = truncate(cleanedMain, 500);
  const mainContent = truncate(cleanedMain, 3000);
  
  // FAQ Content extrahieren
  let faqContent = '';
  $('details, [class*="faq"], [id*="faq"], .accordion').each((_, el) => {
    faqContent += ' ' + $(el).text();
  });
  faqContent = truncate(faqContent, 1500);
  
  // About Content
  let aboutContent = '';
  $('[class*="about"], [id*="about"], [class*="über"], [id*="ueber"]').each((_, el) => {
    aboutContent += ' ' + $(el).text();
  });
  aboutContent = truncate(aboutContent, 1000);
  
  // Closing Text
  const closingText = cleanedMain.length > 300 
    ? truncate(cleanedMain.slice(-500), 300) 
    : '';
  
  // Blockquotes
  const blockquoteTexts: string[] = [];
  $('blockquote').each((_, el) => {
    const text = truncate($(el).text(), 200);
    if (text) blockquoteTexts.push(text);
  });
  
  // Details/Summary
  const detailsItems: { summary: string; contentPreview: string }[] = [];
  $('details').each((_, el) => {
    const summary = $(el).find('summary').first().text().trim();
    const content = $(el).clone().find('summary').remove().end().text().trim();
    if (summary) {
      detailsItems.push({
        summary,
        contentPreview: truncate(content, 200),
      });
    }
  });
  
  return {
    wordCount,
    characterCount: cleanedMain.length,
    sentenceCount,
    paragraphCount,
    avgWordsPerSentence: sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0,
    avgWordsPerParagraph: paragraphCount > 0 ? Math.round(wordCount / paragraphCount) : 0,
    readingTimeMinutes: Math.ceil(wordCount / 200),
    samples: {
      introText,
      mainContent,
      faqContent,
      aboutContent,
      closingText,
    },
    hasBlockquotes: blockquoteTexts.length > 0,
    blockquoteCount: blockquoteTexts.length,
    blockquoteTexts: blockquoteTexts.slice(0, 5),
    hasEmphasis: $('strong, b, em, i, mark').length > 0,
    strongCount: $('strong, b').length,
    emCount: $('em, i').length,
    questionMarksInText: (bodyText.match(/\?/g) || []).length,
    exclamationMarksInText: (bodyText.match(/!/g) || []).length,
    detailsSummary: {
      count: detailsItems.length,
      items: detailsItems.slice(0, 10),
    },
  };
}

// ============================================================================
// STRUKTUR EXTRAKTION
// ============================================================================

function extractStructure($: cheerio.CheerioAPI): ExtractedFacts['structure'] {
  // Headings
  const h1Texts = $('h1').map((_, el) => truncate($(el).text(), 100)).get();
  const h2Texts = $('h2').map((_, el) => truncate($(el).text(), 100)).get();
  const h3Texts = $('h3').map((_, el) => truncate($(el).text(), 80)).get();
  
  const h1Count = h1Texts.length;
  const h2Count = h2Texts.length;
  const h3Count = h3Texts.length;
  const h4Count = $('h4').length;
  const h5Count = $('h5').length;
  const h6Count = $('h6').length;
  
  let hierarchyValid = h1Count === 1;
  if (h3Count > 0 && h2Count === 0) hierarchyValid = false;
  if (h4Count > 0 && h3Count === 0) hierarchyValid = false;
  
  // Semantische Tags
  const semanticTagsList = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer', 'figure', 'details'];
  const foundTags = semanticTagsList.filter(tag => $(tag).length > 0);
  const semanticScore = Math.round((foundTags.length / semanticTagsList.length) * 100);
  
  // Listen
  const ulCount = $('ul').length;
  const olCount = $('ol').length;
  const totalListItems = $('li').length;
  const listsWithMoreThan3Items = $('ul, ol').filter((_, el) => $(el).find('> li').length >= 3).length;
  
  // Tabellen
  const tableCount = $('table').length;
  const tablesWithHeaders = $('table').filter((_, el) => $(el).find('th').length > 0).length;
  const totalRows = $('tr').length;
  
  // Forms
  const formCount = $('form').length;
  const hasSearchForm = $('form[role="search"], input[type="search"], [class*="search"]').length > 0;
  const hasContactForm = $('form[class*="contact"], form[id*="contact"], form[action*="contact"]').length > 0;
  
  // Code
  const preCount = $('pre').length;
  const codeCount = $('code').length;
  
  return {
    headings: {
      h1Count,
      h1Texts: h1Texts.slice(0, 3),
      h2Count,
      h2Texts: h2Texts.slice(0, 10),
      h3Count,
      h3Texts: h3Texts.slice(0, 10),
      h4Count,
      h5Count,
      h6Count,
      totalHeadings: h1Count + h2Count + h3Count + h4Count + h5Count + h6Count,
      hierarchyValid,
    },
    semanticTags: {
      hasHeader: $('header').length > 0,
      hasNav: $('nav').length > 0,
      hasMain: $('main').length > 0,
      hasArticle: $('article').length > 0,
      hasSection: $('section').length > 0,
      hasAside: $('aside').length > 0,
      hasFooter: $('footer').length > 0,
      hasFigure: $('figure').length > 0,
      hasDetails: $('details').length > 0,
      detailsCount: $('details').length,
      foundTags,
      semanticScore,
    },
    lists: {
      ulCount,
      olCount,
      totalListItems,
      listsWithMoreThan3Items,
    },
    tables: {
      count: tableCount,
      tablesWithHeaders,
      totalRows,
    },
    forms: {
      count: formCount,
      hasSearchForm,
      hasContactForm,
    },
    codeBlocks: {
      preCount,
      codeCount,
      hasCodeExamples: preCount > 0 || codeCount > 0,
    },
  };
}

// ============================================================================
// LINKS EXTRAKTION
// ============================================================================

function extractLinks($: cheerio.CheerioAPI, baseUrl: string): ExtractedFacts['links'] {
  let currentHost = '';
  try {
    currentHost = new URL(baseUrl).hostname.replace(/^www\./, '');
  } catch {}
  
  const internalLinks: { text: string; href: string }[] = [];
  const externalLinks: { text: string; href: string; domain: string }[] = [];
  const domainsSet = new Set<string>();
  const socialLinks: { platform: string; url: string }[] = [];
  
  let nofollowCount = 0;
  let newTabCount = 0;
  let mailtoLinks = 0;
  let telLinks = 0;
  let anchorLinks = 0;
  let downloadLinks = 0;
  let emptyLinks = 0;
  let javascriptLinks = 0;
  
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = truncate($(el).text(), 60);
    const rel = $(el).attr('rel') || '';
    const target = $(el).attr('target') || '';
    const download = $(el).attr('download');
    
    // Spezielle Links
    if (href.startsWith('mailto:')) {
      mailtoLinks++;
      return;
    }
    if (href.startsWith('tel:')) {
      telLinks++;
      return;
    }
    if (href.startsWith('#')) {
      anchorLinks++;
      return;
    }
    if (href.startsWith('javascript:')) {
      javascriptLinks++;
      return;
    }
    if (!href || !text) {
      emptyLinks++;
      return;
    }
    if (download !== undefined) {
      downloadLinks++;
    }
    
    // Rel und Target
    if (rel.includes('nofollow')) nofollowCount++;
    if (target === '_blank') newTabCount++;
    
    try {
      const absoluteUrl = new URL(href, baseUrl);
      const linkHost = absoluteUrl.hostname.replace(/^www\./, '');
      
      // Social Check
      const platform = identifySocialPlatform(absoluteUrl.href);
      if (platform && !socialLinks.some(s => s.platform === platform)) {
        socialLinks.push({ platform, url: absoluteUrl.href });
      }
      
      if (linkHost === currentHost) {
        // Internal
        if (!internalLinks.some(l => l.href === absoluteUrl.pathname)) {
          internalLinks.push({ text, href: absoluteUrl.pathname });
        }
      } else {
        // External
        domainsSet.add(linkHost);
        if (externalLinks.length < 20) {
          externalLinks.push({ text, href: absoluteUrl.href, domain: linkHost });
        }
      }
    } catch {}
  });
  
  return {
    internal: {
      count: internalLinks.length,
      uniqueCount: internalLinks.length,
      samples: internalLinks.slice(0, 15),
    },
    external: {
      count: externalLinks.length,
      uniqueCount: domainsSet.size,
      domainsLinked: [...domainsSet].slice(0, 20),
      samples: externalLinks.slice(0, 10),
      nofollowCount,
      newTabCount,
    },
    mailtoLinks,
    telLinks,
    anchorLinks,
    downloadLinks,
    socialLinks: socialLinks.slice(0, 10),
    emptyLinks,
    javascriptLinks,
  };
}

// ============================================================================
// IMAGES EXTRAKTION
// ============================================================================

function extractImages($: cheerio.CheerioAPI): ExtractedFacts['images'] {
  const images = $('img');
  let withAlt = 0;
  let withEmptyAlt = 0;
  let withoutAlt = 0;
  let withTitle = 0;
  let lazyLoaded = 0;
  let webpCount = 0;
  let avifCount = 0;
  let svgCount = 0;
  const altTexts: string[] = [];
  
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    const title = $(el).attr('title');
    const loading = $(el).attr('loading');
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    
    if (alt === undefined) {
      withoutAlt++;
    } else if (alt.trim() === '') {
      withEmptyAlt++;
    } else {
      withAlt++;
      if (alt.length < 100) altTexts.push(alt);
    }
    
    if (title) withTitle++;
    if (loading === 'lazy' || $(el).attr('data-src')) lazyLoaded++;
    
    const srcLower = src.toLowerCase();
    if (srcLower.includes('.webp')) webpCount++;
    if (srcLower.includes('.avif')) avifCount++;
    if (srcLower.includes('.svg') || srcLower.startsWith('data:image/svg')) svgCount++;
  });
  
  const total = images.length;
  const imageScore = total === 0 ? 100 : Math.round((withAlt / total) * 100);
  
  return {
    total,
    withAlt,
    withEmptyAlt,
    withoutAlt,
    withTitle,
    lazyLoaded,
    webpCount,
    avifCount,
    svgCount,
    altTexts: altTexts.slice(0, 10),
    imageScore,
  };
}

// ============================================================================
// SOCIAL META EXTRAKTION
// ============================================================================

function extractSocialMeta($: cheerio.CheerioAPI): ExtractedFacts['social'] {
  // Open Graph
  const ogTitle = $('meta[property="og:title"]').attr('content') || null;
  const ogDesc = $('meta[property="og:description"]').attr('content') || null;
  const ogImage = $('meta[property="og:image"]').attr('content') || null;
  const ogType = $('meta[property="og:type"]').attr('content') || null;
  const ogUrl = $('meta[property="og:url"]').attr('content') || null;
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || null;
  const ogLocale = $('meta[property="og:locale"]').attr('content') || null;
  
  let ogCompleteness = 0;
  if (ogTitle) ogCompleteness += 25;
  if (ogDesc) ogCompleteness += 25;
  if (ogImage) ogCompleteness += 30;
  if (ogType) ogCompleteness += 10;
  if (ogUrl) ogCompleteness += 10;
  
  // Twitter
  const twCard = $('meta[name="twitter:card"]').attr('content') || null;
  const twSite = $('meta[name="twitter:site"]').attr('content') || null;
  const twCreator = $('meta[name="twitter:creator"]').attr('content') || null;
  const twTitle = $('meta[name="twitter:title"]').attr('content') || null;
  const twDesc = $('meta[name="twitter:description"]').attr('content') || null;
  const twImage = $('meta[name="twitter:image"]').attr('content') || null;
  
  let twCompleteness = 0;
  if (twCard) twCompleteness += 30;
  if (twTitle) twCompleteness += 25;
  if (twDesc) twCompleteness += 20;
  if (twImage) twCompleteness += 25;
  
  // Social Profile Links
  const socialDomains = ['linkedin.com', 'github.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'xing.com'];
  const socialProfileLinks: { platform: string; url: string }[] = [];
  
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const platform = identifySocialPlatform(href);
    if (platform && !socialProfileLinks.some(s => s.platform === platform)) {
      socialProfileLinks.push({ platform, url: href });
    }
  });
  
  return {
    openGraph: {
      hasOg: !!(ogTitle || ogImage),
      title: ogTitle,
      description: ogDesc,
      image: ogImage,
      type: ogType,
      url: ogUrl,
      siteName: ogSiteName,
      locale: ogLocale,
      completeness: ogCompleteness,
    },
    twitter: {
      hasTwitterCard: !!twCard,
      card: twCard,
      site: twSite,
      creator: twCreator,
      title: twTitle,
      description: twDesc,
      image: twImage,
      completeness: twCompleteness,
    },
    socialProfiles: {
      found: socialProfileLinks.length > 0,
      platforms: socialProfileLinks.map(s => s.platform),
      links: socialProfileLinks,
    },
  };
}

// ============================================================================
// TRUST SIGNALE EXTRAKTION
// ============================================================================

function extractTrustSignals($: cheerio.CheerioAPI, baseUrl: string): ExtractedFacts['trustSignals'] {
  const allLinkTexts = $('a').map((_, el) => $(el).text().toLowerCase()).get();
  const allLinkHrefs = $('a').map((_, el) => $(el).attr('href')?.toLowerCase() || '').get();
  const bodyText = $('body').text();
  
  // Rechtliche Links suchen
  const findLinkText = (patterns: RegExp[]): string | null => {
    for (const pattern of patterns) {
      const found = allLinkTexts.find(t => pattern.test(t));
      if (found) return found;
    }
    return null;
  };
  
  const hasImprintLink = allLinkTexts.some(t => /impressum|imprint|legal notice/.test(t)) ||
                         allLinkHrefs.some(h => /impressum|imprint|legal/.test(h));
  const imprintLinkText = findLinkText([/impressum|imprint|legal notice/]);
  
  const hasPrivacyLink = allLinkTexts.some(t => /datenschutz|privacy|dsgvo|gdpr/.test(t)) ||
                         allLinkHrefs.some(h => /datenschutz|privacy|dsgvo/.test(h));
  const privacyLinkText = findLinkText([/datenschutz|privacy|dsgvo|gdpr/]);
  
  const hasContactLink = allLinkTexts.some(t => /kontakt|contact/.test(t)) ||
                         allLinkHrefs.some(h => /kontakt|contact/.test(h)) ||
                         $('a[href^="mailto:"]').length > 0;
  const contactLinkText = findLinkText([/kontakt|contact/]);
  
  const hasAboutLink = allLinkTexts.some(t => /über uns|about|über mich|wir sind/.test(t)) ||
                       allLinkHrefs.some(h => /about|ueber/.test(h));
  const aboutLinkText = findLinkText([/über uns|about|über mich/]);
  
  const hasTermsLink = allLinkTexts.some(t => /agb|terms|nutzungsbedingungen|conditions/.test(t));
  
  // Email & Telefon im Content
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
  
  const emailsFound = [...new Set(bodyText.match(emailRegex) || [])];
  const phonesFound = [...new Set(bodyText.match(phoneRegex) || [])].filter(p => p.replace(/\D/g, '').length >= 8);
  
  // Physische Adresse
  const hasAddress = /\b\d{4,5}\s+\w+|\bstraße|gasse|weg|platz|allee|avenue|street|road\b/i.test(bodyText);
  
  // Footer Check
  const hasFooter = $('footer').length > 0;
  const footerIsDynamic = $('#footer-placeholder, [id*="footer-placeholder"], footer:empty').length > 0;
  
  return {
    hasImprintLink,
    imprintLinkText,
    hasPrivacyLink,
    privacyLinkText,
    hasContactLink,
    contactLinkText,
    hasAboutLink,
    aboutLinkText,
    hasTermsLink,
    emailAddressesFound: emailsFound.slice(0, 5),
    phoneNumbersFound: phonesFound.slice(0, 3),
    physicalAddressFound: hasAddress,
    hasFooter,
    footerIsDynamic,
    hasHttps: baseUrl.startsWith('https'),
  };
}

// ============================================================================
// TECHNOLOGIE DETECTION
// ============================================================================

function detectTechnology(html: string, $: cheerio.CheerioAPI): ExtractedFacts['technology'] {
  const htmlLower = html.toLowerCase();
  
  // CMS Detection
  let detectedCms = 'Nicht erkannt';
  const builders = ['wix', 'squarespace', 'jimdo', 'shopify', 'weebly', 'webflow', 'elementor', 'divi'];
  
  if (htmlLower.includes('wp-content') || htmlLower.includes('wordpress')) detectedCms = 'WordPress';
  else if (htmlLower.includes('wix.com') || htmlLower.includes('wix-')) detectedCms = 'Wix';
  else if (htmlLower.includes('squarespace')) detectedCms = 'Squarespace';
  else if (htmlLower.includes('jimdo')) detectedCms = 'Jimdo';
  else if (htmlLower.includes('shopify')) detectedCms = 'Shopify';
  else if (htmlLower.includes('typo3')) detectedCms = 'TYPO3';
  else if (htmlLower.includes('joomla')) detectedCms = 'Joomla';
  else if (htmlLower.includes('webflow')) detectedCms = 'Webflow';
  else if (htmlLower.includes('drupal')) detectedCms = 'Drupal';
  else if (htmlLower.includes('ghost')) detectedCms = 'Ghost';
  else if (htmlLower.includes('contentful')) detectedCms = 'Contentful';
  else if (htmlLower.includes('strapi')) detectedCms = 'Strapi';
  
  const isPageBuilder = builders.some(b => htmlLower.includes(b)) ||
                        htmlLower.includes('elementor') ||
                        htmlLower.includes('divi') ||
                        htmlLower.includes('beaver-builder');
  
  // Frameworks
  const frameworks: string[] = [];
  const libraries: string[] = [];
  
  if (htmlLower.includes('__next') || htmlLower.includes('next.js') || htmlLower.includes('_next')) frameworks.push('Next.js');
  if (htmlLower.includes('nuxt') || htmlLower.includes('__nuxt')) frameworks.push('Nuxt.js');
  if (htmlLower.includes('gatsby')) frameworks.push('Gatsby');
  if (htmlLower.includes('angular')) frameworks.push('Angular');
  if (htmlLower.includes('svelte')) frameworks.push('Svelte');
  if (htmlLower.includes('remix')) frameworks.push('Remix');
  if (htmlLower.includes('astro')) frameworks.push('Astro');
  
  // Libraries
  const usesJquery = htmlLower.includes('jquery');
  const usesReact = htmlLower.includes('react') || htmlLower.includes('__react');
  const usesVue = htmlLower.includes('vue') || $('[v-if], [v-for], [v-model]').length > 0;
  const usesAngular = htmlLower.includes('ng-') || $('[ng-app], [ng-controller]').length > 0;
  
  if (usesJquery) libraries.push('jQuery');
  if (htmlLower.includes('bootstrap')) libraries.push('Bootstrap');
  if (htmlLower.includes('tailwind')) libraries.push('Tailwind CSS');
  if (htmlLower.includes('fontawesome') || htmlLower.includes('font-awesome')) libraries.push('Font Awesome');
  if (htmlLower.includes('gsap')) libraries.push('GSAP');
  if (htmlLower.includes('particles')) libraries.push('Particles.js');
  
  // PWA
  const hasServiceWorker = htmlLower.includes('serviceworker') || htmlLower.includes('service-worker');
  const hasManifest = $('link[rel="manifest"]').length > 0;
  
  return {
    detectedCms,
    isPageBuilder,
    detectedFrameworks: frameworks,
    detectedLibraries: libraries,
    usesJquery,
    usesReact,
    usesVue,
    usesAngular,
    hasServiceWorker,
    hasManifest,
  };
}

// ============================================================================
// DYNAMIC CONTENT CHECK
// ============================================================================

function checkDynamicContent($: cheerio.CheerioAPI): ExtractedFacts['dynamicContent'] {
  const placeholderIds: string[] = [];
  
  $('[id*="placeholder"], [id*="-placeholder"]').each((_, el) => {
    const id = $(el).attr('id');
    if (id) placeholderIds.push(id);
  });
  
  const hasDynamicFooter = $('#footer-placeholder, [id*="footer-placeholder"], footer:empty').length > 0;
  const hasDynamicHeader = $('#header-placeholder, [id*="header-placeholder"], header:empty').length > 0;
  const hasDynamicNavigation = $('#nav-placeholder, [id*="nav-placeholder"], #menu-placeholder').length > 0;
  const hasPlaceholders = placeholderIds.length > 0;
  
  let warning: string | null = null;
  if (hasDynamicFooter || hasDynamicHeader || hasPlaceholders) {
    const parts: string[] = [];
    if (hasDynamicFooter) parts.push('Footer');
    if (hasDynamicHeader) parts.push('Header');
    if (hasDynamicNavigation) parts.push('Navigation');
    warning = `Teile der Seite werden dynamisch per JavaScript geladen (${parts.join(', ')}). Einige Elemente wie Impressum, Datenschutz oder Navigation könnten im statischen HTML nicht sichtbar sein.`;
  }
  
  return {
    hasDynamicFooter,
    hasDynamicHeader,
    hasDynamicNavigation,
    hasPlaceholders,
    placeholderIds,
    warning,
  };
}

// ============================================================================
// PERFORMANCE EXTRAKTION
// ============================================================================

function extractPerformance($: cheerio.CheerioAPI, html: string, ttfbMs: number): ExtractedFacts['performance'] {
  const htmlSizeKb = Math.round((Buffer.byteLength(html, 'utf8') / 1024) * 100) / 100;
  
  let ttfbRating: ExtractedFacts['performance']['ttfbRating'] = 'Mittel';
  if (ttfbMs < 200) ttfbRating = 'Exzellent';
  else if (ttfbMs < 400) ttfbRating = 'Gut';
  else if (ttfbMs > 800) ttfbRating = 'Langsam';
  
  const preloadCount = $('link[rel="preload"]').length;
  const preconnectCount = $('link[rel="preconnect"]').length;
  
  const scripts = $('script[src]');
  let renderBlockingScripts = 0;
  let asyncScripts = 0;
  let deferScripts = 0;
  let moduleScripts = 0;
  
  scripts.each((_, el) => {
    const hasAsync = $(el).attr('async') !== undefined;
    const hasDefer = $(el).attr('defer') !== undefined;
    const isModule = $(el).attr('type') === 'module';
    
    if (isModule) moduleScripts++;
    else if (hasAsync) asyncScripts++;
    else if (hasDefer) deferScripts++;
    else renderBlockingScripts++;
  });
  
  const inlineStylesCount = $('style').length;
  const externalStylesCount = $('link[rel="stylesheet"]').length;
  
  return {
    ttfbMs,
    ttfbRating,
    htmlSizeKb,
    preloadCount,
    preconnectCount,
    renderBlockingScripts,
    asyncScripts,
    deferScripts,
    moduleScripts,
    totalScripts: scripts.length,
    inlineStylesCount,
    externalStylesCount,
  };
}

// ============================================================================
// META EXTRAKTION
// ============================================================================

function extractMeta($: cheerio.CheerioAPI, url: string): ExtractedFacts['meta'] {
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  let canonicalMatchesUrl = false;
  
  if (canonical) {
    try {
      const canonicalUrl = new URL(canonical, url).href.replace(/\/$/, '');
      const normalizedUrl = new URL(url).href.replace(/\/$/, '');
      canonicalMatchesUrl = canonicalUrl === normalizedUrl;
    } catch {}
  }
  
  return {
    url,
    title: $('title').text().trim(),
    description: $('meta[name="description"]').attr('content') || null,
    author: $('meta[name="author"]').attr('content') || null,
    language: $('html').attr('lang') || null,
    canonical,
    canonicalMatchesUrl,
    robotsMeta: $('meta[name="robots"]').attr('content') || null,
    isIndexable: !($('meta[name="robots"]').attr('content') || '').includes('noindex'),
    hasViewport: $('meta[name="viewport"]').length > 0,
    hasCharset: $('meta[charset]').length > 0,
  };
}

// ============================================================================
// I18N EXTRAKTION
// ============================================================================

function extractI18n($: cheerio.CheerioAPI): ExtractedFacts['i18n'] {
  const hreflangTags: { lang: string; url: string }[] = [];
  
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang');
    const url = $(el).attr('href');
    if (lang && url) {
      hreflangTags.push({ lang, url });
    }
  });
  
  return {
    declaredLanguage: $('html').attr('lang') || null,
    hreflangTags,
    hasMultipleLanguages: hreflangTags.length > 1,
  };
}

// ============================================================================
// HAUPTEXTRAKTION - ALLE FAKTEN SAMMELN
// ============================================================================

function extractAllFacts(html: string, $: cheerio.CheerioAPI, url: string, ttfbMs: number): ExtractedFacts {
  return {
    meta: extractMeta($, url),
    performance: extractPerformance($, html, ttfbMs),
    schema: extractSchemaData($),
    structure: extractStructure($),
    content: extractContent($),
    images: extractImages($),
    links: extractLinks($, url),
    social: extractSocialMeta($),
    trustSignals: extractTrustSignals($, url),
    technology: detectTechnology(html, $),
    i18n: extractI18n($),
    dynamicContent: checkDynamicContent($),
  };
}

// ============================================================================
// SCRAPER
// ============================================================================

async function scrapeAndExtract(url: string): Promise<{ facts: ExtractedFacts; rawHtml: string } | null> {
  try {
    const startTime = Date.now();
    
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; SEOAnalyzer/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de,en;q=0.9',
      },
      next: { revalidate: 3600 }
    });
    
    const ttfb = Date.now() - startTime;
    
    if (!response.ok) {
      console.error(`HTTP ${response.status} für ${url}`);
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const facts = extractAllFacts(html, $, url, ttfb);
    
    return { facts, rawHtml: html };
  } catch (error) {
    console.error(`Scrape-Fehler für ${url}:`, error);
    return null;
  }
}

// ============================================================================
// PROMPT BUILDER - FAKTEN FÜR KI AUFBEREITEN
// ============================================================================

function buildFactsForPrompt(facts: ExtractedFacts): string {
  const f = facts;
  
  return `
════════════════════════════════════════════════════════════════════════════════
EXTRAHIERTE FAKTEN (100% verifiziert durch Code-Analyse)
════════════════════════════════════════════════════════════════════════════════

URL: ${f.meta.url}
TITEL: ${f.meta.title}
META-DESCRIPTION: ${f.meta.description || '❌ NICHT GESETZT'}
META-AUTHOR: ${f.meta.author || '❌ NICHT GESETZT'}
SPRACHE: ${f.meta.language || '❌ NICHT GESETZT'}

${f.dynamicContent.warning ? `⚠️ WARNUNG: ${f.dynamicContent.warning}\n` : ''}
────────────────────────────────────────────────────────────────────────────────
SCHEMA.ORG STRUKTURIERTE DATEN
────────────────────────────────────────────────────────────────────────────────

Schema vorhanden: ${f.schema.hasSchema ? '✅ JA' : '❌ NEIN'}
Anzahl Schema-Blöcke: ${f.schema.schemaCount}
Schema-Typen: ${f.schema.types.length > 0 ? f.schema.types.join(', ') : 'KEINE'}

${f.schema.person ? `
PERSON SCHEMA:
- Name: ${f.schema.person.name || 'nicht gesetzt'}
- Job Title: ${f.schema.person.jobTitle || 'nicht gesetzt'}
- Beschreibung: ${f.schema.person.description ? 'vorhanden' : 'nicht gesetzt'}
- Bild: ${f.schema.person.image ? 'vorhanden' : 'nicht gesetzt'}
- sameAs Links: ${f.schema.person.sameAs.length > 0 ? f.schema.person.sameAs.join(', ') : '❌ KEINE'}
- knowsAbout: ${f.schema.person.knowsAbout.length > 0 ? f.schema.person.knowsAbout.join(', ') : 'nicht gesetzt'}
- Adresse: ${f.schema.person.hasAddress ? `✅ ${f.schema.person.addressLocality}` : 'nicht gesetzt'}
` : 'PERSON SCHEMA: ❌ Nicht vorhanden'}

${f.schema.organization ? `
ORGANIZATION SCHEMA:
- Name: ${f.schema.organization.name || 'nicht gesetzt'}
- Logo: ${f.schema.organization.logo ? 'vorhanden' : 'nicht gesetzt'}
- sameAs: ${f.schema.organization.sameAs.length > 0 ? f.schema.organization.sameAs.join(', ') : 'KEINE'}
- ContactPoint: ${f.schema.organization.hasContactPoint ? 'vorhanden' : 'nicht gesetzt'}
` : 'ORGANIZATION SCHEMA: ❌ Nicht vorhanden'}

${f.schema.faq ? `
FAQ SCHEMA:
- Anzahl Fragen: ${f.schema.faq.questionCount}
- Fragen:
${f.schema.faq.questions.map((q, i) => `  ${i + 1}. "${q.question}"`).join('\n')}
` : 'FAQ SCHEMA: ❌ Nicht vorhanden'}

${f.schema.article ? `
ARTICLE SCHEMA:
- Headline: ${f.schema.article.headline || 'nicht gesetzt'}
- Veröffentlicht: ${f.schema.article.datePublished || 'nicht gesetzt'}
- Aktualisiert: ${f.schema.article.dateModified || 'nicht gesetzt'}
- Autor: ${f.schema.article.author || 'nicht gesetzt'}
` : ''}

Weitere Schema-Typen:
- WebSite: ${f.schema.hasWebSite ? '✅' : '❌'}
- Breadcrumb: ${f.schema.hasBreadcrumb ? '✅' : '❌'}
- HowTo: ${f.schema.hasHowTo ? '✅' : '❌'}
- Product: ${f.schema.hasProduct ? '✅' : '❌'}
- LocalBusiness: ${f.schema.hasLocalBusiness ? '✅' : '❌'}

────────────────────────────────────────────────────────────────────────────────
CONTENT METRIKEN
────────────────────────────────────────────────────────────────────────────────

Wortanzahl: ${f.content.wordCount}
Zeichen: ${f.content.characterCount}
Sätze: ${f.content.sentenceCount}
Absätze: ${f.content.paragraphCount}
Durchschn. Wörter/Satz: ${f.content.avgWordsPerSentence}
Durchschn. Wörter/Absatz: ${f.content.avgWordsPerParagraph}
Lesezeit: ~${f.content.readingTimeMinutes} Minuten

Blockquotes: ${f.content.blockquoteCount}
Hervorhebungen (strong/em): ${f.content.strongCount}/${f.content.emCount}
Fragezeichen im Text: ${f.content.questionMarksInText}
Ausrufezeichen im Text: ${f.content.exclamationMarksInText}

Details/Summary Elemente (FAQ-artig): ${f.content.detailsSummary.count}
${f.content.detailsSummary.items.length > 0 ? `Fragen in Details/Summary:
${f.content.detailsSummary.items.map((d, i) => `  ${i + 1}. "${d.summary}"`).join('\n')}` : ''}

────────────────────────────────────────────────────────────────────────────────
HTML STRUKTUR
────────────────────────────────────────────────────────────────────────────────

ÜBERSCHRIFTEN:
- H1: ${f.structure.headings.h1Count}x ${f.structure.headings.h1Texts.length > 0 ? `("${f.structure.headings.h1Texts.join('", "')}")` : ''}
- H2: ${f.structure.headings.h2Count}x ${f.structure.headings.h2Texts.length > 0 ? `("${f.structure.headings.h2Texts.slice(0, 5).join('", "')}")` : ''}
- H3: ${f.structure.headings.h3Count}x
- H4-H6: ${f.structure.headings.h4Count}/${f.structure.headings.h5Count}/${f.structure.headings.h6Count}
- Hierarchie valide: ${f.structure.headings.hierarchyValid ? '✅' : '❌'}

SEMANTISCHE TAGS:
- header: ${f.structure.semanticTags.hasHeader ? '✅' : '❌'}
- nav: ${f.structure.semanticTags.hasNav ? '✅' : '❌'}
- main: ${f.structure.semanticTags.hasMain ? '✅' : '❌'}
- article: ${f.structure.semanticTags.hasArticle ? '✅' : '❌'}
- section: ${f.structure.semanticTags.hasSection ? '✅' : '❌'}
- aside: ${f.structure.semanticTags.hasAside ? '✅' : '❌'}
- footer: ${f.structure.semanticTags.hasFooter ? '✅' : '❌'}
- figure: ${f.structure.semanticTags.hasFigure ? '✅' : '❌'}
- details: ${f.structure.semanticTags.hasDetails ? `✅ (${f.structure.semanticTags.detailsCount}x)` : '❌'}
- Semantik-Score: ${f.structure.semanticTags.semanticScore}/100

LISTEN:
- Ungeordnete Listen (ul): ${f.structure.lists.ulCount}
- Geordnete Listen (ol): ${f.structure.lists.olCount}
- Listen-Elemente gesamt: ${f.structure.lists.totalListItems}
- Listen mit 3+ Items: ${f.structure.lists.listsWithMoreThan3Items}

TABELLEN: ${f.structure.tables.count} (${f.structure.tables.tablesWithHeaders} mit Headers)
FORMULARE: ${f.structure.forms.count} (Suche: ${f.structure.forms.hasSearchForm ? '✅' : '❌'}, Kontakt: ${f.structure.forms.hasContactForm ? '✅' : '❌'})
CODE-BLÖCKE: ${f.structure.codeBlocks.preCount} pre, ${f.structure.codeBlocks.codeCount} code

────────────────────────────────────────────────────────────────────────────────
LINKS
────────────────────────────────────────────────────────────────────────────────

INTERNE LINKS: ${f.links.internal.count}
${f.links.internal.samples.length > 0 ? `Beispiele: ${f.links.internal.samples.slice(0, 8).map(l => `"${l.text}" → ${l.href}`).join(', ')}` : ''}

EXTERNE LINKS: ${f.links.external.count}
- Verlinkte Domains: ${f.links.external.domainsLinked.slice(0, 10).join(', ') || 'KEINE'}
- Nofollow: ${f.links.external.nofollowCount}
- target="_blank": ${f.links.external.newTabCount}

SPEZIELLE LINKS:
- E-Mail (mailto): ${f.links.mailtoLinks}
- Telefon (tel): ${f.links.telLinks}
- Anker (#): ${f.links.anchorLinks}
- Downloads: ${f.links.downloadLinks}
- Leere/kaputte Links: ${f.links.emptyLinks}
- JavaScript Links: ${f.links.javascriptLinks}

SOCIAL MEDIA LINKS: ${f.links.socialLinks.length > 0 ? f.links.socialLinks.map(s => `${s.platform}`).join(', ') : 'KEINE im Content'}

────────────────────────────────────────────────────────────────────────────────
BILDER
────────────────────────────────────────────────────────────────────────────────

Gesamt: ${f.images.total}
Mit Alt-Text: ${f.images.withAlt}
Ohne Alt-Text: ${f.images.withoutAlt}
Leerer Alt-Text: ${f.images.withEmptyAlt}
Mit Title: ${f.images.withTitle}
Lazy Loading: ${f.images.lazyLoaded}
WebP: ${f.images.webpCount}
AVIF: ${f.images.avifCount}
SVG: ${f.images.svgCount}
Bild-Score: ${f.images.imageScore}/100

${f.images.altTexts.length > 0 ? `Alt-Texte Beispiele: "${f.images.altTexts.slice(0, 5).join('", "')}"` : ''}

────────────────────────────────────────────────────────────────────────────────
SOCIAL & OPEN GRAPH
────────────────────────────────────────────────────────────────────────────────

OPEN GRAPH:
- og:title: ${f.social.openGraph.title || '❌ FEHLT'}
- og:description: ${f.social.openGraph.description ? '✅ vorhanden' : '❌ FEHLT'}
- og:image: ${f.social.openGraph.image || '❌ FEHLT'}
- og:type: ${f.social.openGraph.type || '❌ FEHLT'}
- Vollständigkeit: ${f.social.openGraph.completeness}%

TWITTER CARD:
- twitter:card: ${f.social.twitter.card || '❌ FEHLT'}
- twitter:title: ${f.social.twitter.title ? '✅' : '❌'}
- twitter:image: ${f.social.twitter.image ? '✅' : '❌'}
- Vollständigkeit: ${f.social.twitter.completeness}%

SOCIAL PROFILE LINKS: ${f.social.socialProfiles.found ? f.social.socialProfiles.platforms.join(', ') : 'KEINE gefunden'}

────────────────────────────────────────────────────────────────────────────────
TRUST SIGNALE
────────────────────────────────────────────────────────────────────────────────

RECHTLICHE SEITEN:
- Impressum Link: ${f.trustSignals.hasImprintLink ? `✅ ("${f.trustSignals.imprintLinkText}")` : '❌ NICHT GEFUNDEN'}
- Datenschutz Link: ${f.trustSignals.hasPrivacyLink ? `✅ ("${f.trustSignals.privacyLinkText}")` : '❌ NICHT GEFUNDEN'}
- Kontakt Link: ${f.trustSignals.hasContactLink ? `✅ ("${f.trustSignals.contactLinkText}")` : '❌ NICHT GEFUNDEN'}
- Über uns Link: ${f.trustSignals.hasAboutLink ? `✅ ("${f.trustSignals.aboutLinkText}")` : '❌ NICHT GEFUNDEN'}
- AGB Link: ${f.trustSignals.hasTermsLink ? '✅' : '❌'}

KONTAKT IM CONTENT:
- E-Mail Adressen: ${f.trustSignals.emailAddressesFound.length > 0 ? f.trustSignals.emailAddressesFound.join(', ') : 'KEINE'}
- Telefonnummern: ${f.trustSignals.phoneNumbersFound.length > 0 ? f.trustSignals.phoneNumbersFound.join(', ') : 'KEINE'}
- Physische Adresse: ${f.trustSignals.physicalAddressFound ? '✅ erkannt' : '❌ nicht erkannt'}

FOOTER: ${f.trustSignals.hasFooter ? (f.trustSignals.footerIsDynamic ? '⚠️ dynamisch geladen' : '✅ vorhanden') : '❌ nicht vorhanden'}
HTTPS: ${f.trustSignals.hasHttps ? '✅' : '❌'}

────────────────────────────────────────────────────────────────────────────────
PERFORMANCE
────────────────────────────────────────────────────────────────────────────────

TTFB: ${f.performance.ttfbMs}ms (${f.performance.ttfbRating})
HTML Größe: ${f.performance.htmlSizeKb} KB
Preload: ${f.performance.preloadCount}
Preconnect: ${f.performance.preconnectCount}

SCRIPTS (${f.performance.totalScripts} gesamt):
- Render-Blocking: ${f.performance.renderBlockingScripts}
- Async: ${f.performance.asyncScripts}
- Defer: ${f.performance.deferScripts}
- Module: ${f.performance.moduleScripts}

STYLES:
- Inline: ${f.performance.inlineStylesCount}
- Extern: ${f.performance.externalStylesCount}

────────────────────────────────────────────────────────────────────────────────
TECHNOLOGIE
────────────────────────────────────────────────────────────────────────────────

CMS: ${f.technology.detectedCms}
Page Builder: ${f.technology.isPageBuilder ? '⚠️ JA' : '✅ NEIN'}
Frameworks: ${f.technology.detectedFrameworks.length > 0 ? f.technology.detectedFrameworks.join(', ') : 'Keine erkannt'}
Libraries: ${f.technology.detectedLibraries.length > 0 ? f.technology.detectedLibraries.join(', ') : 'Keine erkannt'}
PWA: Service Worker: ${f.technology.hasServiceWorker ? '✅' : '❌'}, Manifest: ${f.technology.hasManifest ? '✅' : '❌'}

────────────────────────────────────────────────────────────────────────────────
CONTENT SAMPLES (für qualitative Bewertung)
────────────────────────────────────────────────────────────────────────────────

INTRO (erste 500 Zeichen):
"${f.content.samples.introText}"

${f.content.samples.faqContent ? `FAQ-BEREICH:
"${f.content.samples.faqContent}"` : ''}

${f.content.samples.aboutContent ? `ÜBER-BEREICH:
"${f.content.samples.aboutContent}"` : ''}

${f.content.blockquoteTexts.length > 0 ? `ZITATE/BLOCKQUOTES:
${f.content.blockquoteTexts.map(q => `"${q}"`).join('\n')}` : ''}
`;
}

// ============================================================================
// KI BEWERTUNGS-PROMPT
// ============================================================================

function buildEvaluationPrompt(facts: ExtractedFacts, compactStyles: string): string {
  const factsText = buildFactsForPrompt(facts);
  
  return `
Du bist ein erfahrener SEO-Auditor, E-E-A-T-Experte und GEO-Spezialist (Generative Engine Optimization).

DEINE AUFGABE:
Bewerte die Webseite basierend auf den extrahierten FAKTEN. Die Fakten wurden durch Code-Analyse ermittelt und sind 100% korrekt. Deine Aufgabe ist die QUALITATIVE BEWERTUNG.

${factsText}

════════════════════════════════════════════════════════════════════════════════
BEWERTUNGSAUFTRAG
════════════════════════════════════════════════════════════════════════════════

Erstelle einen professionellen Audit-Report mit folgenden Bewertungen:

1. E-E-A-T BEWERTUNG (jeweils 0-100 Score + Begründung)

   EXPERIENCE (Erfahrung):
   - Zeigt der Content echte, praktische Erfahrung?
   - Gibt es First-Person Narrative ("Ich habe...", "In meiner Arbeit...")?
   - Werden eigene Projekte/Tools/Arbeiten präsentiert?
   - Gibt es Fallbeispiele oder Problem-Lösung-Strukturen?
   
   EXPERTISE (Fachwissen):
   - Wird Fachwissen demonstriert (Fachbegriffe, tiefe Erklärungen)?
   - Gibt es eine klare Methodik/Arbeitsweise?
   - Werden technische Konzepte korrekt erklärt?
   - Sind Credentials/Qualifikationen erkennbar?
   
   AUTHORITATIVENESS (Autorität):
   - Ist die Person/Marke verifizierbar (sameAs Links)?
   - Gibt es Schema-Markup für die Entität?
   - Gibt es externe Validierung (Zitate, Erwähnungen)?
   - Sind Social Profile verknüpft?
   
   TRUSTWORTHINESS (Vertrauen):
   - Sind rechtliche Seiten vorhanden (Impressum, Datenschutz)?
   - Gibt es Kontaktmöglichkeiten?
   - Ist die Identität transparent?
   - Gibt es Trust-Signale?

2. CONTENT-QUALITÄT BEWERTUNG (0-100 Score + Begründung)
   
   - Storytelling & Narrative: Ist der Content fesselnd? Gibt es einen roten Faden?
   - Persönlichkeit & Ton: Ist der Text persönlich oder generisch?
   - Struktur & Lesbarkeit: Ist der Content gut gegliedert?
   - Unique Value: Bietet der Content einzigartigen Mehrwert?
   - Problem-Lösung: Werden Probleme angesprochen und gelöst?

3. GEO-READINESS BEWERTUNG (0-100 Score + Begründung)
   
   - Entitäts-Klarheit: Kann ein LLM die Entität (Person/Firma) klar identifizieren?
   - Zitierbarkeit: Gibt es klare Fakten, Definitionen, Listen die zitiert werden können?
   - FAQ-Struktur: Sind Fragen und Antworten vorhanden?
   - Direkte Antworten: Gibt es klare Statements die ein LLM extrahieren kann?

4. TECHNISCHES SEO (0-100 Score)
   - Basierend auf den harten Fakten (Schema, Struktur, Performance, etc.)

5. PRIORISIERTER MASSNAHMENPLAN
   
   🔴 KRITISCH (sofort umsetzen):
   - Was fehlt und ist essentiell?
   
   🟡 WICHTIG (zeitnah umsetzen):
   - Was würde signifikant verbessern?
   
   🟢 NICE-TO-HAVE (bei Gelegenheit):
   - Optimierungen für Perfektion

WICHTIGE REGELN:
- Sei STRENG aber GERECHT - bewerte was DA IST, nicht was fehlen könnte
- Wenn die FAQs eine klare Problem-Lösung-Struktur haben, erkenne das an
- Wenn technische Methodik erklärt wird (RAG, Vektordatenbank, API), zählt das als Expertise
- Wenn eigene Tools/Projekte präsentiert werden, zählt das als Experience & Portfolio
- Beachte die Warnung zu dynamisch geladenen Inhalten bei Trust-Signalen
- Verwende die CONTENT SAMPLES um Tonalität und Qualität zu bewerten

STYLE GUIDE: ${compactStyles}

Antworte NUR mit HTML. Keine Einleitung, kein Markdown außerhalb von HTML.
`;
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const targetUrl = body.targetUrl || body.myUrl || body.url || body.target || body.siteUrl || body.domain;
    const competitorUrl = body.competitorUrl || body.competitor || body.compareUrl;
    
    if (!targetUrl) {
      return NextResponse.json({ message: 'URL fehlt' }, { status: 400 });
    }
    
    let normalizedUrl = targetUrl.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    // Parallel scrapen
    const [targetResult, competitorResult] = await Promise.all([
      scrapeAndExtract(normalizedUrl),
      competitorUrl ? scrapeAndExtract(competitorUrl) : Promise.resolve(null),
    ]);
    
    if (!targetResult) {
      return NextResponse.json({ message: 'Analyse fehlgeschlagen - Seite nicht erreichbar' }, { status: 400 });
    }
    
    const compactStyles = getCompactStyleGuide();
    const prompt = buildEvaluationPrompt(targetResult.facts, compactStyles);
    
    // KI-Bewertung streamen
    const result = await streamTextSafe({ prompt });
    
    return result.toTextStreamResponse();
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ message: 'Interner Serverfehler' }, { status: 500 });
  }
}
