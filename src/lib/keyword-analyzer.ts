// src/lib/keyword-analyzer.ts
// Intelligente Analyse von GSC Keywords für den Landingpage Generator

// ============================================================================
// TYPES
// ============================================================================

export interface Keyword {
  query: string;
  clicks: number;
  position: number;
  impressions: number;
}

export interface StrikingDistanceKeyword {
  keyword: string;
  position: number;
  impressions: number;
  priority: 'high' | 'medium' | 'low';
}

export interface KeywordCluster {
  theme: string;
  keywords: string[];
  totalClicks: number;
}

export interface KeywordAnalysis {
  // Hauptkeyword (höchste Klicks)
  mainKeyword: string;
  
  // Sekundäre Keywords (Top 5 nach Klicks, ohne Main)
  secondaryKeywords: string[];
  
  // Striking Distance (Position 4-20, sortiert nach Impressionen)
  strikingDistance: StrikingDistanceKeyword[];
  
  // Long-Tail Keywords (3+ Wörter)
  longTailKeywords: string[];
  
  // Fragen-Keywords (beginnen mit W-Wort)
  questionKeywords: string[];
  
  // Keyword-Cluster (thematisch gruppiert)
  clusters: KeywordCluster[];
  
  // Statistiken
  stats: {
    totalKeywords: number;
    totalClicks: number;
    totalImpressions: number;
    avgPosition: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Deutsche W-Frage-Wörter
const QUESTION_WORDS_DE = [
  'was', 'wie', 'wo', 'wer', 'warum', 'wann', 'welche', 'welcher', 
  'welches', 'wessen', 'womit', 'wozu', 'woher', 'wohin', 'wieso'
];

// Englische W-Frage-Wörter (falls gemischte Daten)
const QUESTION_WORDS_EN = [
  'what', 'how', 'where', 'who', 'why', 'when', 'which', 'whose'
];

// Stoppwörter für Clustering (werden ignoriert)
const STOP_WORDS = [
  'und', 'oder', 'für', 'mit', 'bei', 'von', 'zu', 'im', 'in', 'der', 
  'die', 'das', 'den', 'dem', 'ein', 'eine', 'einer', 'eines', 'the',
  'and', 'or', 'for', 'with', 'at', 'from', 'to', 'a', 'an'
];

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analysiert GSC Keywords und extrahiert strukturierte Insights
 * @param keywords - Array von Keyword-Objekten aus GSC
 * @param topic - Optionales Thema als Fallback für Hauptkeyword
 * @returns KeywordAnalysis Objekt mit allen Insights
 */
export function analyzeKeywords(keywords: Keyword[], topic?: string): KeywordAnalysis {
  // Edge Case: Keine Keywords
  if (!keywords || keywords.length === 0) {
    return {
      mainKeyword: topic || '',
      secondaryKeywords: [],
      strikingDistance: [],
      longTailKeywords: [],
      questionKeywords: [],
      clusters: [],
      stats: {
        totalKeywords: 0,
        totalClicks: 0,
        totalImpressions: 0,
        avgPosition: 0
      }
    };
  }

  // 1. Statistiken berechnen
  const stats = calculateStats(keywords);
  
  // 2. Nach Klicks sortieren (höchste zuerst)
  const byClicks = [...keywords].sort((a, b) => b.clicks - a.clicks);
  
  // 3. Hauptkeyword = meiste Klicks (oder Topic als Fallback)
  const mainKeyword = byClicks[0]?.query || topic || '';
  
  // 4. Sekundäre Keywords (Top 5 ohne Main)
  const secondaryKeywords = byClicks
    .slice(1, 6)
    .map(k => k.query);
  
  // 5. Striking Distance Keywords
  const strikingDistance = findStrikingDistance(keywords);
  
  // 6. Long-Tail Keywords (3+ Wörter)
  const longTailKeywords = findLongTailKeywords(keywords);
  
  // 7. Fragen-Keywords
  const questionKeywords = findQuestionKeywords(keywords);
  
  // 8. Keyword-Cluster
  const clusters = createKeywordClusters(keywords);

  return {
    mainKeyword,
    secondaryKeywords,
    strikingDistance,
    longTailKeywords,
    questionKeywords,
    clusters,
    stats
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Berechnet Statistiken über alle Keywords
 */
function calculateStats(keywords: Keyword[]) {
  const totalKeywords = keywords.length;
  const totalClicks = keywords.reduce((sum, k) => sum + k.clicks, 0);
  const totalImpressions = keywords.reduce((sum, k) => sum + k.impressions, 0);
  const avgPosition = keywords.length > 0
    ? keywords.reduce((sum, k) => sum + k.position, 0) / keywords.length
    : 0;

  return {
    totalKeywords,
    totalClicks,
    totalImpressions,
    avgPosition: Math.round(avgPosition * 10) / 10
  };
}

/**
 * Findet Striking Distance Keywords (Position 4-20)
 * Diese haben hohes Potenzial für schnelle Ranking-Verbesserungen
 */
function findStrikingDistance(keywords: Keyword[]): StrikingDistanceKeyword[] {
  return keywords
    .filter(k => k.position >= 4 && k.position <= 20)
    .sort((a, b) => {
      // Sortiere nach einem Score: Impressionen / Position
      // Höhere Impressionen + niedrigere Position = besseres Potenzial
      const scoreA = a.impressions / a.position;
      const scoreB = b.impressions / b.position;
      return scoreB - scoreA;
    })
    .slice(0, 7)
    .map(k => ({
      keyword: k.query,
      position: Math.round(k.position * 10) / 10,
      impressions: k.impressions,
      priority: determinePriority(k)
    }));
}

/**
 * Bestimmt die Priorität eines Striking Distance Keywords
 */
function determinePriority(keyword: Keyword): 'high' | 'medium' | 'low' {
  // High: Position 4-10 UND > 500 Impressionen
  if (keyword.position <= 10 && keyword.impressions > 500) {
    return 'high';
  }
  // Medium: Position 4-15 ODER > 300 Impressionen
  if (keyword.position <= 15 || keyword.impressions > 300) {
    return 'medium';
  }
  // Low: Rest
  return 'low';
}

/**
 * Findet Long-Tail Keywords (3+ Wörter)
 * Diese sind oft spezifischer und leichter zu ranken
 */
function findLongTailKeywords(keywords: Keyword[]): string[] {
  return keywords
    .filter(k => {
      const wordCount = k.query.trim().split(/\s+/).length;
      return wordCount >= 3;
    })
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 7)
    .map(k => k.query);
}

/**
 * Findet Fragen-Keywords (W-Fragen)
 * Ideal für FAQ-Sections und Featured Snippets
 */
function findQuestionKeywords(keywords: Keyword[]): string[] {
  const allQuestionWords = [...QUESTION_WORDS_DE, ...QUESTION_WORDS_EN];
  
  return keywords
    .filter(k => {
      const firstWord = k.query.toLowerCase().split(/\s+/)[0];
      return allQuestionWords.includes(firstWord);
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)
    .map(k => k.query);
}

/**
 * Erstellt thematische Keyword-Cluster
 * Gruppiert Keywords nach gemeinsamen Begriffen
 */
function createKeywordClusters(keywords: Keyword[]): KeywordCluster[] {
  const clusterMap = new Map<string, { keywords: Keyword[]; totalClicks: number }>();
  
  keywords.forEach(k => {
    // Extrahiere signifikante Wörter (keine Stoppwörter, min. 3 Zeichen)
    const words = k.query.toLowerCase().split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_WORDS.includes(w));
    
    // Füge zu jedem relevanten Wort-Cluster hinzu
    words.forEach(word => {
      if (!clusterMap.has(word)) {
        clusterMap.set(word, { keywords: [], totalClicks: 0 });
      }
      const cluster = clusterMap.get(word)!;
      
      // Vermeide Duplikate
      if (!cluster.keywords.some(existing => existing.query === k.query)) {
        cluster.keywords.push(k);
        cluster.totalClicks += k.clicks;
      }
    });
  });
  
  // Filtere und sortiere Cluster
  return Array.from(clusterMap.entries())
    .filter(([_, data]) => data.keywords.length >= 2) // Mindestens 2 Keywords
    .sort((a, b) => b[1].totalClicks - a[1].totalClicks) // Nach Klicks sortieren
    .slice(0, 5) // Top 5 Cluster
    .map(([theme, data]) => ({
      theme: theme.charAt(0).toUpperCase() + theme.slice(1), // Capitalize
      keywords: data.keywords
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map(k => k.query),
      totalClicks: data.totalClicks
    }));
}

// ============================================================================
// PROMPT GENERATOR
// ============================================================================

/**
 * Generiert einen strukturierten Kontext-String für den AI-Prompt
 * @param analysis - Das KeywordAnalysis Objekt
 * @returns Formatierter String für den Prompt
 */
export function generateKeywordPromptContext(analysis: KeywordAnalysis): string {
  if (!analysis.mainKeyword && analysis.stats.totalKeywords === 0) {
    return '';
  }

  let context = `
### KEYWORD-ANALYSE (aus Google Search Console - ${analysis.stats.totalKeywords} Keywords analysiert)

**HAUPTKEYWORD (PFLICHT in H1 + erstem Absatz):**
"${analysis.mainKeyword}"
→ Dieses Keyword hat die meisten Klicks und muss prominent platziert werden!
`;

  if (analysis.secondaryKeywords.length > 0) {
    context += `
**SEKUNDÄRE KEYWORDS (natürlich im Text verteilen):**
${analysis.secondaryKeywords.map(k => `- "${k}"`).join('\n')}
`;
  }

  if (analysis.strikingDistance.length > 0) {
    context += `
**🎯 STRIKING DISTANCE - HOHES RANKING-POTENZIAL:**
Diese Keywords sind fast auf Seite 1! Besonders wichtig zu integrieren:
${analysis.strikingDistance.map(k => {
  const priorityIcon = k.priority === 'high' ? '🔴' : k.priority === 'medium' ? '🟡' : '🟢';
  return `${priorityIcon} "${k.keyword}" (Pos. ${k.position}, ${k.impressions.toLocaleString('de-DE')} Impressionen)`;
}).join('\n')}
`;
  }

  if (analysis.longTailKeywords.length > 0) {
    context += `
**LONG-TAIL KEYWORDS (für thematische Tiefe & leichteres Ranking):**
${analysis.longTailKeywords.map(k => `- "${k}"`).join('\n')}
`;
  }

  if (analysis.questionKeywords.length > 0) {
    context += `
**❓ FRAGEN AUS SUCHANFRAGEN (IDEAL für FAQ-Section!):**
Diese Fragen stellen echte Nutzer - beantworte sie in den FAQs:
${analysis.questionKeywords.map(k => `- "${k}"`).join('\n')}
`;
  }

  if (analysis.clusters.length > 0) {
    context += `
**THEMEN-CLUSTER (für semantische Vollständigkeit):**
${analysis.clusters.map(c => 
  `• ${c.theme} (${c.totalClicks} Klicks): ${c.keywords.slice(0, 3).join(', ')}${c.keywords.length > 3 ? '...' : ''}`
).join('\n')}
`;
  }

  // Statistik-Zusammenfassung
  context += `
**📊 STATISTIK:**
- Analysierte Keywords: ${analysis.stats.totalKeywords}
- Gesamt-Klicks: ${analysis.stats.totalClicks.toLocaleString('de-DE')}
- Gesamt-Impressionen: ${analysis.stats.totalImpressions.toLocaleString('de-DE')}
- Ø Position: ${analysis.stats.avgPosition}
`;

  return context;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Schnelle Extraktion nur des Hauptkeywords
 */
export function getMainKeyword(keywords: Keyword[], fallback?: string): string {
  if (!keywords || keywords.length === 0) {
    return fallback || '';
  }
  
  const sorted = [...keywords].sort((a, b) => b.clicks - a.clicks);
  return sorted[0]?.query || fallback || '';
}

/**
 * Prüft ob ein Keyword eine Frage ist
 */
export function isQuestionKeyword(query: string): boolean {
  const firstWord = query.toLowerCase().split(/\s+/)[0];
  return [...QUESTION_WORDS_DE, ...QUESTION_WORDS_EN].includes(firstWord);
}

/**
 * Berechnet die Keyword-Dichte in einem Text
 */
export function calculateKeywordDensity(text: string, keyword: string): number {
  const cleanText = text.toLowerCase().replace(/[^\w\säöüß]/g, '');
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const keywordLower = keyword.toLowerCase();
  
  if (words.length === 0) return 0;
  
  // Zähle exakte Matches und Teil-Matches
  let count = 0;
  const keywordWords = keywordLower.split(/\s+/);
  
  for (let i = 0; i <= words.length - keywordWords.length; i++) {
    const slice = words.slice(i, i + keywordWords.length).join(' ');
    if (slice === keywordLower) {
      count++;
    }
  }
  
  // Dichte = (Keyword-Vorkommen * Keyword-Wortanzahl) / Gesamt-Wörter * 100
  const density = (count * keywordWords.length) / words.length * 100;
  return Math.round(density * 100) / 100;
}
