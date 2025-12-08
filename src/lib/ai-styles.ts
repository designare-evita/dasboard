// src/lib/ai-styles.ts
// Zentrale Style-Definitionen für alle AI-Prompts
// Bootstrap Icons statt Emojis für professionelles Design

// ============================================================================
// BOOTSTRAP ICONS
// ============================================================================
export const ICONS = {
  // Status & Feedback
  check: '<i class="bi bi-check-circle-fill"></i>',
  checkSmall: '<i class="bi bi-check-lg"></i>',
  x: '<i class="bi bi-x-circle-fill"></i>',
  xSmall: '<i class="bi bi-x-lg"></i>',
  warning: '<i class="bi bi-exclamation-triangle-fill"></i>',
  info: '<i class="bi bi-info-circle-fill"></i>',
  question: '<i class="bi bi-question-circle-fill"></i>',
  
  // Trends & Analytics
  trendUp: '<i class="bi bi-graph-up-arrow"></i>',
  trendDown: '<i class="bi bi-graph-down-arrow"></i>',
  trendStable: '<i class="bi bi-arrow-right"></i>',
  fire: '<i class="bi bi-fire"></i>',
  chart: '<i class="bi bi-bar-chart-fill"></i>',
  pieChart: '<i class="bi bi-pie-chart-fill"></i>',
  activity: '<i class="bi bi-activity"></i>',
  
  // Actions & Features
  rocket: '<i class="bi bi-rocket-takeoff-fill"></i>',
  target: '<i class="bi bi-bullseye"></i>',
  lightbulb: '<i class="bi bi-lightbulb-fill"></i>',
  magic: '<i class="bi bi-magic"></i>',
  search: '<i class="bi bi-search"></i>',
  filter: '<i class="bi bi-funnel-fill"></i>',
  
  // Content & Structure
  file: '<i class="bi bi-file-earmark-text-fill"></i>',
  folder: '<i class="bi bi-folder-fill"></i>',
  list: '<i class="bi bi-list-ul"></i>',
  grid: '<i class="bi bi-grid-3x3-gap-fill"></i>',
  layers: '<i class="bi bi-layers-fill"></i>',
  
  // Tech & Tools
  code: '<i class="bi bi-code-slash"></i>',
  gear: '<i class="bi bi-gear-fill"></i>',
  terminal: '<i class="bi bi-terminal-fill"></i>',
  globe: '<i class="bi bi-globe"></i>',
  link: '<i class="bi bi-link-45deg"></i>',
  
  // Communication
  chat: '<i class="bi bi-chat-dots-fill"></i>',
  megaphone: '<i class="bi bi-megaphone-fill"></i>',
  envelope: '<i class="bi bi-envelope-fill"></i>',
  
  // Objects
  star: '<i class="bi bi-star-fill"></i>',
  starHalf: '<i class="bi bi-star-half"></i>',
  heart: '<i class="bi bi-heart-fill"></i>',
  bookmark: '<i class="bi bi-bookmark-fill"></i>',
  tag: '<i class="bi bi-tag-fill"></i>',
  award: '<i class="bi bi-award-fill"></i>',
  trophy: '<i class="bi bi-trophy-fill"></i>',
  
  // Arrows & Navigation
  arrowRight: '<i class="bi bi-arrow-right"></i>',
  arrowUp: '<i class="bi bi-arrow-up"></i>',
  arrowDown: '<i class="bi bi-arrow-down"></i>',
  chevronRight: '<i class="bi bi-chevron-right"></i>',
  
  // Numbers (für Steps)
  num1: '<i class="bi bi-1-circle-fill"></i>',
  num2: '<i class="bi bi-2-circle-fill"></i>',
  num3: '<i class="bi bi-3-circle-fill"></i>',
  num4: '<i class="bi bi-4-circle-fill"></i>',
  
  // Misc
  eye: '<i class="bi bi-eye-fill"></i>',
  clock: '<i class="bi bi-clock-fill"></i>',
  calendar: '<i class="bi bi-calendar-event-fill"></i>',
  person: '<i class="bi bi-person-fill"></i>',
  people: '<i class="bi bi-people-fill"></i>',
  building: '<i class="bi bi-building"></i>',
  cart: '<i class="bi bi-cart-fill"></i>',
  phone: '<i class="bi bi-telephone-fill"></i>',
  
} as const;

