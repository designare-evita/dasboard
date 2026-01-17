// src/app/admin/system/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  DatabaseCheck, ShieldLock, ArrowRepeat, Trash,
  CheckCircleFill, XCircleFill, ExclamationTriangleFill,
  HddNetwork, ClockHistory, Search, BarChartLine,
  ConeStriped, PersonFillLock, Magic,
  ToggleOn, ToggleOff, PersonCheck
} from 'react-bootstrap-icons';
import LoginLogbook from '@/app/admin/LoginLogbook';

// Typen definiert
type UserStatus = {
  id: string;
  email: string;
  role: string;
  domain: string | null;
  maintenance_mode: boolean;   // Für Wartung
  ki_tool_enabled?: boolean;   // Für KI
};

export default function SystemHealthPage() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearingCache, setIsClearingCache] = useState(false);
  
  // --- WARTUNGSMODUS STATE ---
  const [maintenanceUsers, setMaintenanceUsers] = useState<UserStatus[]>([]);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(false);
  const [togglingMaintId, setTogglingMaintId] = useState<string | null>(null);
  const [maintSearchTerm, setMaintSearchTerm] = useState('');

  // --- KI-TOOL STATE ---
  const [kiToolUsers, setKiToolUsers] = useState<UserStatus[]>([]);
  const [kiToolDisabledCount, setKiToolDisabledCount] = useState(0);
  const [isLoadingKiTool, setIsLoadingKiTool] = useState(false);
  const [togglingKiId, setTogglingKiId] = useState<string | null>(null);
  const [kiToolSearchTerm, setKiToolSearchTerm] = useState('');

  // --- FETCHERS ---
  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/system-status');
      if (res.ok) setStatus(await res.json());
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const fetchMaintenanceStatus = useCallback(async () => {
    setIsLoadingMaintenance(true);
    try {
      const res = await fetch('/api/admin/maintenance');
      const data = await res.json();
      // API gibt jetzt { users: [], count: number } zurück
      setMaintenanceUsers(data.users || []);
      setMaintenanceCount(data.count || 0);
    } catch (e) {
      console.error('Failed to fetch maintenance status', e);
    } finally {
      setIsLoadingMaintenance(false);
    }
  }, []);

  const fetchKiToolStatus = useCallback(async () => {
    setIsLoadingKiTool(true);
    try {
      const res = await fetch('/api/admin/ki-tool-settings');
      const data = await res.json();
      setKiToolUsers(data.users || []);
      setKiToolDisabledCount(data.disabledCount || 0);
    } catch (e) { console.error(e); } finally { setIsLoadingKiTool(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchMaintenanceStatus();
    fetchKiToolStatus();
  }, [fetchMaintenanceStatus, fetchKiToolStatus]);

  // --- ACTIONS ---

  // Wartungsmodus umschalten
  const toggleMaintenance = async (userId: string, currentMode: boolean) => {
    const shouldActivate = !currentMode;
    // Sicherheitsabfrage beim Aktivieren
    if (shouldActivate && !confirm('Benutzer wirklich sperren (Wartungsmodus)? Er kann sich dann nicht mehr einloggen.')) {
      return;
    }

    setTogglingMaintId(userId);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: shouldActivate })
      });
      if (res.ok) await fetchMaintenanceStatus();
      else alert((await res.json()).message || 'Fehler');
    } catch (e) { alert('Verbindungsfehler'); } finally { setTogglingMaintId(null); }
  };

  // KI-Tool umschalten
  const toggleKiTool = async (userId: string, currentEnabled: boolean) => {
    // currentEnabled ist true, wenn enabled. newState = !currentEnabled
    // Aber Achtung: DB Logic in toggleKiTool API erwartet "isEnabled".
    // Wenn User es hat (true), wollen wir deaktivieren (false).
    
    // Die existierende API erwartet { isEnabled: boolean }
    // User object hat "ki_tool_enabled"
    const newState = currentEnabled === false ? true : false; // Wenn undefined/true -> false. Wenn false -> true.

    setTogglingKiId(userId);
    try {
      const res = await fetch('/api/admin/ki-tool-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isEnabled: newState })
      });
      if (res.ok) await fetchKiToolStatus();
      else alert((await res.json()).message || 'Fehler');
    } catch (e) { alert('Verbindungsfehler'); } finally { setTogglingKiId(null); }
  };

  const handleClearCache = async () => {
    if(!confirm("Cache für ALLE User leeren?")) return;
    setIsClearingCache(true);
    try {
      await fetch('/api/clear-cache', { method: 'POST', body: JSON.stringify({}) });
      window.location.reload();
    } catch (e) { alert('Fehler'); } finally { setIsClearingCache(false); }
  };

  const getStatusIcon = (s: string) => {
    if (s === 'ok') return <CheckCircleFill className="text-emerald-500 text-xl" />;
    if (s === 'warning') return <ExclamationTriangleFill className="text-amber-500 text-xl" />;
    return <XCircleFill className="text-red-500 text-xl" />;
  };

  // --- FILTERS ---
  const filteredKiUsers = kiToolUsers.filter(u => 
    u.email.toLowerCase().includes(kiToolSearchTerm.toLowerCase()) || 
    (u.domain && u.domain.toLowerCase().includes(kiToolSearchTerm.toLowerCase()))
  );

  const filteredMaintUsers = maintenanceUsers.filter(u => 
    u.email.toLowerCase().includes(maintSearchTerm.toLowerCase()) || 
    (u.domain && u.domain.toLowerCase().includes(maintSearchTerm.toLowerCase()))
  );

  if (isLoading) return <div className="p-10 text-center animate-pulse">Lade System-Status...</div>;
  if (!status) return <div className="p-10 text-center text-red-500">Fehler beim Laden.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold mb-2">System Kontrollzentrum</h1>
          <p className="text-gray-500">Live-Überwachung und Verwaltung.</p>
        </div>
        <div className="flex gap-2">
          {maintenanceCount > 0 && (
            <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg flex items-center gap-2 font-bold border border-red-200">
              <ConeStriped /> {maintenanceCount} Gesperrt
            </div>
          )}
          {kiToolDisabledCount > 0 && (
            <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-lg flex items-center gap-2 font-bold border border-purple-200">
              <Magic /> {kiToolDisabledCount} KI deaktiviert
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LINKER BEREICH: VERWALTUNG */}
        <div className="xl:col-span-2 space-y-6">

          {/* 1. WARTUNGSMODUS VERWALTUNG (Neu strukturiert) */}
          <div className={`p-6 rounded-xl border shadow-sm transition-colors ${maintenanceCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${maintenanceCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <PersonFillLock className={`text-xl ${maintenanceCount > 0 ? 'text-red-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Wartungsmodus & Zugangssperre</h3>
                  <p className="text-sm text-gray-500">
                    {maintenanceCount > 0 
                      ? `${maintenanceCount} Benutzer sind aktuell gesperrt (Wartungsseite).`
                      : 'Alle Benutzer haben freien Zugang.'}
                  </p>
                </div>
              </div>
              <button onClick={fetchMaintenanceStatus} disabled={isLoadingMaintenance} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-all">
                <ArrowRepeat className={isLoadingMaintenance ? 'animate-spin' : ''} /> Aktualisieren
              </button>
            </div>
            
            {/* Suche */}
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Benutzer für Wartung suchen..."
                value={maintSearchTerm}
                onChange={(e) => setMaintSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Liste */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filteredMaintUsers.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">Keine Benutzer gefunden</div>
              ) : (
                filteredMaintUsers.map((user) => (
                  <div key={user.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${user.maintenance_mode ? 'bg-red-100 border-red-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Status Dot */}
                      <div className={`w-2.5 h-2.5 rounded-full ${user.maintenance_mode ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                      
                      <div className="min-w-0 flex-1">
                        <span className={`font-medium truncate block ${user.maintenance_mode ? 'text-red-900' : 'text-gray-900'}`}>
                          {user.email}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {user.domain && <span>{user.domain}</span>}
                          <span className={`px-1.5 py-0.5 rounded ${user.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{user.role}</span>
                          {user.maintenance_mode && <span className="text-red-600 font-bold uppercase">GESPERRT</span>}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleMaintenance(user.id, user.maintenance_mode)}
                      disabled={togglingMaintId === user.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                        user.maintenance_mode
                          ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700' // Button zum Entsperren
                          : 'bg-red-100 hover:bg-red-200 text-red-700' // Button zum Sperren
                      }`}
                    >
                      {togglingMaintId === user.id ? <ArrowRepeat className="animate-spin" size={14} /> : (
                        user.maintenance_mode ? <><PersonCheck size={16} /> Freigeben</> : <><ConeStriped size={16} /> Sperren</>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
            {/* Legende / Info */}
             <div className="mt-3 text-[10px] text-gray-400 text-right">
                Superadmins werden aus Sicherheitsgründen hier nicht gelistet.
             </div>
          </div>

          {/* 2. KI-TOOL VERWALTUNG */}
          <div className={`p-6 rounded-xl border shadow-sm transition-colors ${kiToolDisabledCount > 0 ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${kiToolDisabledCount > 0 ? 'bg-purple-100' : 'bg-gray-100'}`}>
                  <Magic className={`text-xl ${kiToolDisabledCount > 0 ? 'text-purple-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">KI-Tool Berechtigung</h3>
                  <p className="text-sm text-gray-500">
                    {kiToolDisabledCount > 0 ? `${kiToolDisabledCount} User ohne KI-Tool.` : 'Alle User haben KI-Tool Zugriff.'}
                  </p>
                </div>
              </div>
              <button onClick={fetchKiToolStatus} disabled={isLoadingKiTool} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-all">
                <ArrowRepeat className={isLoadingKiTool ? 'animate-spin' : ''} /> Aktualisieren
              </button>
            </div>
            
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Benutzer für KI suchen..."
                value={kiToolSearchTerm}
                onChange={(e) => setKiToolSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filteredKiUsers.length === 0 ? <div className="text-center py-4 text-gray-400 text-sm">Nichts gefunden</div> : filteredKiUsers.map((user) => (
                <div key={user.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${user.ki_tool_enabled === false ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full ${user.ki_tool_enabled === false ? 'bg-gray-300' : 'bg-purple-500'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900 truncate block">{user.email}</span>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {user.domain && <span>{user.domain}</span>}
                        <span className={`px-1.5 py-0.5 rounded ${user.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{user.role}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleKiTool(user.id, user.ki_tool_enabled !== false)}
                    disabled={togglingKiId === user.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                      user.ki_tool_enabled === false ? 'bg-green-100 hover:bg-green-200 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }`}
                  >
                    {togglingKiId === user.id ? <ArrowRepeat className="animate-spin" size={14} /> : (
                      user.ki_tool_enabled === false ? <><ToggleOn size={16} /> Aktivieren</> : <><ToggleOff size={16} /> Deaktivieren</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* STATUS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-50 rounded-lg"><DatabaseCheck className="text-blue-600 text-xl" /></div>
                {getStatusIcon(status.database.status)}
              </div>
              <h3 className="font-semibold text-gray-900">Datenbank</h3>
              <p className="text-xs text-gray-500 mt-1">{status.database.message}</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-orange-50 rounded-lg"><ShieldLock className="text-orange-600 text-xl" /></div>
                {getStatusIcon(status.google.status)}
              </div>
              <h3 className="font-semibold text-gray-900">Google Auth</h3>
              <p className="text-xs text-gray-500 mt-1">{status.google.message}</p>
            </div>
            
             <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-purple-50 rounded-lg"><HddNetwork className="text-purple-600 text-xl" /></div>
                {getStatusIcon(status.semrush.status)}
              </div>
              <h3 className="font-semibold text-gray-900">Semrush API</h3>
              <p className="text-xs text-gray-500 mt-1">{status.semrush.message}</p>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg"><Search className="text-indigo-600 text-xl" /></div>
                {getStatusIcon(status.gscApi?.status || 'pending')}
              </div>
              <h3 className="font-semibold text-gray-900">GSC API</h3>
              <p className="text-xs text-gray-500 mt-1">{status.gscApi?.message || 'Prüfe...'}</p>
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
