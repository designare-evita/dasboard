// src/components/AiTrafficDetailCardV2.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Cpu, 
  FunnelFill, 
  SortDown, 
  SortUp,
  FileEarmarkText,
  Search,
  XCircleFill,
  ArrowRepeat,
  GraphUpArrow,
  People,
  Clock,
  ChevronDown,
  ChevronUp,
  ExclamationTriangleFill,
  InfoCircle,
  ArrowRight,
  Bullseye,
  BarChartFill,
  Diagram3,
  HandIndexThumb,
  CheckCircleFill,
  XCircle
} from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Treemap
} from 'recharts';
import { format, subDays, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import type { AiTrafficExtendedData, IntentCategory } from '@/lib/ai-traffic-extended-v2';

// ============================================================================
// PROPS
// ============================================================================

interface AiTrafficDetailCardV2Props {
  data?: AiTrafficExtendedData;
  isLoading?: boolean;
  dateRange?: string;
  className?: string;
  error?: string;
  onRefresh?: () => void;
}

// ============================================================================
// KONSTANTEN
// ============================================================================

const AI_SOURCE_COLORS: Record<string, string> = {
  'chatgpt.com': '#10a37f',
  'claude.ai': '#d97706',
  'perplexity.ai': '#6366f1',
  'gemini.google.com': '#4285f4',
  'copilot.microsoft.com': '#00a4ef',
  'you.com': '#8b5cf6',
  'poe.com': '#7c3aed',
  'character.ai': '#ec4899',
  'default': '#6b7280'
};

const AI_SOURCE_LABELS: Record<string, string> = {
  'chatgpt.com': 'ChatGPT',
  'claude.ai': 'Claude',
  'perplexity.ai': 'Perplexity',
  'gemini.google.com': 'Gemini',
  'copilot.microsoft.com': 'Copilot',
  'you.com': 'You.com',
  'poe.com': 'Poe',
  'character.ai': 'Character.AI'
};

type ViewTab = 'overview' | 'intent' | 'journey' | 'pages';
type SortField = 'sessions' | 'users' | 'avgEngagementTime' | 'bounceRate' | 'conversions';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// HELPER
// ============================================================================

function getSourceColor(source: string): string {
  const lowerSource = source.toLowerCase();
  for (const [key, color] of Object.entries(AI_SOURCE_COLORS)) {
    if (lowerSource.includes(key.split('.')[0])) return color;
  }
  return AI_SOURCE_COLORS.default;
}

function getSourceLabel(source: string): string {
  const lowerSource = source.toLowerCase();
  for (const [key, label] of Object.entries(AI_SOURCE_LABELS)) {
    if (lowerSource.includes(key.split('.')[0])) return label;
  }
  return source;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDateRangeString(range: string): string {
  const end = new Date();
  let start = subDays(end, 30);

  switch (range) {
    case '7d': start = subDays(end, 7); break;
    case '30d': start = subDays(end, 30); break;
    case '3m': start = subMonths(end, 3); break;
    case '6m': start = subMonths(end, 6); break;
    case '12m': start = subMonths(end, 12); break;
  }

  return `${format(start, 'dd.MM.yyyy', { locale: de })} - ${format(end, 'dd.MM.yyyy', { locale: de })}`;
}

// ============================================================================
// SUB-KOMPONENTEN
// ============================================================================

// Tab Button
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
      active 
        ? "bg-purple-600 text-white shadow-sm" 
        : "text-gray-600 hover:bg-gray-100"
    )}
  >
    {icon}
    {label}
  </button>
);

