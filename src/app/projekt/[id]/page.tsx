// src/app/projekt/[id]/page.tsx
'use client';

import { useState } from 'react';
import useApiData from "@/hooks/use-api-data";
import Header from "@/components/layout/Header";
import KpiCard from "@/components/kpi-card";
import Link from "next/link";
import { useParams } from 'next/navigation';
import KpiTrendChart from '@/components/charts/KpiTrendChart'; // Importieren

// Typ-Definitionen für die neue API-Antwort
// ...

type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

export default function ProjektDetailPage() {
  const params = useParams();
  const projectId = params.id;
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  const { data, isLoading, error } = useApiData<any>(`/api/projects/${projectId}`); // any für Einfachheit, kann später präzisiert werden

  const kpiConfig = {
    clicks: { title: "Klicks", color: "#3b82f6" },
    impressions: { title: "Impressionen", color: "#8b5cf6" },
    sessions: { title: "Sitzungen", color: "#10b981" },
    totalUsers: { title: "Nutzer", color: "#f59e0b" },
  };

  return (
    <>
      {/* "Zurück"-Link und Fehlerbehandlung (unverändert) */}
      
      {data && !error && (
        <>
          <h2 className="text-3xl font-bold mb-6">Projekt-Dashboard</h2>
          {/* KPI-Karten (angepasst an neue Datenstruktur) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard title="Klicks" isLoading={isLoading} value={data.kpis.clicks.value} change={data.kpis.clicks.change} />
            {/* ... weitere Karten ... */}
          </div>

          {/* NEU: Chart-Bereich mit Tabs */}
          <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <div className="flex border-b border-gray-200">
              {Object.keys(kpiConfig).map((key) => (
                <button 
                  key={key}
                  onClick={() => setActiveKpi(key as ActiveKpi)}
                  className={`py-2 px-4 text-sm font-medium ${activeKpi === key ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {kpiConfig[key as ActiveKpi].title}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <KpiTrendChart 
                data={data.charts[activeKpi]} 
                color={kpiConfig[activeKpi].color} 
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
