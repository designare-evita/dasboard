// src/app/admin/system/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { 
  DatabaseCheck, 
  ShieldLock, 
  ArrowRepeat, 
  Trash,
  CheckCircleFill,
  XCircleFill,
  ExclamationTriangleFill,
  HddNetwork,
  ClockHistory // <--- ✅ NEU: Importieren
} from 'react-bootstrap-icons';
import LoginLogbook from '@/app/admin/LoginLogbook';

export default function SystemHealthPage() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingCache, setIsClearingCache] = useState(false);

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

  const handleClearCache = async () => {
    if(!confirm("Sind Sie sicher? Das löscht ALLE gespeicherten Google-Daten.")) return;
    setIsClearingCache(true);
    try {
      await fetch('/api/clear-cache', { method: 'POST' });
      alert("Cache geleert. Bitte Seite neu laden.");
      window.location.reload();
    } catch (e) {
      alert("Fehler beim Leeren des Caches");
    } finally {
      setIsClearingCache(false);
    }
  };

  // Hilfsfunktion für Status-Icons
  const getStatusIcon = (s: string) => {
    if (s === 'ok') return <CheckCircleFill className="text-emerald-500 text-xl" />;
    if (s === 'warning') return <ExclamationTriangleFill className="text-amber-500 text-xl" />;
    return <XCircleFill className="text-red-500 text-xl" />;
  };

  if (isLoading) return <div className="p-10 text-center">System Check läuft...</div>;
  if (!status) return <div className="p-10 text-center text-red-500">Fehler beim Laden des Status.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      
      <div>
        <h1 className="text-2xl font-bold mb-2">System Kontrollzentrum</h1>
        <p className="text-gray-500">Überwachung der Datenbank, API-Verbindungen und System-Prozesse.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* SPALTE LINKS: STATUS KARTEN */}
        <div className="xl:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. Datenbank Karte */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <DatabaseCheck className="text-blue-600 text-xl" />
                </div>
                {getStatusIcon(status.database.status)}
              </div>
              <h3 className="font-semibold text-gray-900">Datenbank</h3>
              <p className="text-sm text-gray-500 mt-1">{status.database.message}</p>
              {status.database.latency > 0 && (
                <div className="mt-3 text-xs font-mono text-gray-400">
                  Latenz: {status.database.latency}ms
                </div>
              )}
            </div>

            {/* 2. Google API Karte */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <ShieldLock className="text-orange-600 text-xl" />
                </div>
                {getStatusIcon(status.google.status)}
              </div>
              <h3 className="font-semibold text-gray-900">Google API Auth</h3>
              <p className="text-sm text-gray-500 mt-1">{status.google.message}</p>
            </div>

            {/* 3. Semrush Karte */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <HddNetwork className="text-purple-600 text-xl" />
                </div>
                {getStatusIcon(status.semrush.status)}
              </div>
              <h3 className="font-semibold text-gray-900">Semrush API</h3>
              <p className="text-sm text-gray-500 mt-1">{status.semrush.message}</p>
            </div>

            {/* ✅ 4. NEU: Cron Job / GSC Update Karte */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-teal-50 rounded-lg">
                  <ClockHistory className="text-teal-600 text-xl" />
                </div>
                {getStatusIcon(status.cron?.status || 'warning')}
              </div>
              <h3 className="font-semibold text-gray-900">GSC Auto-Update</h3>
              <p className="text-sm text-gray-500 mt-1">
                {status.cron?.message || 'Status unbekannt'}
              </p>
              {status.cron?.lastRun && (
                <div className="mt-3 text-xs font-mono text-gray-400">
                  Zuletzt: {new Date(status.cron.lastRun).toLocaleString('de-DE')}
                </div>
              )}
            </div>

          </div>

          {/* CACHE MANAGEMENT SECTION */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gray-100 rounded-lg">
                <ArrowRepeat className="text-gray-600" />
              </div>
              <h3 className="font-semibold">Cache Management</h3>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <span className="text-sm text-gray-600 font-medium">Aktuelle Cache-Einträge:</span>
                <span className="ml-2 text-lg font-bold text-gray-900">{status.cache.count}</span>
              </div>
              
              <button 
                onClick={handleClearCache}
                disabled={isClearingCache}
                className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {isClearingCache ? <ArrowRepeat className="animate-spin" /> : <Trash />}
                System-Cache leeren
              </button>
            </div>
            
            <div className="mt-3 text-[10px] text-gray-400 italic">
              * Hinweis: Das Leeren des Caches zwingt das System, beim nächsten User-Login alle Daten frisch von den APIs abzurufen.
            </div>
          </div>

        </div>

        {/* SPALTE RECHTS: LOGIN PROTOKOLL */}
        <div className="xl:col-span-1">
           <div className="-mt-8 xl:mt-0"> 
             <LoginLogbook />
           </div>
        </div>

      </div>
    </div>
  );
}
