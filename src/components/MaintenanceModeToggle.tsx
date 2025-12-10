// src/components/MaintenanceModeToggle.tsx
'use client';

import { useState } from 'react';
import { ConeStriped, PersonFillLock, PersonFillCheck, ArrowRepeat } from 'react-bootstrap-icons';

interface MaintenanceModeToggleProps {
  userId: string;
  userEmail: string;
  userRole: string;
  initialValue: boolean;
  onToggle?: (newValue: boolean) => void;
  disabled?: boolean;
}

/**
 * Toggle-Komponente für den benutzerspezifischen Wartungsmodus.
 * Kann in Benutzer-Bearbeitungsformularen oder Listen verwendet werden.
 */
export default function MaintenanceModeToggle({
  userId,
  userEmail,
  userRole,
  initialValue,
  onToggle,
  disabled = false
}: MaintenanceModeToggleProps) {
  const [isActive, setIsActive] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);

  // SUPERADMIN kann nicht in Wartungsmodus gesetzt werden
  if (userRole === 'SUPERADMIN') {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <PersonFillCheck />
        <span>SUPERADMINs sind ausgenommen</span>
      </div>
    );
  }

  const handleToggle = async () => {
    const newState = !isActive;
    const confirmMsg = newState
      ? `"${userEmail}" in den Wartungsmodus setzen? Der Benutzer sieht nur noch die Wartungsseite.`
      : `"${userEmail}" aus dem Wartungsmodus entfernen?`;
    
    if (!confirm(confirmMsg)) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: newState })
      });

      if (res.ok) {
        setIsActive(newState);
        onToggle?.(newState);
      } else {
        const data = await res.json();
        alert(data.message || 'Fehler beim Speichern');
      }
    } catch (e) {
      console.error(e);
      alert('Verbindungsfehler');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
      isActive 
        ? 'bg-amber-50 border-amber-200' 
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isActive ? 'bg-amber-100' : 'bg-gray-100'}`}>
          {isActive ? (
            <ConeStriped className="text-amber-600 text-lg" />
          ) : (
            <PersonFillCheck className="text-gray-500 text-lg" />
          )}
        </div>
        <div>
          <h4 className="font-medium text-gray-900">Wartungsmodus</h4>
          <p className="text-xs text-gray-500">
            {isActive 
              ? 'Benutzer ist gesperrt und sieht nur die Wartungsseite' 
              : 'Benutzer hat normalen Zugriff auf das System'}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={disabled || isLoading}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isActive
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
        }`}
      >
        {isLoading ? (
          <ArrowRepeat className="animate-spin text-lg" />
        ) : isActive ? (
          <>
            <PersonFillCheck className="text-lg" />
            Freigeben
          </>
        ) : (
          <>
            <PersonFillLock className="text-lg" />
            Sperren
          </>
        )}
      </button>
    </div>
  );
}

/**
 * Kompakte Version für Listen/Tabellen
 */
export function MaintenanceModeToggleCompact({
  userId,
  userRole,
  initialValue,
  onToggle,
  disabled = false
}: Omit<MaintenanceModeToggleProps, 'userEmail'>) {
  const [isActive, setIsActive] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);

  if (userRole === 'SUPERADMIN') {
    return <span className="text-gray-400 text-xs">—</span>;
  }

  const handleToggle = async () => {
    const newState = !isActive;
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: newState })
      });

      if (res.ok) {
        setIsActive(newState);
        onToggle?.(newState);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={disabled || isLoading}
      className={`p-1.5 rounded-lg transition-all disabled:opacity-50 ${
        isActive
          ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
          : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
      }`}
      title={isActive ? 'Im Wartungsmodus - Klicken zum Freigeben' : 'Klicken für Wartungsmodus'}
    >
      {isLoading ? (
        <ArrowRepeat className="animate-spin text-sm" />
      ) : isActive ? (
        <ConeStriped className="text-sm" />
      ) : (
        <PersonFillCheck className="text-sm" />
      )}
    </button>
  );
}
