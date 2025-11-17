// src/components/AiTrafficCard.tsx
'use client';

import React from 'react';
import { Cpu, GraphUp, People, ArrowUp, ArrowDown, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// --- KORREKTUR 1: Importiere AiTrafficCardProps von der Typen-Datei ---
import type { AiTrafficCardProps } from '@/types/ai-traffic';
// (ChartPoint-Import wird nicht mehr direkt hier benötigt, da es in AiTrafficCardProps enthalten ist)

// (ChangeIndicator Hilfskomponente bleibt unverändert)
const ChangeIndicator: React.FC<{ change?: number }> = ({ change }) => {
  if (!change) {
    return null;
  }
  const isPositive = change >= 0;
  const color = isPositive ? 'text-green-600' : 'text-red-600';
  const Icon = isPositive ? ArrowUp : ArrowDown;

  return (
    <span className={cn('flex items-center text-xs font-medium ml-2', color)}>
      <Icon className="mr-0.5" size={12} />
      {Math.abs(change).toFixed(1)}%
    </span>
  );
};

// --- KORREKTUR 2: Lokales Interface entfernt ---
// interface AiTrafficCardProps { ... } // <--- WURDE ENTFERNT

export default function AiTrafficCard({
  totalSessions = 0,
  totalUsers = 0,
  percentage = 0,
  totalSessionsChange,
  totalUsersChange,
  trend = [],
  topAiSources = [],
  isLoading = false,
  dateRange = '30d',
  className,
  error = null // Fehler-Prop (aus vorheriger Korrektur)
}: AiTrafficCardProps) { // <-- Verwendet jetzt den importierten Typ

  // (Rest der Logik bleibt 1:1 gleich)
  const safePercentage = typeof percentage === 'number' && !isNaN(percentage) ? percentage : 0;
  const safeTotalSessions = typeof totalSessions === 'number' && !isNaN(totalSessions) ? totalSessions : 0;
  const safeTotalUsers = typeof totalUsers === 'number' && !isNaN(totalUsers) ? totalUsers : 0;
  const safeTopAiSources = Array.isArray(topAiSources) ? topAiSources : [];
  const safeTrend = Array.isArray(trend) ? trend : [];

  const rangeLabels: Record<string, string> = {
    '30d': 'Letzte 30 Tage',
    '3m': 'Letzte 3 Monate',
    '6m': 'Letzte 6 Monate',
    '12m': 'Letzte 12 Monate',
  };
  const rangeLabel = rangeLabels[dateRange] || 'Letzte 30 Tage';

  // (Ladezustand-JSX bleibt unverändert)
  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-lg shadow-md border border-gray-200 p-6", className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // --- Layout (Fehlerbehandlung aus vorherigem Schritt bleibt erhalten) ---
  return (
    <div className={cn("bg-white rounded-lg shadow-md border border-gray-200 p-6 flex flex-col", className)}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Cpu className="text-purple-600" size={24} />
          <h3 className="text-lg font-semibold text-gray-900">KI-Traffic</h3>
        </div>
        {!error && (
          <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
            {safePercentage.toFixed(1)}%
            <span className="hidden sm:inline"> Anteil</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">{rangeLabel}</p>

      {/* Fehler-Zustand */}
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center my-4">
          <ExclamationTriangleFill className="text-red-500 w-8 h-8 mb-3" />
          <p className="text-sm text-red-700 font-semibold">Fehler bei GA4-Daten</p>
          <p className="text-xs text-gray-500 mt-1" title={error}>
            Die KI-Traffic-Daten konnten nicht geladen werden.
          </p>
        </div>
      ) : (
        // Normaler Inhalt
        <div className="flex flex-col gap-4 flex-1">
          
          {/* Metriken */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <GraphUp size={16} className="text-purple-600" />
                <p className="text-sm text-purple-700 font-medium">Sitzungen</p>
              </div>
              <div className="flex items-baseline">
                <p className="text-2xl font-bold text-purple-900">
                  {safeTotalSessions.toLocaleString('de-DE')}
                </p>
                <ChangeIndicator change={totalSessionsChange} />
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <People size={16} className="text-purple-600" />
                <p className="text-sm text-purple-700 font-medium">Nutzer</p>
              </div>
              <div className="flex items-baseline">
                <p className="text-2xl font-bold text-purple-900">
                  {safeTotalUsers.toLocaleString('de-DE')}
                </p>
                <ChangeIndicator change={totalUsersChange} />
              </div>
            </div>
          </div>
        
          {/* Top KI-Quellen */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Top KI-Quellen</h4>
            <div className="space-y-2">
              {safeTopAiSources.length > 0 ? (
                safeTopAiSources.map((source, index) => {
                  const sourcePercentage = typeof source.percentage === 'number' && !isNaN(source.percentage) ? source.percentage : 0;
                  const sourceSessions = typeof source.sessions === 'number' && !isNaN(source.sessions) ? source.sessions : 0;

                  return (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0"> 
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          index === 0 ? 'bg-purple-600' :
                          index === 1 ? 'bg-purple-500' :
                          index === 2 ? 'bg-purple-400' :
                          'bg-purple-300'
                        }`}></div>
                        <span className="text-sm text-gray-700 truncate">{source.source || 'Unbekannt'}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-medium text-gray-900">
                          {sourceSessions.toLocaleString('de-DE')}
                        </span>
                        <span className="text-xs text-gray-500 min-w-[3rem] text-right">
                          {sourcePercentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 italic">Keine KI-Traffic-Daten verfügbar</p>
              )}
            </div>
          </div>

          {/* Trend Chart */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Sitzungs-Trend (KI)</h4>
            {safeTrend.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={safeTrend}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                      }}
                      minTickGap={30}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      width={35}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                      labelFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
                      }}
                      // (Der Formatter ist korrekt, da er 'value' von ChartPoint erwartet)
                      formatter={(value: number) => [value.toLocaleString('de-DE'), 'Sitzungen']}
                    />
                    <Area
                      type="monotone"
                      // (dataKey="value" ist korrekt, da ProjectDashboard die Daten mappt)
                      dataKey="value"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#aiGradient)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-xs text-gray-400 italic border border-dashed border-gray-200 rounded">
                Keine Trenddaten verfügbar
              </div>
            )}
          </div>
        
        </div>
      )} 
        
      {/* Info-Text */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          KI-Traffic umfasst Besuche von bekannten KI-Bots wie ChatGPT, Claude, Perplexity und Google Gemini.
        </p>
      </div>
    </div>
  );
}
