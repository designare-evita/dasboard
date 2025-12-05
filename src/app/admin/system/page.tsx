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
  BarChartLine
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

  // KORRIGIERTE FUNKTION
  const handleClearCache = async () => {
    if(!confirm("Sind Sie sicher? Dies löscht den gesamten Google Data Cache für ALLE User.")) return;
    
    setIsClearingCache(true);
    try {
      // WICHTIG: Leeres JSON-Objekt senden und Content-Type Header setzen
      const res = await fetch('/api/clear-cache', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) 
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || `Server Fehler: ${res.status}`);
      }

      const data = await res.json();
      console.log('Cache gelöscht:', data);
      
      alert(`Erfolg: ${data.message || 'Cache geleert.'}`);
      window.location.reload();
      
    } catch (e: any) {
      console.error("Fehler beim Löschen:", e);
      alert(`Fehler: ${e.message}`);
    } finally {
      setIsClearingCache(false);
    }
  };

  const getStatusIcon = (s: string) => {
    if (s === 'ok') return <CheckCircleFill className="text-emerald-500 text-xl" />;
    if (s === 'warning') return <ExclamationTriangleFill className="text-amber-500 text-xl" />;
    return <XCircleFill className="text-red-500 text-xl" />;
  };

  if (isLoading) return <div className="p-10 text-center animate-pulse">Lade System-Status... Dies testet Live-APIs.</div>;
  if (!status) return <div className="p-10 text-center text-red-500">Fehler beim Laden.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      
      <div>
        <h1 className="text-2xl font-bold mb-2">System Kontrollzentrum</h1>
        <p className="text-gray-500">Live-Überwachung aller Systemkomponenten und externen APIs.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* SPALTE LINKS: STATUS KARTEN */}
        <div className="xl:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Database */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-50 rounded-lg"><DatabaseCheck className="text-blue-600 text-xl" /></div>
                {getStatusIcon(status.database.status)}
              </div>
              <h3 className="font-semibold text-gray-900">Datenbank</h3>
              <p className="text-xs text-gray-500 mt-1">{status.database.message}</p>
            </div>

            {/* Auth */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-orange-50 rounded-lg"><ShieldLock className="text-orange-600 text-xl" /></div>
                {getStatusIcon(status.google.status)}
              </div>
              <h3 className="font-semibold text-gray-900">Google Auth Config</h3>
              <p className="text-xs text-gray-500 mt-1">{status.google.message}</p>
            </div>

            {/* Semrush */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-purple-50 rounded-lg"><HddNetwork className="text-purple-600 text-xl" /></div>
                {getStatusIcon(status.semrush.status)}
              </div>
              <h3 className="font-semibold text-gray-900">Semrush API</h3>
              <p className="text-xs text-gray-500 mt-1">{status.semrush.message}</p>
            </div>

            {/* Cron */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-teal-50 rounded-lg"><ClockHistory className="text-teal-600 text-xl" /></div>
                {getStatusIcon(status.cron?.status || 'warning')}
              </div>
              <h3 className="font-semibold text-gray-900">GSC Auto-Update</h3>
              <p className="text-xs text-gray-500 mt-1">{status.cron?.message}</p>
              {status.cron?.lastRun && <div className="mt-2 text-[10px] text-gray-400">Zuletzt: {new Date(status.cron.lastRun).toLocaleDateString()}</div>}
            </div>

            {/* GSC LIVE CHECK */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg"><Search className="text-indigo-600 text-xl" /></div>
                {getStatusIcon(status.gscApi?.status || 'pending')}
              </div>
              <h3 className="font-semibold text-gray-900">GSC Datenfluss</h3>
              <p className="text-xs text-gray-500 mt-1 break-words">{status.gscApi?.message || 'Wird geprüft...'}</p>
            </div>

            {/* GA4 LIVE CHECK */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-yellow-50 rounded-lg"><BarChartLine className="text-yellow-600 text-xl" /></div>
                {getStatusIcon(status.ga4Api?.status || 'pending')}
              </div>
              <h3 className="font-semibold text-gray-900">GA4 Datenfluss</h3>
              <p className="text-xs text-gray-500 mt-1 break-words">{status.ga4Api?.message || 'Wird geprüft...'}</p>
            </div>

            {/* BING */}
            <div className={`p-4 rounded-xl border ${status.bingApi?.status === 'ok' ? 'bg-purple-50 border-purple-200' : status.bingApi?.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {/* Sie können hier ein Microsoft Icon importieren oder Search nutzen */}
                <Search className={status.bingApi?.status === 'ok' ? 'text-purple-600' : 'text-gray-500'} />
                <span className="font-semibold text-gray-900">Bing & AI Search</span>
              </div>
              <p className="text-xs text-gray-600 font-mono bg-white/50 p-1.5 rounded">{status.bingApi?.message || 'Wird geprüft...'}</p>
            </div>

          </div>

          {/* CACHE MANAGEMENT */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gray-100 rounded-lg"><ArrowRepeat className="text-gray-600" /></div>
              <h3 className="font-semibold">Cache Management</h3>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div><span className="text-sm text-gray-600 font-medium">Einträge:</span><span className="ml-2 text-lg font-bold text-gray-900">{status.cache.count}</span></div>
              <button onClick={handleClearCache} disabled={isClearingCache} className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm disabled:opacity-50">
                {isClearingCache ? <ArrowRepeat className="animate-spin" /> : <Trash />} Cache leeren
              </button>
            </div>
          </div>

        </div>

        {/* LOGBOOK */}
        <div className="xl:col-span-1">
           <div className="-mt-8 xl:mt-0"> 
             <LoginLogbook />
           </div>
        </div>

      </div>
    </div>
  );
}
