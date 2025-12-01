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
  HddNetwork
} from 'react-bootstrap-icons';
// ✅ NEU: Import des Login Protokolls
import LoginLogbook from '@/app/admin/LoginLogbook';

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
      const res = await fetch('/api/clear-cache', { method: 'POST' }); 
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
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <ArrowRepeat className="animate-spin text-indigo-600" size={32} />
          <p className="text-gray-500 font-medium">Lade Systemdiagnose...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <ShieldLock className="text-indigo-600" />
              System Kontrollzentrum
            </h1>
            <p className="text-gray-500 mt-1">Technische Überwachung und Wartung für Superadmins.</p>
          </div>
          <button 
            onClick={fetchStatus}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
            title="Daten neu laden"
          >
            <ArrowRepeat size={18} />
            <span className="text-sm font-medium">Aktualisieren</span>
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* SPALTE LINKS: TECHNISCHE KONTROLLEN */}
          <div className="xl:col-span-2 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. DATENBANK STATUS */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <DatabaseCheck size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Datenbank</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-600">Verbindung (Postgres)</span>
                    <StatusBadge state={status?.database?.status} text={status?.database?.status === 'ok' ? 'Verbunden' : 'Fehler'} />
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-600">Latenz (Ping)</span>
                    <span className="text-sm font-mono text-gray-900">{status?.database?.latency} ms</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 h-4">{status?.database?.message}</p>
                </div>
              </div>

              {/* 2. API STATUS */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
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
                  <p className="text-xs text-gray-400 mt-1 h-4"></p>
                </div>
              </div>
            </div>

            {/* 3. CACHE CONTROL (Volle Breite) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                  <ArrowRepeat size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">Cache Verwaltung</h3>
                  <p className="text-xs text-gray-500">Steuert den Zwischenspeicher für API-Daten (Performance).</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-100 gap-4">
                <div className="w-full sm:w-auto">
                  <div className="text-sm font-medium text-gray-900">Aktueller Status</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Gespeicherte Datensätze: <span className="font-bold text-indigo-600 text-base ml-1">{status?.cache?.count}</span>
                  </div>
                </div>

                <button 
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
                >
                  {isClearingCache ? <ArrowRepeat className="animate-spin" /> : <Trash />}
                  System-Cache komplett leeren
                </button>
              </div>
              
              <div className="mt-3 text-[10px] text-gray-400 italic">
                * Hinweis: Das Leeren des Caches zwingt das System, beim nächsten User-Login alle Daten frisch von den APIs abzurufen.
              </div>
            </div>

          </div>

          {/* SPALTE RECHTS: LOGIN PROTOKOLL */}
          <div className="xl:col-span-1">
             {/* ✅ HIER: Integration des Login Protokolls */}
             {/* Wir entfernen das margin-top (mt-8) aus der Komponente per CSS oder Wrapper, falls möglich, 
                 oder akzeptieren es. Da LoginLogbook 'mt-8' hat, und wir es hier bündig wollen, 
                 können wir es in einen Container packen, der das Margin "schluckt" oder wir passen LoginLogbook an.
                 Hier nutzen wir es direkt, da 'mt-8' als Abstand in der Spalte okay ist, aber besser wäre ohne.
                 
                 Tipp: Wenn du LoginLogbook.tsx bearbeiten kannst, entferne 'mt-8'. 
                 Wenn nicht, ist es hier auch okay.
             */}
             <div className="-mt-8 xl:mt-0"> 
               <LoginLogbook />
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
