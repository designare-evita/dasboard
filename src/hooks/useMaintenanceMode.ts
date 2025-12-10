// src/hooks/useMaintenanceMode.ts
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface UseMaintenanceModeReturn {
  isInMaintenance: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook zum Prüfen, ob der aktuelle User im Wartungsmodus ist.
 * SUPERADMINs sind immer ausgenommen.
 */
export function useMaintenanceMode(): UseMaintenanceModeReturn {
  const { data: session, status } = useSession();
  const [isInMaintenance, setIsInMaintenance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkMaintenanceStatus = async () => {
    // Nicht eingeloggt -> kein Wartungsmodus
    if (!session?.user) {
      setIsInMaintenance(false);
      setIsLoading(false);
      return;
    }

    // SUPERADMIN ist immer ausgenommen
    if (session.user.role === 'SUPERADMIN') {
      setIsInMaintenance(false);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/maintenance?checkSelf=true');
      const data = await res.json();
      setIsInMaintenance(data.isInMaintenance === true);
    } catch (e) {
      console.error('Failed to check maintenance status:', e);
      setIsInMaintenance(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    checkMaintenanceStatus();
  }, [session, status]);

  return {
    isInMaintenance,
    isLoading: isLoading || status === 'loading',
    refetch: checkMaintenanceStatus,
  };
}