// Intent Card
const IntentCard: React.FC<{
  intent: IntentCategory;
  sessions: number;
  conversions: number;
  conversionRate: number;
  avgEngagementTime: number;
  percentage: number;
  topPages: Array<{ path: string; sessions: number }>;
}> = ({ intent, sessions, conversions, conversionRate, avgEngagementTime, percentage, topPages }) => (
  <div 
    className="p-4 rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all bg-white"
    style={{ borderLeftColor: intent.color, borderLeftWidth: '4px' }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">{intent.icon}</span>
        <span className="font-semibold text-gray-900">{intent.label}</span>
      </div>
      <span 
        className="text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ backgroundColor: `${intent.color}20`, color: intent.color }}
      >
        {percentage.toFixed(1)}%
      </span>
    </div>

    <div className="grid grid-cols-2 gap-3 mb-3">
      <div>
        <div className="text-xs text-gray-500">Sessions</div>
        <div className="text-lg font-bold text-gray-900">{sessions.toLocaleString('de-DE')}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500">Conversions</div>
        <div className="text-lg font-bold text-gray-900">{conversions}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500">Conv. Rate</div>
        <div className={cn(
          "text-lg font-bold",
          conversionRate > 5 ? "text-green-600" : conversionRate > 2 ? "text-amber-600" : "text-gray-600"
        )}>
          {conversionRate.toFixed(1)}%
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-500">Ø Zeit</div>
        <div className="text-lg font-bold text-gray-900">{formatDuration(avgEngagementTime)}</div>
      </div>
    </div>

    {topPages.length > 0 && (
      <div className="pt-3 border-t border-gray-100">
        <div className="text-xs font-semibold text-gray-500 mb-2">Top Seiten</div>
        <div className="space-y-1">
          {topPages.slice(0, 3).map((page, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 truncate max-w-[70%]" title={page.path}>
                {page.path === '/' ? '/ (Startseite)' : page.path}
              </span>
              <span className="text-gray-400 font-medium">{page.sessions}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// Journey Flow Card
const JourneyFlowCard: React.FC<{
  landingPage: string;
  totalSessions: number;
  conversionRate: number;
  avgSessionDuration: number;
  nextPages: Array<{ path: string; sessions: number; percentage: number }>;
}> = ({ landingPage, totalSessions, conversionRate, avgSessionDuration, nextPages }) => (
  <div className="p-4 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 mb-1">Einstiegsseite</div>
        <div className="font-semibold text-gray-900 truncate" title={landingPage}>
          {landingPage === '/' ? '/ (Startseite)' : landingPage}
        </div>
      </div>
      <div className="text-right ml-4">
        <div className="text-lg font-bold text-purple-600">{totalSessions}</div>
        <div className="text-xs text-gray-500">Sessions</div>
      </div>
    </div>

    <div className="flex items-center gap-4 mb-3 text-xs">
      <div className="flex items-center gap-1">
        <CheckCircleFill className="text-green-500" size={12} />
        <span className="text-gray-600">Conv: </span>
        <span className="font-semibold">{conversionRate.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="text-blue-500" size={12} />
        <span className="text-gray-600">Zeit: </span>
        <span className="font-semibold">{formatDuration(avgSessionDuration)}</span>
      </div>
    </div>

    {nextPages.length > 0 && (
      <div className="pt-3 border-t border-gray-100">
        <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
          <ArrowRight size={10} />
          Nächste Seiten
        </div>
        <div className="space-y-2">
          {nextPages.slice(0, 4).map((page, i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className="h-1.5 rounded-full bg-purple-500"
                style={{ width: `${Math.max(page.percentage, 5)}%` }}
              />
              <span className="text-xs text-gray-600 truncate flex-1" title={page.path}>
                {page.path === '/' ? 'Startseite' : page.path}
              </span>
              <span className="text-xs text-gray-400 font-medium">
                {page.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ============================================================================
// HAUPTKOMPONENTE
// ============================================================================

export default function AiTrafficDetailCardV2({
  data,
  isLoading = false,
  dateRange = '30d',
  className,
  error,
  onRefresh
}: AiTrafficDetailCardV2Props) {
  
  // State
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('sessions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isExpanded, setIsExpanded] = useState(true);

  const formattedDateRange = getDateRangeString(dateRange);

  // Filtered & sorted pages
  const filteredPages = useMemo(() => {
    if (!data?.landingPages) return [];

    let filtered = [...data.landingPages];

    // Filter (not set)
    filtered = filtered.filter(p => 
      p.path !== '(not set)' && p.path !== '(not provided)'
    );

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.path.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Intent filter
    if (selectedIntent) {
      filtered = filtered.filter(p => p.intent.key === selectedIntent);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortField] ?? 0;
      let bVal = b[sortField] ?? 0;
      
      if (sortField === 'bounceRate') {
        aVal = 100 - aVal;
        bVal = 100 - bVal;
      }
      
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return filtered;
  }, [data?.landingPages, searchTerm, selectedIntent, sortField, sortDirection]);

  // Intent Chart Data
  const intentChartData = useMemo(() => {
    if (!data?.intentBreakdown) return [];
    return data.intentBreakdown.map(item => ({
      name: item.intent.label,
      value: item.sessions,
      fill: item.intent.color,
      icon: item.intent.icon
    }));
  }, [data?.intentBreakdown]);

  // Source Chart Data
  const sourceChartData = useMemo(() => {
    if (!data?.sources) return [];
    return data.sources.slice(0, 6).map(s => ({
      name: getSourceLabel(s.source),
      sessions: s.sessions,
      users: s.users,
      fill: getSourceColor(s.source)
    }));
  }, [data?.sources]);

  // Trend Data
  const trendData = useMemo(() => {
    if (!data?.trend) return [];
    return data.trend.map(t => ({
      ...t,
      dateFormatted: format(new Date(t.date), 'dd.MM', { locale: de })
    }));
  }, [data?.trend]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // ========== LOADING ==========
  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden", className)}>
        <div className="p-6 animate-pulse">
          <div className="h-8 bg-gray-100 rounded w-1/3 mb-6" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-50 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-50 rounded-xl" />
        </div>
      </div>
    );
  }

  // ========== ERROR ==========
  if (error) {
    return (
      <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm p-6", className)}>
        <div className="flex flex-col items-center justify-center text-center py-8">
          <ExclamationTriangleFill className="text-red-500 w-12 h-12 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Fehler beim Laden</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <ArrowRepeat size={16} />
              Erneut versuchen
            </button>
          )}
        </div>
      </div>
    );
  }

  // ========== EMPTY ==========
  if (!data || data.totalSessions === 0) {
    return (
      <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm p-6", className)}>
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
            <Cpu className="text-purple-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Keine KI-Traffic Daten</h3>
          <p className="text-sm text-gray-500 max-w-md">
            Im ausgewählten Zeitraum wurden keine Besuche von KI-Plattformen erfasst.
          </p>
        </div>
      </div>
    );
  }

  // ========== MAIN RENDER ==========
  return (
    <div className={cn(
      "bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden",
      className
    )}>
      
      {/* ===== HEADER ===== */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Cpu className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">KI-Traffic Analyse</h2>
              <p className="text-sm text-gray-500">Intent-Kategorisierung & User-Journey</p>
            </div>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs">
          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-semibold">GA4</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500">{formattedDateRange}</span>
          {onRefresh && (
            <>
              <span className="text-gray-400">•</span>
              <button
                onClick={onRefresh}
                className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
              >
                <ArrowRepeat size={12} />
                Aktualisieren
              </button>
            </>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* ===== KPI GRID ===== */}
          <div className="px-6 py-5 bg-gradient-to-b from-gray-50/50 to-white">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100/50">
                <div className="flex items-center gap-2 mb-1">
                  <GraphUpArrow className="text-purple-600" size={16} />
                  <span className="text-xs font-medium text-purple-700">Sessions</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-purple-900">
                    {data.totalSessions.toLocaleString('de-DE')}
                  </span>
                  {data.totalSessionsChange !== undefined && (
                    <span className={cn(
                      "text-xs font-semibold",
                      data.totalSessionsChange >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {data.totalSessionsChange >= 0 ? '+' : ''}{data.totalSessionsChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100/50">
                <div className="flex items-center gap-2 mb-1">
                  <People className="text-indigo-600" size={16} />
                  <span className="text-xs font-medium text-indigo-700">Nutzer</span>
                </div>
                <span className="text-2xl font-bold text-indigo-900">
                  {data.totalUsers.toLocaleString('de-DE')}
                </span>
              </div>

              <div className="bg-teal-50 rounded-xl p-4 border border-teal-100/50">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="text-teal-600" size={16} />
                  <span className="text-xs font-medium text-teal-700">Ø Verweildauer</span>
                </div>
                <span className="text-2xl font-bold text-teal-900">
                  {formatDuration(data.avgEngagementTime)}
                </span>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100/50">
                <div className="flex items-center gap-2 mb-1">
                  <Bullseye className="text-amber-600" size={16} />
                  <span className="text-xs font-medium text-amber-700">Conversions</span>
                </div>
                <span className="text-2xl font-bold text-amber-900">
                  {data.conversions.toLocaleString('de-DE')}
                </span>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100/50">
                <div className="flex items-center gap-2 mb-1">
                  <BarChartFill className="text-blue-600" size={16} />
                  <span className="text-xs font-medium text-blue-700">Ø Seiten/Session</span>
                </div>
                <span className="text-2xl font-bold text-blue-900">
                  {data.userJourney.avgPagesPerSession.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* ===== TABS ===== */}
          <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 overflow-x-auto">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              icon={<BarChartFill size={14} />}
              label="Übersicht"
            />
            <TabButton
              active={activeTab === 'intent'}
              onClick={() => setActiveTab('intent')}
              icon={<Bullseye size={14} />}
              label="Intent-Analyse"
            />
            <TabButton
              active={activeTab === 'journey'}
              onClick={() => setActiveTab('journey')}
              icon={<Diagram3 size={14} />}
              label="User-Journey"
            />
            <TabButton
              active={activeTab === 'pages'}
              onClick={() => setActiveTab('pages')}
              icon={<FileEarmarkText size={14} />}
              label="Alle Seiten"
            />
          </div>

          {/* ===== TAB CONTENT ===== */}
          <div className="px-6 py-5">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Chart */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <GraphUpArrow size={14} className="text-purple-500" />
                    Sessions-Trend
                  </h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="aiDetailGradientV2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="dateFormatted" tick={{ fontSize: 10, fill: '#6b7280' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={40} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="sessions"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          fill="url(#aiDetailGradientV2)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Source Distribution */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Cpu size={14} className="text-purple-500" />
                    KI-Quellen
                  </h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sourceChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#374151' }} width={80} />
                        <Tooltip />
                        <Bar dataKey="sessions" radius={[0, 4, 4, 0]}>
                          {sourceChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Intent Overview */}
                <div className="lg:col-span-2">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Bullseye size={14} className="text-purple-500" />
                    Intent-Verteilung
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {data.intentBreakdown.map((item, i) => (
                      <div 
                        key={i}
                        className="p-3 rounded-lg border border-gray-100 hover:border-purple-200 transition-all cursor-pointer"
                        style={{ borderLeftColor: item.intent.color, borderLeftWidth: '3px' }}
                        onClick={() => {
                          setSelectedIntent(item.intent.key);
                          setActiveTab('pages');
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span>{item.intent.icon}</span>
                          <span className="text-xs font-medium text-gray-700 truncate">{item.intent.label}</span>
                        </div>
                        <div className="text-lg font-bold text-gray-900">{item.sessions}</div>
                        <div className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interaction Events */}
                {data.userJourney.interactionEvents.length > 0 && (
                  <div className="lg:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <HandIndexThumb size={14} className="text-purple-500" />
                      Interaktionen
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {data.userJourney.interactionEvents.slice(0, 10).map((event, i) => (
                        <div 
                          key={i}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-sm"
                        >
                          <span className="font-medium text-gray-700">{event.eventName}</span>
                          <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded-full">
                            {event.count.toLocaleString('de-DE')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INTENT TAB */}
            {activeTab === 'intent' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.intentBreakdown.map((item, i) => (
                  <IntentCard
                    key={i}
                    intent={item.intent}
                    sessions={item.sessions}
                    conversions={item.conversions}
                    conversionRate={item.conversionRate}
                    avgEngagementTime={item.avgEngagementTime}
                    percentage={item.percentage}
                    topPages={item.topPages}
                  />
                ))}
              </div>
            )}

            {/* JOURNEY TAB */}
            {activeTab === 'journey' && (
              <div className="space-y-6">
                {/* Scroll Depth */}
                {(data.userJourney.scrollDepth.reached25 > 0 || data.userJourney.scrollDepth.reached50 > 0) && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Scroll-Tiefe</h3>
                    <div className="flex items-end gap-4 h-24">
                      {[
                        { label: '25%', value: data.userJourney.scrollDepth.reached25 },
                        { label: '50%', value: data.userJourney.scrollDepth.reached50 },
                        { label: '75%', value: data.userJourney.scrollDepth.reached75 },
                        { label: '100%', value: data.userJourney.scrollDepth.reached100 },
                      ].map((item, i) => {
                        const max = Math.max(
                          data.userJourney.scrollDepth.reached25,
                          data.userJourney.scrollDepth.reached50,
                          data.userJourney.scrollDepth.reached75,
                          data.userJourney.scrollDepth.reached100
                        );
                        const height = max > 0 ? (item.value / max) * 100 : 0;
                        
                        return (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1">
                            <div className="text-xs font-semibold text-gray-700">
                              {item.value.toLocaleString('de-DE')}
                            </div>
                            <div 
                              className="w-full bg-purple-500 rounded-t-sm transition-all"
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                            <div className="text-xs text-gray-500">{item.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Top Journeys */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Einstiegsseiten & Folgepfade</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.userJourney.topJourneys.slice(0, 6).map((journey, i) => (
                      <JourneyFlowCard
                        key={i}
                        landingPage={journey.landingPage}
                        totalSessions={journey.totalSessions}
                        conversionRate={journey.conversionRate}
                        avgSessionDuration={journey.avgSessionDuration}
                        nextPages={journey.nextPages}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PAGES TAB */}
            {activeTab === 'pages' && (
              <div>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                    <input
                      type="text"
                      placeholder="Seite suchen..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <XCircleFill size={16} />
                      </button>
                    )}
                  </div>

                  <select
                    value={selectedIntent || ''}
                    onChange={(e) => setSelectedIntent(e.target.value || null)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="">Alle Intents</option>
                    {data.intentBreakdown.map(item => (
                      <option key={item.intent.key} value={item.intent.key}>
                        {item.intent.icon} {item.intent.label} ({item.sessions})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-600">
                        <th className="px-4 py-3 text-left font-semibold">Seite</th>
                        <th className="px-4 py-3 text-left font-semibold">Intent</th>
                        <th 
                          className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-purple-600"
                          onClick={() => handleSort('sessions')}
                        >
                          Sessions {sortField === 'sessions' && (sortDirection === 'desc' ? '↓' : '↑')}
                        </th>
                        <th 
                          className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-purple-600"
                          onClick={() => handleSort('avgEngagementTime')}
                        >
                          Ø Zeit {sortField === 'avgEngagementTime' && (sortDirection === 'desc' ? '↓' : '↑')}
                        </th>
                        <th 
                          className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-purple-600"
                          onClick={() => handleSort('conversions')}
                        >
                          Conv. {sortField === 'conversions' && (sortDirection === 'desc' ? '↓' : '↑')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPages.slice(0, 50).map((page, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-purple-50/50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[300px]" title={page.path}>
                              {page.path === '/' ? '/ (Startseite)' : page.path}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {page.sources.slice(0, 2).map((s, j) => (
                                <span
                                  key={j}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{ 
                                    backgroundColor: `${getSourceColor(s.source)}15`,
                                    color: getSourceColor(s.source)
                                  }}
                                >
                                  {getSourceLabel(s.source)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ 
                                backgroundColor: `${page.intent.color}15`,
                                color: page.intent.color
                              }}
                            >
                              {page.intent.icon} {page.intent.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                            {page.sessions.toLocaleString('de-DE')}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">
                            {formatDuration(page.avgEngagementTime)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={cn(
                              "inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-sm font-semibold",
                              page.conversions > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                            )}>
                              {page.conversions}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {filteredPages.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Keine Ergebnisse gefunden
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ===== FOOTER ===== */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <InfoCircle size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <p>
                <strong>Intent-Kategorisierung:</strong> Seiten werden automatisch anhand ihrer URL-Struktur kategorisiert.
                Die User-Journey zeigt, welche Seiten nach dem KI-Einstieg besucht werden.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
