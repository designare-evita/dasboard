// src/components/SemrushConfigDisplay.tsx
'use client';

import { useState, useEffect } from 'react';
import { Database, CheckCircleFill, ExclamationCircleFill } from 'react-bootstrap-icons';

interface SemrushConfigData {
  semrushProjectId: string | null;
  semrushTrackingId: string | null;
  lastUpdated: string | null;
}

interface SemrushConfigDisplayProps {
  projectId?: string;
}

export default function SemrushConfigDisplay({ projectId }: SemrushConfigDisplayProps) {
  const [config, setConfig] = useState<SemrushConfigData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        const url = projectId 
          ? `/api/semrush/config?projectId=${projectId}`
          : '/api/semrush/config';
        
        const response = await fetch(url);
        const data = await response.json();
        
        setConfig(data);
      } catch (err) {
        console.error('Error fetching Semrush config:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [projectId]);

  // Formatiere Zeitstempel
  const formatLastUpdated = (dateString: string | null): string => {
    if (!dateString) return 'Nie';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays === 0) {
      if (diffHours === 0) {
        return 'Gerade eben';
      } else {
        return `Heute (vor ${diffHours}h)`;
      }
    } else if (diffDays === 1) {
      return 'Gestern';
    } else if (diffDays < 30) {
      return `vor ${diffDays} Tagen`;
    } else {
      return date.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
  };

  // Prüfe ob konfiguriert
  const isConfigured = config?.semrushProjectId || config?.semrushTrackingId;

  if (isLoading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Database size={18} className="text-orange-600" />
            Semrush Konfiguration
          </h3>
        </div>
        
        {/* Status Badge */}
        {isConfigured ? (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
            <CheckCircleFill size={12} />
            Konfiguriert
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded">
            <ExclamationCircleFill size={12} />
            Nicht konfiguriert
          </span>
        )}
      </div>

      {/* Config Details */}
      <div className="space-y-2 text-sm">
        {/* Project ID */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Project ID:</span>
          <span className="font-medium text-gray-900">
            {config?.semrushProjectId || (
              <span className="text-gray-400 italic">–</span>
            )}
          </span>
        </div>

        {/* Tracking ID */}
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Tracking ID:</span>
          <span className="font-medium text-gray-900">
            {config?.semrushTrackingId || (
              <span className="text-gray-400 italic">–</span>
            )}
          </span>
        </div>
      </div>

      {/* Zeitstempel */}
      {config?.lastUpdated && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 flex flex-col gap-0.5">
            <span>Zuletzt geändert: {formatLastUpdated(config.lastUpdated)}</span>
            <span className="text-[10px] text-gray-400">
              {new Date(config.lastUpdated).toLocaleString('de-DE')}
            </span>
          </div>
        </div>
      )}

      {/* Hinweis wenn nicht konfiguriert */}
      {!isConfigured && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            💡 Konfigurieren Sie Semrush in den Projekteinstellungen
          </p>
        </div>
      )}
    </div>
  );
}