// ============================================================================
// TAILWIND STYLE CLASSES
// ============================================================================
export const STYLES = {
  // Typography
  h3: 'font-bold text-gray-900 text-sm mt-3 mb-1.5 flex items-center gap-2',
  h4: 'font-bold text-gray-700 text-xs uppercase tracking-wide mb-1.5',
  p: 'text-gray-600 text-xs leading-relaxed mb-2',
  pSmall: 'text-gray-500 text-[11px] leading-relaxed',
  label: 'text-[10px] font-bold text-gray-500 uppercase tracking-wide',
  
  // Layout
  container: 'space-y-2',
  grid2: 'grid grid-cols-2 gap-2',
  grid3: 'grid grid-cols-3 gap-2',
  grid4: 'grid grid-cols-4 gap-2',
  flexBetween: 'flex items-center justify-between',
  flexStart: 'flex items-start gap-2',
  flexCenter: 'flex items-center gap-2',
  
  // Cards & Containers
  card: 'bg-white border border-gray-200 rounded-lg p-3',
  cardHover: 'bg-white border border-gray-200 rounded-lg p-3 hover:border-indigo-200 transition-colors',
  cardHeader: 'bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-3 text-white',
  cardHeaderSmall: 'bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-2.5 text-white',
  
  // Boxes (Info, Warning, Success, Error)
  infoBox: 'bg-blue-50 border border-blue-100 rounded-lg p-2.5',
  warningBox: 'bg-amber-50 border border-amber-200 rounded-lg p-2.5',
  successBox: 'bg-emerald-50 border border-emerald-200 rounded-lg p-2.5',
  errorBox: 'bg-rose-50 border border-rose-200 rounded-lg p-2.5',
  
  // Accent Boxes
  indigoBox: 'bg-indigo-50 border border-indigo-200 rounded-lg p-2.5',
  purpleBox: 'bg-purple-50 border border-purple-200 rounded-lg p-2.5',
  amberBox: 'bg-amber-50 border border-amber-200 rounded-lg p-2.5',
  
  // Recommendation Box (Dark)
  recommendBox: 'bg-indigo-600 text-white p-3 rounded-lg',
  
  // Fazit Boxes (with left border)
  fazitPositive: 'bg-emerald-50 border-l-4 border-emerald-500 p-2.5 rounded-r-lg',
  fazitNegative: 'bg-rose-50 border-l-4 border-rose-500 p-2.5 rounded-r-lg',
  fazitNeutral: 'bg-blue-50 border-l-4 border-blue-500 p-2.5 rounded-r-lg',
  fazitWarning: 'bg-amber-50 border-l-4 border-amber-500 p-2.5 rounded-r-lg',
  
  // Badges
  badge: 'px-2 py-0.5 rounded text-[10px] font-medium',
  badgePositive: 'bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-medium',
  badgeNegative: 'bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-medium',
  badgeNeutral: 'bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium',
  badgeInfo: 'bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-medium',
  badgeWarning: 'bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-medium',
  badgePurple: 'bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-medium',
  badgeIndigo: 'bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-medium',
  badgeCustom: 'bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-medium', // For "Custom/Selbstprogrammiert"
  
  // Lists
  list: 'space-y-1',
  listCompact: 'space-y-0.5',
  
  // List Items
  listItem: 'flex items-start gap-1.5 text-xs text-gray-700',
  listItemSuccess: 'flex items-start gap-1.5 text-xs text-gray-700',
  listItemError: 'flex items-start gap-1.5 text-xs text-gray-700',
  listItemFeature: 'flex items-start gap-1.5 text-xs text-gray-700',
  
  // List Item Icons (colored)
  iconSuccess: 'text-emerald-600 text-xs',
  iconError: 'text-rose-500 text-xs',
  iconFeature: 'text-purple-600 text-xs',
  iconNeutral: 'text-gray-400 text-xs',
  iconIndigo: 'text-indigo-500 text-xs',
  
  // Metrics
  metricCard: 'bg-white border border-gray-200 rounded-lg p-2 text-center',
  metricCardColored: 'bg-gray-50 border border-gray-200 rounded-lg p-2 text-center',
  metricValue: 'text-lg font-bold text-gray-900',
  metricValueLarge: 'text-xl font-bold text-gray-900',
  metricLabel: 'text-[9px] text-gray-500 uppercase font-medium',
  
  // Keywords & Tags
  tag: 'bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded text-[10px]',
  tagHighlight: 'bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-medium',
  tagAmber: 'bg-white border border-amber-200 text-amber-800 px-2 py-0.5 rounded text-[10px]',
  
  // Keyword Rows
  keywordRow: 'flex justify-between text-xs py-1 border-b border-gray-100 last:border-0',
  
  // Steps / Actions
  stepNumber: 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0',
  stepText: 'text-xs text-gray-700',
  
  // Subpage Items
  subpageItem: 'text-xs text-gray-500 py-1 border-b border-gray-50 last:border-0',
  
  // Footer
  footer: 'text-[10px] text-gray-400 text-center mt-2',
  
  // Colors (for dynamic use)
  textPositive: 'text-emerald-600',
  textNegative: 'text-rose-600',
  textWarning: 'text-amber-600',
  textInfo: 'text-blue-600',
  textIndigo: 'text-indigo-600',
  textPurple: 'text-purple-600',
  textMuted: 'text-gray-500',
  
} as const;

