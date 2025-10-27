// src/components/SemrushConfiguration.tsx
'use client';

import { useState, useEffect } from 'react';
import { Pencil, Check, X, Database } from 'react-bootstrap-icons';

interface SemrushConfigData {
  semrushProjectId: string | null;
  semrushTrackingId: string | null;
  lastUpdated: string | null;
}

interface SemrushConfigurationProps {
  projectId?: string;
  isAdmin?: boolean;
}

export default function SemrushConfiguration({ projectId, isAdmin = false }: SemrushConfigurationProps) {
  const [config, setConfig] = useState<SemrushConfigData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Temporäre Werte während des Editierens
  const [tempProjectId, setTempProjectId] = useState('');
  const [tempTrackingId, setTempTrackingId] = useState('');

  // Lade aktuelle Konfiguration
  useEffect(() => {
    fetchConfig();
  }, [projectId]);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const url = projectId 
        ? `/api/semrush/config?projectId=${projectId}`
        : '/api/semrush/config';
      
      const response = await fetch(url);
      const data = await response.json();
      
      setConfig(data);
      setTempProjectId(data.semrushProjectId || '');
      setTempTrackingId(data.semrushTrackingId || '');
    } catch (err) {
      console.error('Error fetching Semrush config:', err);
      setError('Fehler beim Laden der Konfiguration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const url = projectId 
        ? `/api/semrush/config?projectId=${projectId}`
        : '/api/semrush/config';

      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semrushProjectId: tempProjectId || null,
          semrushTrackingId: tempTrackingId || null
        })
      });

      if (!response.ok) {
        throw new Error('Fehler beim Speichern');
      }

      const updatedConfig = await response.json();
      setConfig(updatedConfig);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving Semrush config:', err);
      setError('Fehler beim Speichern der Konfiguration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTempProjectId(config?.semrushProjectId || '');
    setTempTrackingId(config?.semrushTrackingId || '');
    setIsEditing(false);
    setError(null);
  };

  // Formatiere Zeitstempel
  const formatLastUpdated = (dateString: string | null): string => {
    if (!dateString) return 'Nie konfiguriert';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays === 0) {
      if (diffHours === 0) {
        return 'Gerade eben aktualisiert';
      } else {
        return `Vor ${diffHours}h aktualisiert`;
      }
    } else if (diffDays === 1) {
      return 'Gestern aktualisiert';
    } else if (diffDays < 30) {
      return `Vor ${diffDays} Tagen aktualisiert`;
    } else {
      return date.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-10 bg-gray-200 rounded mb-3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Database size={20} className="text-orange-600" />
            Semrush Konfiguration
          </h3>
          {config?.lastUpdated && !isEditing && (
            <div className="mt-2 text-xs text-gray-500 flex flex-col gap-1">
              <span>{formatLastUpdated(config.lastUpdated)}</span>
              <span className="text-[10px] text-gray-400">
                {new Date(config.lastUpdated).toLocaleString('de-DE')}
              </span>
            </div>
          )}
        </div>

        {/* Edit Button - nur für Admins oder eigenes Profil */}
        {!isEditing && (isAdmin || !projectId) && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-50 text-orange-700 rounded hover:bg-orange-100 transition-colors"
          >
            <Pencil size={14} />
            Bearbeiten
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {/* Semrush Project ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Semrush Project ID
          </label>
          {isEditing ? (
            <input
              type="text"
              value={tempProjectId}
              onChange={(e) => setTempProjectId(e.target.value)}
              placeholder="z.B. 12920575"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          ) : (
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
              {config?.semrushProjectId || (
                <span className="text-gray-400 italic">Nicht konfiguriert</span>
              )}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Die Project ID finden Sie in Semrush unter "Position Tracking" → Projekt auswählen → URL enthält die ID
          </p>
        </div>

        {/* Semrush Tracking ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Semrush Tracking ID
          </label>
          {isEditing ? (
            <input
              type="text"
              value={tempTrackingId}
              onChange={(e) => setTempTrackingId(e.target.value)}
              placeholder="z.B. abc123def456"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          ) : (
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
              {config?.semrushTrackingId || (
                <span className="text-gray-400 italic">Nicht konfiguriert</span>
              )}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Optional: Tracking ID für spezifische Kampagnen oder erweiterte Features
          </p>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>Speichern...</>
              ) : (
                <>
                  <Check size={16} />
                  Speichern
                </>
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              <X size={16} />
              Abbrechen
            </button>
          </div>
        )}
      </div>

      {/* Info Box */}
      {!isEditing && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            💡 Diese Werte werden verwendet um Daten von Semrush zu laden. Änderungen werden nach dem Speichern sofort aktiv.
          </p>
        </div>
      )}
    </div>
  );
}
