// src/components/MaintenanceAwareHeader.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface MaintenanceAwareHeaderProps {
  children: React.ReactNode;
}

/**
 * Wrapper-Komponente für den Header.
 * Blendet den Header aus, wenn der aktuelle User im Wartungsmodus ist.
 */
export default function MaintenanceAwareHeader({ children }: MaintenanceAwareHeaderProps) {
  const { data: session, status } = useSession();
  const [isInMaintenance, setIsInMaintenance] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Nur prüfen wenn eingeloggt
    if (status === 'loading') return;
    
    if (!session?.user) {
      setIsChecking(false);
      setIsInMaintenance(false);
      return;
    }

    // SUPERADMIN sieht immer den Header
    if (session.user.role === 'SUPERADMIN') {
      setIsChecking(false);
      setIsInMaintenance(false);
      return;
    }

    // Wartungsmodus-Status für aktuellen User prüfen
    const checkMaintenanceStatus = async () => {
      try {
        const res = await fetch('/api/admin/maintenance?checkSelf=true');
        const data = await res.json();
        setIsInMaintenance(data.isInMaintenance === true);
      } catch (e) {
        console.error('Failed to check maintenance status:', e);
        setIsInMaintenance(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkMaintenanceStatus();
  }, [session, status]);

  // Während der Prüfung nichts anzeigen (kurzes Flackern vermeiden)
  // Alternativ: Loading-State oder den Header trotzdem zeigen
  if (isChecking && status !== 'unauthenticated') {
    return null; // Oder: return <>{children}</> für sofortige Anzeige
  }

  // Wenn User im Wartungsmodus -> Header ausblenden
  if (isInMaintenance) {
    return null;
  }

  // Normaler Fall: Header anzeigen
  return <>{children}</>;
}
