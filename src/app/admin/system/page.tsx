// src/app/admin/system/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { 
  Server, 
  HddNetwork, 
  DatabaseCheck, 
  ShieldLock, 
  ArrowRepeat, 
  Trash,
  CheckCircleFill,
  XCircleFill,
  ExclamationTriangleFill
} from 'react-bootstrap-icons';

export default function SystemHealthPage() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Daten laden
  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/system-status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Handler: Cache leeren
  const handleClearCache = async () => {
    if(!confirm("Sind Sie sicher? Das löscht ALLE gespeicherten Google-Daten. Der nächste Ladevorgang wird länger dauern.")) return;
    
    setIsClearingCache(true);
    try {
      const res = await fetch('/api/clear-cache', { method: 'POST' }); // Existierende Route nutzen
      if (res.ok) {
        alert("Cache erfolgreich geleert!");
        fetchStatus(); // Aktualisieren
      } else {
        alert("Fehler beim Leeren des Caches.");
      }
    } catch (e) {
      alert("Netzwerkfehler.");
    } finally {
      setIsClearingCache(false);
    }
  };

  // Helper für Status-Badges
  const StatusBadge = ({ state, text }: { state: string, text: string }) => {
    if (state === 'ok') return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100"><CheckCircleFill/> {text}</span>;
    if (state === 'warning') return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100"><ExclamationTriangleFill/> {text}</span>;
    return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-100"><XCircleFill/> {text || 'Fehler'}</span>;
  };

  if (isLoading && !status) {
    return <div className="p-10 text-center text-gray-500">Lade Systemdiagnose...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <ShieldLock className="text-indigo-600" />
              System Kontrollzentrum
            </h1>
            <p className="text-gray-500 mt-1">Technische Überwachung und Wartung für Superadmins.</p>
          </div>
          <button 
            onClick={fetchStatus}
            className="p-2 text-gray-500 hover:text-indigo-600 transition-colors"
            title="Aktualisieren"
          >
            <ArrowRepeat size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* 1. DATENBANK STATUS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <DatabaseCheck size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Datenbank</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">Verbindung (Vercel Postgres)</span>
                <StatusBadge state={status?.database?.status} text={status?.database?.status === 'ok' ? 'Verbunden' : 'Fehler'} />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">Latenz (Ping)</span>
                <span className="text-sm font-mono text-gray-900">{status?.database?.latency} ms</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{status?.database?.message}</p>
            </div>
          </div>

          {/* 2. API STATUS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                <HddNetwork size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Externe APIs</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">Google Services API</span>
                <StatusBadge state={status?.google?.status} text={status?.google?.status === 'ok' ? 'Bereit' : 'Fehler'} />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">Semrush API</span>
                <StatusBadge state={status?.semrush?.status} text={status?.semrush?.status === 'ok' ? 'Konfiguriert' : 'Prüfen'} />
              </div>
            </div>
          </div>

          {/* 3. CACHE CONTROL */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <Server size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Cache Verwaltung</h3>
                <p className="text-xs text-gray-500">Steuert den Zwischenspeicher für Google & Semrush Daten.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="mb-4 sm:mb-0">
                <div className="text-sm font-medium text-gray-900">Aktueller Cache Status</div>
                <div className="text-xs text-gray-500 mt-1">
                  Gespeicherte Datensätze: <span className="font-bold text-indigo-600">{status?.cache?.count}</span>
                </div>
              </div>

              <button 
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {isClearingCache ? <ArrowRepeat className="animate-spin" /> : <Trash />}
                System-Cache komplett leeren
              </button>
            </div>
            
            <div className="mt-3 text-[10px] text-gray-400">
              * Hinweis: Das Leeren des Caches zwingt das System, beim nächsten User-Login alle Daten frisch von den APIs abzurufen. Dies kann zu längeren Ladezeiten führen.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
