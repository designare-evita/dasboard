// src/app/page.tsx
'use client';

import { useSession } from "next-auth/react";
import useApiData from "@/hooks/use-api-data";
import KpiCard from "@/components/kpi-card";
import Link from "next/link";

// Typ-Definitionen
interface KpiValue { value: number; change: number; }
interface CustomerDashboard { searchConsole: { clicks: KpiValue; impressions: KpiValue; }; analytics: { sessions: KpiValue; totalUsers: KpiValue; }; }
interface Project { id: string; email: string; domain: string; }
interface SuperAdminResponse { debugInfo: { detectedRole: string; query: string; }; projects: Project[]; }
type ApiDataType = CustomerDashboard | SuperAdminResponse;

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { data, isLoading, error } = useApiData<ApiDataType>('/api/data');

  if (status === 'loading' || isLoading) {
    return <div className="p-8 text-center">Lade...</div>;
  }

  const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
  
  // HIER IST DIE KORREKTUR: 'any' wurde durch den sicheren Typ 'unknown' ersetzt.
  const isSuperAdminResponse = (d: unknown): d is SuperAdminResponse => 
    isSuperAdmin && !!d && typeof d === 'object' && 'debugInfo' in d && 'projects' in d;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <main className="mt-6">
        {error && <div className="p-6 text-center bg-red-100 rounded-lg text-red-700">{error}</div>}

        {isSuperAdminResponse(data) && (
          <>
            <div className="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-md">
              <h3 className="font-bold text-lg">Diagnose-Informationen</h3>
              <p><strong>Erkannte Rolle:</strong> {data.debugInfo.detectedRole}</p>
              <pre className="mt-2 p-2 bg-gray-800 text-white rounded-md text-sm"><code>{data.debugInfo.query}</code></pre>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-bold mb-4">Alle Kundenprojekte</h2>
              {data.projects.length === 0 ? (
                <p>Es wurden noch keine Kundenprojekte angelegt.</p>
              ) : (
                <ul className="space-y-3">
                  {data.projects.map((project) => (
                    <li key={project.id} className="p-4 border rounded-md flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{project.domain}</p>
                        <p className="text-sm text-gray-500">{project.email}</p>
                      </div>
                      <Link href={`/projekt/${project.id}`} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Details ansehen
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {data && !isSuperAdminResponse(data) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard 
              title="Klicks" 
              isLoading={isLoading}
              value={(data as CustomerDashboard).searchConsole.clicks.value}
              change={(data as CustomerDashboard).searchConsole.clicks.change}
            />
            <KpiCard 
              title="Impressionen" 
              isLoading={isLoading}
              value={(data as CustomerDashboard).searchConsole.impressions.value}
              change={(data as CustomerDashboard).searchConsole.impressions.change}
            />
            <KpiCard 
              title="Sitzungen" 
              isLoading={isLoading}
              value={(data as CustomerDashboard).analytics.sessions.value}
              change={(data as CustomerDashboard).analytics.sessions.change}
            />
            <KpiCard 
              title="Nutzer" 
              isLoading={isLoading}
              value={(data as CustomerDashboard).analytics.totalUsers.value}
              change={(data as CustomerDashboard).analytics.totalUsers.change}
            />
          </div>
        )}
      </main>
    </div>
  );
}
