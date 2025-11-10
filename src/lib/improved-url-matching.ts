// src/lib/improved-url-matching.ts
// OPTIMIERT: Mit 'isDomainProperty'-Flag zur Reduzierung von Varianten

/**
 * Normalisiert eine URL für das Matching
 * WICHTIG: Diese Funktion muss 1:1 für DB-URLs und GSC-URLs funktionieren
 */
export function normalizeUrlImproved(url: string): string {
  if (!url) return '';

  try {
    // 1. URL parsen
    const urlObj = new URL(url);
    
    // 2. Host normalisieren (ohne www, lowercase)
    let host = urlObj.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    
    // 3. Path normalisieren
    let path = urlObj.pathname.toLowerCase();
    
    // Trailing slash IMMER entfernen (außer bei Root)
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    // 4. Query-Parameter sortieren (falls vorhanden)
    const params = Array.from(urlObj.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    const search = params.length > 0 
      ? '?' + new URLSearchParams(params).toString() 
      : '';
    
    // 5. Zusammensetzen: host + path + search (OHNE Protokoll!)
    return `${host}${path}${search}`;
    
  } catch (error) {
    // Fallback: Manuelle String-Manipulation
    return url
      .replace(/^https?:\/\//, '')      // Protokoll entfernen
      .replace(/^www\./, '')             // www entfernen
      .toLowerCase()                     // Lowercase
      .replace(/\/+$/, '')               // Trailing slashes entfernen
      .split('#')[0];                    // Anchor entfernen
  }
}

/**
 * Erstellt intelligente URL-Varianten für das Matching
 * NEU: Akzeptiert 'isDomainProperty', um Sprach-Fallbacks zu deaktivieren
 */
export function createSmartUrlVariants(
  url: string,
  // NEU: Flag, um die exzessive Variantenerstellung zu steuern
  isDomainProperty: boolean = false 
): string[] {
  const variants: Set<string> = new Set();
  
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    const originalPath = urlObj.pathname;
    const search = urlObj.search;
    
    // Host-Varianten (immer nötig)
    const hosts = [host];
    if (host.startsWith('www.')) {
      hosts.push(host.substring(4));
    } else {
      hosts.push(`www.${host}`);
    }
    
    // Path-Varianten (Basis)
    const pathVariants = new Set<string>();
    pathVariants.add(originalPath);
    
    // Trailing slash Varianten (immer nötig)
    if (originalPath !== '/' && originalPath.endsWith('/')) {
      pathVariants.add(originalPath.slice(0, -1));
    } else if (originalPath !== '/') {
      pathVariants.add(originalPath + '/');
    }

    // =================================================================
    // START ÄNDERUNG: Sprach-Fallbacks überspringen
    //
    // Dieser Block wird NUR ausgeführt, wenn es KEINE Domain-Property ist.
    // Das ist die Hauptursache für die 88 Varianten und die langsamen Abfragen.
    // =================================================================
    if (!isDomainProperty) {
      // Sprachpräfix-Erkennung: /de/, /en/, etc.
      const langPattern = /^\/([a-z]{2})(\/|$)/i;
      const langMatch = originalPath.match(langPattern);
      
      if (langMatch) {
        // URL HAT Sprachpräfix → Erstelle Variante OHNE
        const pathWithoutLang = originalPath.replace(langPattern, '/');
        
        if (pathWithoutLang !== originalPath) {
          pathVariants.add(pathWithoutLang);
          
          // Trailing slash für pathWithoutLang
          if (pathWithoutLang !== '/' && pathWithoutLang.endsWith('/')) {
            pathVariants.add(pathWithoutLang.slice(0, -1));
          } else if (pathWithoutLang !== '/') {
            pathVariants.add(pathWithoutLang + '/');
          }
        }
      } else {
        // URL HAT KEIN Sprachpräfix → Erstelle Varianten MIT häufigen Sprachen
        const commonLangs = ['de', 'en', 'fr', 'es', 'it'];
        
        for (const lang of commonLangs) {
          if (originalPath === '/') {
            pathVariants.add(`/${lang}/`);
            pathVariants.add(`/${lang}`);
          } else {
            // Pfad mit Sprache vorne
            const withLang = originalPath.startsWith('/') 
              ? `/${lang}${originalPath}` 
              : `/${lang}/${originalPath}`;
            
            pathVariants.add(withLang);
            
            // Trailing slash Varianten
            if (withLang.endsWith('/')) {
              pathVariants.add(withLang.slice(0, -1));
            } else {
              pathVariants.add(withLang + '/');
            }
          }
        }
      }
    }
    // =================================================================
    // ENDE ÄNDERUNG
    // =================================================================

    // Kombiniere alle Varianten
    const protocols = ['https://', 'http://'];
    
    for (const protocol of protocols) {
      for (const h of hosts) {
        for (const p of pathVariants) {
          variants.add(`${protocol}${h}${p}${search}`);
        }
      }
    }
    
  } catch (error) {
    // Fallback: Original-URL
    variants.add(url);
  }
  
  return Array.from(variants);
}

/**
 * Debug-Funktion: Zeigt URL-Normalisierung und Varianten
 */
export function debugUrlMatching(url: string): {
  original: string;
  normalized: string;
  variantCount: number;
  sampleVariants: string[];
  normalizedVariants: string[];
} {
  const normalized = normalizeUrlImproved(url);
  // Ruft createSmartUrlVariants mit Standardwert (isDomainProperty: false) auf,
  // was für Debugging-Zwecke korrekt ist.
  const variants = createSmartUrlVariants(url);
  const normalizedVariants = variants.map(v => normalizeUrlImproved(v));
  
  return {
    original: url,
    normalized,
    variantCount: variants.length,
    sampleVariants: variants.slice(0, 10),
    normalizedVariants: [...new Set(normalizedVariants)].slice(0, 10),
  };
}

/**
 * Testet ob zwei URLs matchen (nach Normalisierung)
 */
export function urlsMatch(url1: string, url2: string): boolean {
  const norm1 = normalizeUrlImproved(url1);
  const norm2 = normalizeUrlImproved(url2);
  return norm1 === norm2;
}

/**
 * Findet die passende DB-URL für eine GSC-URL
 * Verwendet intelligentes Matching mit Varianten
 */
export function findMatchingDbUrl(
  gscUrl: string,
  dbUrls: string[]
): string | null {
  const gscNormalized = normalizeUrlImproved(gscUrl);
  
  // 1. Versuche direktes Match
  for (const dbUrl of dbUrls) {
    const dbNormalized = normalizeUrlImproved(dbUrl);
    if (dbNormalized === gscNormalized) {
      return dbUrl;
    }
  }
  
  // 2. Versuche Match über Varianten
  for (const dbUrl of dbUrls) {
    // Hier rufen wir mit (isDomainProperty: false) auf, da wir die
    // volle Matching-Power wollen, um eine DB-URL mit einer GSC-URL
    // zu verknüpfen (z.B. mit/ohne Sprachcode)
    const variants = createSmartUrlVariants(dbUrl, false);
    const normalizedVariants = variants.map(v => normalizeUrlImproved(v));
    
    if (normalizedVariants.includes(gscNormalized)) {
      return dbUrl;
    }
  }
  
  return null;
}
