// src/app/projekt/[id]/page.tsx
'use client';

import { useState } from 'react';
import useApiData from "@/hooks/use-api-data";
import KpiCard from "@/components/kpi-card";
import { useParams } from 'next/navigation';
import KpiTrendChart from '@/components/charts/KpiTrendChart';

// Typ-Definitionen für die API-Antwort
interface KpiData {
  value: number;
  change: number;
}

interface ChartDataPoint {
  date: string;
  value: number;
}

interface ProjectData {
  kpis: {
    clicks: KpiData;
    impressions: KpiData;
    sessions: KpiData;
    totalUsers: KpiData;
  };
  charts: {
    clicks: ChartDataPoint[];
    impressions: ChartDataPoint[];
    sessions: ChartDataPoint[];
    totalUsers: ChartDataPoint[];
  };
}

type ActiveKpi = 'clicks' | 'impressions' | 'sessions' | 'totalUsers';

export default function ProjektDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [activeKpi, setActiveKpi] = useState<ActiveKpi>('clicks');

  const { data, isLoading, error } = useApiData<ProjectData>(`/api/projects/${projectId}`);

  const kpiConfig: Record<ActiveKpi, { title: string; color: string }> = {
    clicks: { title: "Klicks", color: "#3b82f6" },
    impressions: { title: "Impressionen", color: "#8b5cf6" },
    sessions: { title: "Sitzungen", color: "#10b981" },
    totalUsers: { title: "Nutzer", color: "#f59e0b" },
  };

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-500">Fehler beim Laden der Daten: {error}</p>
      </div>
    );
  }

  return (
    <>
      {data && (
        <>
          <h2 className="text-3xl font-bold mb-6">Projekt-Dashboard</h2>
          
          {/* KPI-Karten */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard 
              title="Klicks" 
              isLoading={isLoading} 
              value={data.kpis.clicks.value} 
              change={data.kpis.clicks.change} 
            />
            <KpiCard 
              title="Impressionen" 
              isLoading={isLoading} 
              value={data.kpis.impressions.value} 
              change={data.kpis.impressions.change} 
            />
            <KpiCard 
              title="Sitzungen" 
              isLoading={isLoading} 
              value={data.kpis.sessions.value} 
              change={data.kpis.sessions.change} 
            />
            <KpiCard 
              title="Nutzer" 
              isLoading={isLoading} 
              value={data.kpis.totalUsers.value} 
              change={data.kpis.totalUsers.change} 
            />
          </div>

          {/* Chart-Bereich mit Tabs */}
          <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <div className="flex border-b border-gray-200">
              {(Object.keys(kpiConfig) as ActiveKpi[]).map((key) => (
                <button 
                  key={key}
                  onClick={() => setActiveKpi(key)}
                  className={`py-2 px-4 text-sm font-medium ${
                    activeKpi === key 
                      ? 'border-b-2 border-blue-500 text-blue-600' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {kpiConfig[key].title}
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
