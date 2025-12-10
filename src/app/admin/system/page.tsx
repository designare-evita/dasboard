// src/app/admin/system/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
  ConeStriped,
  PersonFillLock,
  PersonFillCheck,
  XLg
} from 'react-bootstrap-icons';
import LoginLogbook from '@/app/admin/LoginLogbook';

type UserInMaintenance = {
  id: string;
  email: string;
  role: string;
  domain: string | null;
  maintenance_mode: boolean;
};

export default function SystemHealthPage() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingCache, setIsClearingCache] = useState(false);
  
  // Wartungsmodus State
  const [usersInMaintenance, setUsersInMaintenance] = useState<UserInMaintenance[]>([]);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  // Status Fetcher
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

  // Wartungsmodus Status laden
  const fetchMaintenanceStatus = useCallback(async () => {
    setIsLoadingMaintenance(true);
    try {
      const res = await fetch('/api/admin/maintenance');
      const data = await res.json();
      setUsersInMaintenance(data.usersInMaintenance || []);
      setMaintenanceCount(data.count || 0);
    } catch (e) {
      console.error('Failed to fetch maintenance status', e);
    } finally {
      setIsLoadingMaintenance(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchMaintenanceStatus();
  }, [fetchMaintenanceStatus]);

  // Wartungsmodus für einzelnen User umschalten
  const toggleUserMaintenance = async (userId: string, currentState: boolean) => {
    const newState = !currentState;
    
    setTogglingUserId(userId);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: newState })
      });
      
      if (res.ok) {
        // Liste neu laden
        await fetchMaintenanceStatus();
      } else {
        const data = await res.json();
        alert(data.message || 'Fehler beim Speichern.');
      }
    } catch (e) {
      console.error(e);
      alert('Verbindungsfehler.');
    } finally {
      setTogglingUserId(null);
    }
  };

  // User aus Wartungsmodus entfernen (Shortcut)
  const removeFromMaintenance = async (userId: string) => {
    if (!confirm('Benutzer aus dem Wartungsmodus entfernen?')) return;
    await toggleUserMaintenance(userId, true);
  };

  const handleClearCache = async () => {
    if(!confirm("Sind Sie sicher? Dies löscht den gesamten Google Data Cache für ALLE User.")) return;
    setIsClearingCache(true);
    try {
      const res = await fetch('/api/clear-cache', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) 
      });
      if (!res.ok) throw new Error('Fehler');
      const data = await res.json();
      alert(`Erfolg: ${data.message || 'Cache geleert.'}`);
      window.location.reload();
    } catch (e: any) {
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
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold mb-2">System Kontrollzentrum</h1>
          <p className="text-gray-500">Live-Überwachung aller Systemkomponenten und externen APIs.</p>
        </div>
        
        {/* Wartungsmodus Badge */}
        {maintenanceCount > 0 && (
          <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg flex items-center gap-2 font-bold border border-amber-200">
            <ConeStriped /> {maintenanceCount} User im Wartungsmodus
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* SPALTE LINKS: STATUS KARTEN */}
        <div className="xl:col-span-2 space-y-6">

          {/* WARTUNGSMODUS KONTROLLE - NEU: Per-User */}
          <div className={`p-6 rounded-xl border shadow-sm transition-colors ${maintenanceCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${maintenanceCount > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                  <PersonFillLock className={`text-xl ${maintenanceCount > 0 ? 'text-amber-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Benutzer-Wartungsmodus</h3>
                  <p className="text-sm text-gray-500">
                    {maintenanceCount > 0 
                      ? `${maintenanceCount} Benutzer sind aktuell gesperrt und sehen nur die Wartungsseite.`
                      : 'Keine Benutzer im Wartungsmodus. System läuft normal für alle.'}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={fetchMaintenanceStatus}
                disabled={isLoadingMaintenance}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all text-sm"
              >
                <ArrowRepeat className={isLoadingMaintenance ? 'animate-spin' : ''} />
                Aktualisieren
              </button>
            </div>
            
            {/* Liste der User im Wartungsmodus */}
            {maintenanceCount > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Gesperrte Benutzer:
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {usersInMaintenance.map((user) => (
                    <div 
                      key={user.id}
                      className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-200"
                    >
                      <div className="flex items-center gap-3">
                        <ConeStriped className="text-amber-500" />
                        <div>
                          <span className="font-medium text-gray-900">{user.email}</span>
                          {user.domain && (
                            <span className="text-xs text-gray-500 ml-2">({user.domain})</span>
                          )}
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                            user.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromMaintenance(user.id)}
                        disabled={togglingUserId === user.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-sm font-medium transition-all disabled:opacity-50"
                      >
                        {togglingUserId === user.id ? (
                          <ArrowRepeat className="animate-spin" />
                        ) : (
                          <>
                            <PersonFillCheck /> Freigeben
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Hinweis */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Tipp:</strong> Um einen Benutzer in den Wartungsmodus zu setzen, 
                gehen Sie zur Benutzerverwaltung und aktivieren Sie dort den Wartungsmodus 
                für den jeweiligen Benutzer oder Admin.
              </p>
            </div>
          </div>
          
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
