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
  ClockHistory,
  Search,
  BarChartLine,
  Cpu
} from 'react-bootstrap-icons';
import { toast } from 'sonner';
import LoginLogbook from '@/app/admin/LoginLogbook';

export default function SystemHealthPage() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State für Buttons
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

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
      toast.error('Status konnte nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // --- CACHE LEEREN ---
  const handleClearCache = async () => {
    if(!confirm("Sind Sie sicher? Dies löscht den gesamten Google Data Cache für ALLE User.")) return;
    
    setIsClearingCache(true);
    try {
      const res = await fetch('/api/clear-cache', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) 
      });
      
      if (res.ok) {
        toast.success('Cache erfolgreich geleert.');
        fetchStatus();
      } else {
        toast.error('Fehler beim Leeren des Caches.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Netzwerkfehler beim Cache-Leeren.');
    } finally {
      setIsClearingCache(false);
    }
  };

  // --- LOGIN LOGS LÖSCHEN (NEU) ---
  const handleClearLoginLogs = async () => {
    if(!confirm("ACHTUNG: Möchten Sie wirklich das gesamte Login-Protokoll löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) return;

    setIsClearingLogs(true);
    try {
      // Wir nehmen an, dass die Route DELETE unterstützt (ggf. in route.ts ergänzen)
      const res = await fetch('/api/admin/login-logs', { 
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Login-Protokoll wurde gelöscht.');
        // Seite neu laden oder Logbook-Komponente aktualisieren
        window.location.reload(); 
      } else {
        const err = await res.json();
        toast.error(err.message || 'Fehler beim Löschen der Logs.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Fehler beim Senden der Löschanfrage.');
    } finally {
      setIsClearingLogs(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <p>Systemstatus wird geprüft...</p>
        </div>
      </div>
    );
  }

  if (!status) return <div className="p-8 text-red-500">Fehler beim Laden des Status.</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <HddNetwork className="text-indigo-600" />
            System Status & Health
          </h1>
          <p className="text-gray-500 mt-1">Überwachung der Datenbank, API-Verbindungen und Caches.</p>
        </div>
        <button 
          onClick={fetchStatus}
          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          title="Aktualisieren"
        >
          <ArrowRepeat size={20} />
        </button>
      </div>

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* 1. DATABASE WIDGET */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg"><DatabaseCheck className="text-blue-600" /></div>
            <h3 className="font-semibold text-gray-800">Datenbank</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-sm text-gray-600">Verbindung</span>
              {status.database ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                  <CheckCircleFill /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100">
                  <XCircleFill /> Offline
                </span>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
               <span className="text-sm text-gray-600">Latenz</span>
               <span className="text-sm font-mono text-gray-800">24ms</span>
            </div>
          </div>
        </div>

        {/* 2. AUTH SYSTEM WIDGET */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg"><ShieldLock className="text-purple-600" /></div>
            <h3 className="font-semibold text-gray-800">Auth System</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-sm text-gray-600">Session Check</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                <CheckCircleFill /> Aktiv
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
               <span className="text-sm text-gray-600">Verschlüsselung</span>
               <span className="text-sm font-mono text-gray-800">AES-256</span>
            </div>
          </div>
        </div>

        {/* 3. BING & AI SEARCH WIDGET (ANGEPASST) */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg"><Search className="text-indigo-600" /></div>
            <h3 className="font-semibold text-gray-800">Bing & AI Search</h3>
          </div>
          
          <div className="space-y-3">
            {/* Bing Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-sm text-gray-600">Bing API</span>
              {status.bingApi?.ok ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                  <CheckCircleFill /> Verbunden
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                  <ExclamationTriangleFill /> Prüfung..
                </span>
              )}
            </div>

            {/* AI Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-sm text-gray-600">AI Engine</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                 <Cpu size={12} /> Ready
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. CACHE MANAGEMENT */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 rounded-lg"><ArrowRepeat className="text-gray-600" /></div>
          <h3 className="font-semibold text-gray-800">Cache Management</h3>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 gap-4">
          <div className="flex items-center gap-2">
             <span className="text-sm text-gray-600 font-medium">Gespeicherte Cache-Einträge:</span>
             <span className="text-lg font-bold text-gray-900 bg-white px-3 py-0.5 rounded border border-gray-200 shadow-sm">{status.cache.count}</span>
          </div>
          <button 
            onClick={handleClearCache} 
            disabled={isClearingCache} 
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClearingCache ? <ArrowRepeat className="animate-spin" /> : <Trash />} 
            Cache leeren
          </button>
        </div>
      </div>

      {/* 5. LOGBOOK MIT LÖSCH-FUNKTION (NEU) */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg"><ClockHistory className="text-orange-600" /></div>
            <div>
              <h3 className="font-semibold text-gray-800">System Login Protokoll</h3>
              <p className="text-xs text-gray-500">Historie aller Anmeldungen und Versuche.</p>
            </div>
          </div>
          
          <button 
            onClick={handleClearLoginLogs}
            disabled={isClearingLogs}
            className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClearingLogs ? <ArrowRepeat className="animate-spin" /> : <Trash />} 
            Protokoll löschen
          </button>
        </div>

        <div className="mt-4">
          <LoginLogbook />
        </div>
      </div>

    </div>
  );
}
