// src/components/AiTrafficCard.tsx
'use client';

import React from 'react';
import { Cpu, TrendingUp, People } from 'react-bootstrap-icons';

interface AiTrafficCardProps {
  totalSessions: number;
  totalUsers: number;
  percentage: number;
  topSources: Array<{
    source: string;
    sessions: number;
    users: number;
    percentage: number;
  }>;
  isLoading?: boolean;
}

export default function AiTrafficCard({ 
  totalSessions = 0, 
  totalUsers = 0, 
  percentage = 0, 
  topSources = [],
  isLoading = false 
}: AiTrafficCardProps) {
  // Sichere Werte mit Fallbacks
  const safePercentage = typeof percentage === 'number' && !isNaN(percentage) ? percentage : 0;
  const safeTotalSessions = typeof totalSessions === 'number' && !isNaN(totalSessions) ? totalSessions : 0;
  const safeTotalUsers = typeof totalUsers === 'number' && !isNaN(totalUsers) ? totalUsers : 0;
  const safeTopSources = Array.isArray(topSources) ? topSources : [];

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
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

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="text-purple-600" size={24} />
          <h3 className="text-lg font-semibold text-gray-900">KI-Traffic</h3>
        </div>
        <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
          {safePercentage.toFixed(1)}%
        </div>
      </div>

      {/* Haupt-Metriken */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-purple-600" />
            <p className="text-sm text-purple-700 font-medium">Sitzungen</p>
          </div>
          <p className="text-2xl font-bold text-purple-900">
            {safeTotalSessions.toLocaleString('de-DE')}
          </p>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <People size={16} className="text-purple-600" />
            <p className="text-sm text-purple-700 font-medium">Nutzer</p>
          </div>
          <p className="text-2xl font-bold text-purple-900">
            {safeTotalUsers.toLocaleString('de-DE')}
          </p>
        </div>
      </div>

      {/* Top KI-Quellen */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Top KI-Quellen</h4>
        <div className="space-y-2">
          {safeTopSources.length > 0 ? (
            safeTopSources.map((source, index) => {
              const sourcePercentage = typeof source.percentage === 'number' && !isNaN(source.percentage) 
                ? source.percentage 
                : 0;
              const sourceSessions = typeof source.sessions === 'number' && !isNaN(source.sessions)
                ? source.sessions
                : 0;
              
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-2 h-2 rounded-full ${
                      index === 0 ? 'bg-purple-600' :
                      index === 1 ? 'bg-purple-500' :
                      index === 2 ? 'bg-purple-400' :
                      'bg-purple-300'
                    }`}></div>
                    <span className="text-sm text-gray-700 truncate">{source.source || 'Unbekannt'}</span>
                  </div>
                  <div className="flex items-center gap-3">
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

      {/* Info-Text */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          KI-Traffic umfasst Besuche von bekannten KI-Bots wie ChatGPT, Claude, Perplexity und Google Gemini.
        </p>
      </div>
    </div>
  );
}