// ============================================================================
// COLOR MAPS (für dynamische Badge-Farben etc.)
// ============================================================================
export const STATUS_COLORS = {
  rose: {
    badge: 'bg-rose-500 text-white',
    text: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  emerald: {
    badge: 'bg-emerald-500 text-white',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  amber: {
    badge: 'bg-amber-500 text-white',
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  blue: {
    badge: 'bg-blue-500 text-white',
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  gray: {
    badge: 'bg-gray-400 text-white',
    text: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
  },
  indigo: {
    badge: 'bg-indigo-500 text-white',
    text: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  purple: {
    badge: 'bg-purple-500 text-white',
    text: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
} as const;

// ============================================================================
// PROMPT HELPERS
// ============================================================================

/**
 * Generiert den Style-Guide Teil für AI-Prompts
 * Wird am Anfang des Prompts eingefügt
 */
export function getStyleGuideForPrompt(): string {
  return `
FORMATIERUNG (STRIKT BEFOLGEN):
1. NUR HTML mit Tailwind-Klassen - KEIN Markdown
2. Bootstrap Icons statt Emojis: <i class="bi bi-[name]"></i>
3. Kompakte Abstände verwenden

VERFÜGBARE KOMPONENTEN:

Überschrift:
<h3 class="${STYLES.h3}"><i class="bi bi-icon-name"></i> Titel</h3>

Text:
<p class="${STYLES.p}">Fließtext hier</p>

2-Spalten Grid:
<div class="${STYLES.grid2}">
  <div class="${STYLES.card}">Spalte 1</div>
  <div class="${STYLES.card}">Spalte 2</div>
</div>

Card mit Titel:
<div class="${STYLES.card}">
  <h4 class="${STYLES.h4}">Titel</h4>
  <p class="${STYLES.pSmall}">Inhalt</p>
</div>

Info-Box:
<div class="${STYLES.infoBox}">
  <p class="${STYLES.pSmall}">Info-Text</p>
</div>

Erfolg-Box:
<div class="${STYLES.successBox}">
  <p class="${STYLES.pSmall}">Erfolgs-Text</p>
</div>

Warnung-Box:
<div class="${STYLES.warningBox}">
  <p class="${STYLES.pSmall}">Warnung-Text</p>
</div>

Empfehlungs-Box (dunkel):
<div class="${STYLES.recommendBox}">
  <p class="text-sm">Empfehlung</p>
</div>

Badge positiv:
<span class="${STYLES.badgePositive}">Text</span>

Badge negativ:
<span class="${STYLES.badgeNegative}">Text</span>

Badge CMS:
<span class="${STYLES.badgePurple}">CMS</span>

Badge Custom:
<span class="${STYLES.badgeCustom}"><i class="bi bi-star-fill"></i> CUSTOM</span>

Liste mit Vorteilen:
<ul class="${STYLES.list}">
  <li class="${STYLES.listItem}"><i class="bi bi-check-lg ${STYLES.iconSuccess}"></i><span>Vorteil</span></li>
</ul>

Liste mit Nachteilen:
<ul class="${STYLES.list}">
  <li class="${STYLES.listItem}"><i class="bi bi-x-lg ${STYLES.iconError}"></i><span>Nachteil</span></li>
</ul>

Liste mit Features:
<ul class="${STYLES.list}">
  <li class="${STYLES.listItem}"><i class="bi bi-star-fill ${STYLES.iconFeature}"></i><span>Feature</span></li>
</ul>

Subpage Item:
<div class="${STYLES.subpageItem}"><i class="bi bi-file-earmark"></i> /pfad - Titel</div>

Fazit positiv:
<div class="${STYLES.fazitPositive}">
  <div class="${STYLES.flexStart}">
    <i class="bi bi-check-circle-fill ${STYLES.textPositive}"></i>
    <div>
      <p class="font-bold text-sm text-emerald-800">Titel</p>
      <p class="${STYLES.pSmall} text-emerald-700">Beschreibung</p>
    </div>
  </div>
</div>

Fazit negativ/Warnung:
<div class="${STYLES.fazitWarning}">
  <div class="${STYLES.flexStart}">
    <i class="bi bi-exclamation-triangle-fill ${STYLES.textWarning}"></i>
    <div>
      <p class="font-bold text-sm text-amber-800">Titel</p>
      <p class="${STYLES.pSmall} text-amber-700">Beschreibung</p>
    </div>
  </div>
</div>

WICHTIGE ICONS:
- Übersicht: bi-info-circle
- Technologie: bi-gear-fill
- Features: bi-stars
- Struktur: bi-diagram-3-fill
- Stärken: bi-shield-fill-check
- Empfehlungen: bi-bullseye
- Check: bi-check-lg
- X: bi-x-lg
- Star: bi-star-fill
- Datei: bi-file-earmark
`;
}

/**
 * Generiert einen kompakten Style-Guide (weniger Tokens)
 */
export function getCompactStyleGuide(): string {
  return `
FORMAT: Nur HTML+Tailwind. Keine Markdown. Bootstrap Icons: <i class="bi bi-name"></i>

STYLES:
- H3: class="${STYLES.h3}"
- H4: class="${STYLES.h4}"
- P: class="${STYLES.p}"
- Card: class="${STYLES.card}"
- Grid 2-Spalten: class="${STYLES.grid2}"
- Info-Box: class="${STYLES.infoBox}"
- Success-Box: class="${STYLES.successBox}"
- Warning-Box: class="${STYLES.warningBox}"
- Empfehlung: class="${STYLES.recommendBox}"
- Badge+: class="${STYLES.badgePositive}"
- Badge-: class="${STYLES.badgeNegative}"
- Badge CMS: class="${STYLES.badgePurple}"
- Badge Custom: class="${STYLES.badgeCustom}"
- Liste: class="${STYLES.list}"
- List-Item: class="${STYLES.listItem}"
- Icon grün: class="${STYLES.iconSuccess}"
- Icon rot: class="${STYLES.iconError}"
- Icon lila: class="${STYLES.iconFeature}"
- Fazit+: class="${STYLES.fazitPositive}"
- Fazit!: class="${STYLES.fazitWarning}"
`;
}
