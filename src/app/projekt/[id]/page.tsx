// src/components/AiTrafficCard.tsx
'use client';

import React from 'react';
// +++ NEU: ExclamationTriangleFill importiert +++
import { Cpu, GraphUp, People, ArrowUp, ArrowDown, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ChartPoint } from '@/types/dashboard'; 

interface AiTrafficCardProps {
  totalSessions: number;
  totalUsers: number;
  percentage?: number;
  
  totalSessionsChange?: number;
  totalUsersChange?: number;
  trend?: ChartPoint[]; 

  topAiSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  isLoading?: boolean;
  dateRange?: string;
  className?: string;
  error?: string | null; // +++ NEU: Prop für Fehlermeldungen +++
}

// (ChangeIndicator bleibt unverändert)
const ChangeIndicator: React.FC<{ change?: number }> = ({ change }) => {
  if (!change) return null;
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
  error = null // +++ NEU: Prop entgegennehmen +++
}: AiTrafficCardProps) {

  // (safe...-Variablen bleiben unverändert)
  const safePercentage = typeof percentage === 'number' && !isNaN(percentage) ? percentage : 0;
  const safeTotalSessions = typeof totalSessions === 'number' && !isNaN(totalSessions) ? totalSessions : 0;
  const safeTotalUsers = typeof totalUsers === 'number' && !isNaN(totalUsers) ? totalUsers : 0;
  const safeTopAiSources = Array.isArray(topAiSources) ? topAiSources : [];
  const safeTrend = Array.isArray(trend) ? trend : [];

  // (rangeLabel bleibt unverändert)
  const rangeLabels: Record<string, string> = {
    '30d': 'Letzte 30 Tage', '3m': 'Letzte 3 Monate',
    '6m': 'Letzte 6 Monate', '12m': 'Letzte 12 Monate',
  };
  const rangeLabel = rangeLabels[dateRange] || 'Letzte 30 Tage';

  // (isLoading-Block bleibt unverändert)
  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-lg shadow-md border border-gray-200 p-6", className)}>
        <div className="animate-pulse">
          {/* ... */}
        </div>
      </div>
    );
  }
  
  // +++ START: MODIFIZIERTE RENDER-LOGIK +++
  return (
    <div className={cn("bg-white rounded-lg shadow-md border border-gray-200 p-6 flex flex-col", className)}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Cpu className="text-purple-600" size={24} />
          <h3 className="text-lg font-semibold text-gray-900">KI-Traffic</h3>
        </div>
        {/* Badge nur anzeigen, wenn kein Fehler vorliegt */}
        {!error && (
          <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
            {safePercentage.toFixed(1)}%
            <span className="hidden sm:inline"> Anteil</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">{rangeLabel}</p>
      
      {/* Prüfen, ob ein Fehler vorliegt */}
      {error ? (
        // Fehler-Zustand anzeigen
        <div className="flex-1 flex flex-col items-center justify-center text-center my-4">
          <ExclamationTriangleFill className="text-red-500 w-8 h-8 mb-3" />
          <p className="text-sm text-red-700 font-semibold">Fehler bei GA4-Daten</p>
          <p className="text-xs text-gray-500 mt-1" title={error}>
            Die KI-Traffic-Daten konnten nicht geladen werden.
          </p>
        </div>
      ) : (
        // Normaler Inhalt, wenn kein Fehler
        <div className="flex flex-col gap-4 flex-1">
          {/* Metriken nebeneinander */}
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
                  // ... (Rendering der Quellen bleibt gleich)
                  const sourcePercentage = typeof source.percentage === 'number' && !isNaN(source.percentage) ? source.percentage : 0;
                  const sourceSessions = typeof source.sessions === 'number' && !isNaN(source.sessions) ? source.sessions : 0;
                  return (
                    <div key={index} className="flex items-center justify-between">
                      {/* ... */}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 italic">Keine KI-Traffic-Daten verfügbar</p>
              )}
            </div>
          </div>

          {/* Trend Chart - volle Breite */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Sitzungs-Trend (KI)</h4>
            {safeTrend.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={safeTrend}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    {/* ... (Chart-Definition bleibt gleich) ... */}
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
      {/* +++ ENDE: MODIFIZIERTE RENDER-LOGIK +++ */}


      {/* Info-Text (bleibt gleich) */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          KI-Traffic umfasst Besuche von bekannten KI-Bots wie ChatGPT, Claude, Perplexity und Google Gemini.
        </p>
      </div>
    </div>
  );
}
