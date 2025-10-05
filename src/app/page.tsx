'use client';

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import KpiCard from "@/components/kpi-card"; // Pfad korrigiert

// --- NEU: Eine genaue Beschreibung unserer Daten ---
interface GscDataRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface DashboardData {
  gscData: GscDataRow[];
  ga4Data: {
    rows: {
      metricValues: { value: string }[];
    }[];
  };
}
// ----------------------------------------------------

export default function DashboardPage() {
  const { data: session, status } = useSession();
  // --- GEÄNDERT: 'any' durch unsere neue Datenbeschreibung ersetzt ---
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (status === 'authenticated') {
        setIsLoading(true);
        const response = await fetch('/api/data');
        const data = await response.json();
        setDashboardData(data);
        setIsLoading(false);
      }
    };
    fetchData();
  }, [status]);


  if (status === "loading" || isLoading) {
    return <div className="p-8">Daten werden geladen...</div>;
  }
  
  // --- GEÄNDERT: 'any' durch unsere neue Datenbeschreibung ersetzt ---
  const totalClicks = dashboardData?.gscData?.reduce((sum: number, row: GscDataRow) => sum + row.clicks, 0);

  const totalUsers = dashboardData?.ga4Data?.rows[0]?.metricValues[0]?.value;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button 
          onClick={() => signOut({ callbackUrl: '/login' })} 
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Abmelden
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard 
          title="Gesamte Klicks (GSC)"
          value={totalClicks?.toLocaleString('de-DE') || 'N/A'}
          description="Letzte 12 Monate"
        />
        <KpiCard 
          title="Gesamte Nutzer (GA4)"
          value={Number(totalUsers).toLocaleString('de-DE') || 'N/A'}
          description="Letzte 12 Monate"
        />
      </div>

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Top Keywords (GSC)</h2>
        <pre className="bg-gray-100 p-4 rounded-md mt-2 overflow-x-auto">
          {JSON.stringify(dashboardData?.gscData, null, 2)}
        </pre>
      </div>
    </div>
  );
}
