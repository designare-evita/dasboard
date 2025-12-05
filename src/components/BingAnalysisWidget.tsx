// src/components/BingAnalysisWidget.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Search, ArrowUp, ArrowDown, Dash, InfoCircle } from 'react-bootstrap-icons';
import { type DateRangeOption } from '@/components/DateRangeSelector';

interface BingAnalysisWidgetProps {
  bingData: any[];
  domain?: string;
  dateRange: DateRangeOption;
  isLoading?: boolean;
}

export default function BingAnalysisWidget({ 
  bingData, 
  domain, 
  dateRange,
  isLoading = false 
}: BingAnalysisWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="card-glass p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Search className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Bing Webmaster Tools</h3>
              <p className="text-xs text-gray-500">Laden...</p>
            </div>
          </div>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!bingData || bingData.length === 0) {
    return (
      <div className="card-glass p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Search className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Bing Webmaster Tools</h3>
              <p className="text-xs text-gray-500">Letzte 3 Monate</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <Search className="text-blue-300 mx-auto mb-3" size={32} />
          <p className="text-sm font-medium text-blue-900 mb-2">
            Keine Bing-Daten verfügbar
          </p>
          <p className="text-xs text-blue-700">
            Die Bing Webmaster Tools API konnte keine Daten abrufen.
          </p>
          <p className="text-xs text-blue-600 mt-2">
            Mögliche Gründe: Keine Bing-Konfiguration, keine Daten vorhanden, oder API-Fehler.
          </p>
        </div>
      </div>
    );
  }

  // Berechne Gesamtstatistiken
  const totalClicks = bingData.reduce((sum, item) => sum + (item.clicks || 0), 0);
  const totalImpressions = bingData.reduce((sum, item) => sum + (item.impressions || 0), 0);
  const avgPosition = bingData.reduce((sum, item) => sum + (item.position || 0), 0) / bingData.length;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Sortiere nach Impressionen für Top Keywords
  const topKeywords = [...bingData]
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, isExpanded ? 20 : 5);

  const getPositionColor = (position: number) => {
    if (position <= 3) return 'text-green-600 bg-green-50';
    if (position <= 10) return 'text-blue-600 bg-blue-50';
    if (position <= 20) return 'text-orange-600 bg-orange-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="card-glass p-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Search className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Bing Webmaster Tools</h3>
            <p className="text-xs text-gray-500">
              {domain ? `${domain} • ` : ''}Letzte 3 Monate
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {isExpanded ? (
            <>
              Weniger <ChevronUp size={16} />
            </>
          ) : (
            <>
              Mehr anzeigen <ChevronDown size={16} />
            </>
          )}
        </button>
      </div>

      {/* ✅ NEU: Hinweis zur API-Limitation */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
        <InfoCircle className="text-amber-600 flex-shrink-0" size={16} />
        <p className="text-xs text-amber-800">
          Die Bing API liefert aggregierte Daten der letzten 3 Monate. Der gewählte Zeitraum hat keinen Einfluss auf diese Ansicht.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="text-xs font-medium text-blue-600 mb-1">Keywords</div>
          <div className="text-2xl font-bold text-blue-900">{bingData.length}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="text-xs font-medium text-green-600 mb-1">Klicks</div>
          <div className="text-2xl font-bold text-green-900">{totalClicks.toLocaleString('de-DE')}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="text-xs font-medium text-purple-600 mb-1">Impressionen</div>
          <div className="text-2xl font-bold text-purple-900">{totalImpressions.toLocaleString('de-DE')}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
          <div className="text-xs font-medium text-orange-600 mb-1">Ø CTR</div>
          <div className="text-2xl font-bold text-orange-900">{avgCtr.toFixed(2)}%</div>
        </div>
      </div>

      {/* Keywords Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Keyword
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Position
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Klicks
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Impressionen
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                CTR
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {topKeywords.map((keyword, index) => {
              const ctr = keyword.impressions > 0 
                ? ((keyword.clicks / keyword.impressions) * 100).toFixed(2) 
                : '0.00';
              
              return (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-900 font-medium">
                        {keyword.query || keyword.keyword}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getPositionColor(keyword.position || 0)}`}>
                      #{Math.round(keyword.position || 0)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {(keyword.clicks || 0).toLocaleString('de-DE')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm text-gray-600">
                      {(keyword.impressions || 0).toLocaleString('de-DE')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {ctr}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Ø Position: <span className="font-semibold text-gray-700">#{avgPosition.toFixed(1)}</span></span>
          <span>Zeige {topKeywords.length} von {bingData.length} Keywords</span>
        </div>
      </div>
    </div>
  );
}
