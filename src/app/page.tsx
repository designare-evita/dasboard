// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, 
  Briefcase, 
  CheckCircleFill, 
  XCircleFill, 
  FileEarmarkText, 
  ShieldLock, 
  BoxArrowInRight,
  Globe,
  People
} from 'react-bootstrap-icons';
import type { User } from '@/types';

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      // ✅ FIX: Wenn Benutzer ein Kunde ist, Ladevorgang beenden und return
      if (session?.user?.role === 'BENUTZER') {
        setIsLoading(false);
        return;
      }
      // Wenn Admin/Superadmin, lade Projekte
      if (session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN') {
        loadProjects();
      }
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, session, router]);

  async function loadProjects() {
    try {
      const res = await fetch('/api/users?onlyCustomers=true');
      if (!res.ok) throw new Error('Fehler beim Laden der Projekte');
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredProjects = projects.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.domain && user.domain.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500 animate-pulse">Lade Projekte...</div>
      </div>
    );
  }

  // ✅ FIX: Ansicht für normale Kunden (Dashboard statt leerer Seite)
  if (session?.user?.role === 'BENUTZER') {
     return (
       <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
         <div className="text-center bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-md w-full">
           <h1 className="text-2xl font-bold text-gray-900 mb-2">Willkommen!</h1>
           <p className="text-gray-500 mb-6">Sie sind als Kunde angemeldet.</p>
           <div className="space-y-3">
             <Link href="/dashboard/freigabe" className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
               Zum Redaktionsplan
             </Link>
             {/* Falls es ein Dashboard für Kunden gibt: */}
             {/* <Link href="/dashboard" ... >Zum Dashboard</Link> */}
           </div>
         </div>
       </div>
     );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Briefcase className="text-indigo-600" />
              Projekt Übersicht
            </h1>
            <p className="text-gray-500 mt-1">
              Übersicht aller Kundenprojekte und deren aktueller Status.
            </p>
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Projekt, Domain oder E-Mail suchen..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProjects.map((user) => {
            const hasRedaktionsplan = (user.landingpages_count || 0) > 0;
            // ✅ FIX: Zeige alle zugewiesenen Admins, fallback auf Creator, fallback auf System
            const adminsDisplay = user.assigned_admins 
              ? user.assigned_admins 
              : (user.creator_email || 'System');

            return (
              <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 p-6 flex flex-col h-full">
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Globe size={18} className="text-gray-400" />
                      {user.domain || 'Keine Domain'}
                    </h3>
                    <div className="text-sm text-gray-500 mt-1">{user.email}</div>
                  </div>
                  <Link 
                    href={`/projekt/${user.id}`} 
                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    Zum Dashboard <BoxArrowInRight size={16}/>
                  </Link>
                </div>

                <hr className="border-gray-100 mb-4" />

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div>
                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-1">Projekt-Timeline</span>
                    {user.project_timeline_active ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                        <CheckCircleFill size={12} /> Aktiviert
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
                        <XCircleFill size={12} /> Deaktiviert
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-1">Redaktionsplan</span>
                    {hasRedaktionsplan ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                        <FileEarmarkText size={12} /> Vorhanden
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500">
                        <span className="w-3 h-3 rounded-full border-2 border-gray-300"></span>
                        Nein
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-5 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-gray-700">Landingpages ({user.landingpages_count || 0})</span>
                  </div>
                  {hasRedaktionsplan ? (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="flex flex-col bg-white rounded border border-gray-200 p-1.5">
                        <span className="text-[10px] text-gray-400 uppercase">Offen</span>
                        <span className="text-sm font-bold text-blue-600">{user.landingpages_offen}</span>
                      </div>
                      <div className="flex flex-col bg-white rounded border border-gray-200 p-1.5">
                        <span className="text-[10px] text-gray-400 uppercase">Prüfung</span>
                        <span className="text-sm font-bold text-amber-500">{user.landingpages_in_pruefung}</span>
                      </div>
                      <div className="flex flex-col bg-white rounded border border-gray-200 p-1.5">
                        <span className="text-[10px] text-gray-400 uppercase">Freigabe</span>
                        <span className="text-sm font-bold text-green-600">{user.landingpages_freigegeben}</span>
                      </div>
                      <div className="flex flex-col bg-white rounded border border-gray-200 p-1.5">
                        <span className="text-[10px] text-gray-400 uppercase">Gesperrt</span>
                        <span className="text-sm font-bold text-red-500">{user.landingpages_gesperrt}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-2 italic">Keine Landingpages angelegt</div>
                  )}
                </div>

                {/* ✅ FIX: Zeige mehrere Admins an */}
                <div className="mt-auto pt-3 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-500">
                  <ShieldLock size={12} className="mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col w-full">
                    <span className="font-medium mb-1">Betreut durch:</span>
                    <div className="flex flex-wrap gap-1">
                      {adminsDisplay.split(', ').map((adminEmail, idx) => (
                        <span key={idx} className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 truncate max-w-full" title={adminEmail}>
                          {adminEmail}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
          
          {filteredProjects.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500">
              Keine Projekte gefunden.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
