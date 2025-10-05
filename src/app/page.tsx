'use client';

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import KpiCard from "@/components/kpi-card";

// Daten-Typen (Interfaces), damit unser Code sauber bleibt
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
    rows: { metricValues: { value: string }[] }[];
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (status === 'authenticated') {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch('/api/data');
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || `API-Fehler: Status ${response.status}`);
          }

          setDashboardData(data);
        } catch (err) {
          console.error("Fehler beim Abrufen der Dashboard-Daten:", err);
          setError((err as Error).message);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchData();
  }, [status]);


  if (status === "loading" || (isLoading && status === 'authenticated')) {
    return <div className="p-8 text-center">Daten werden geladen...</div>;
  }
  
  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        <h1 className="text-2xl font-bold">Fehler beim Laden der Daten</h1>
        <p className="mt-4">Die API hat folgende Fehlermeldung zurückgegeben:</p>
        <pre className="mt-2 p-4 bg-red-100 rounded-md text-left">{error}</pre>
      </div>
    );
  }

  const totalClicks = dashboardData?.gscData?.reduce((sum: number, row: GscDataRow) => sum + row.clicks, 0);
  const totalUsers = dashboardData?.ga4Data?.rows[0]?.metricValues[0]?.value;

  // Die '@ts-ignore'-Zeile wurde hier entfernt, da sie nicht mehr benötigt wird.
  const userRole = session?.user?.role;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          {userRole === 'ADMIN' || userRole === 'SUPERADMIN' ? (
            <a href="/admin" className="text-blue-500 hover:underline">
              Admin Bereich
            </a>
          ) : null}
        </div>
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
