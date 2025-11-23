// src/app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  PersonPlus, 
  Trash, 
  PencilSquare, 
  Search,
  CheckCircleFill,
  XCircleFill,
  FileEarmarkText,
  ClockHistory,
  ShieldLock,
  ListCheck
} from 'react-bootstrap-icons';
import type { User } from '@/types';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN') {
        router.push('/dashboard');
      } else {
        loadUsers();
      }
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, session, router]);

  async function loadUsers() {
    try {
      // Wir rufen unsere angepasste API auf
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm('Diesen Benutzer wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
      }
    } catch (error) {
      console.error(error);
    }
  }

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.domain && user.domain.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (status === 'loading' || isLoading) {
    return <div className="p-8 text-center text-gray-500">Lade Benutzerverwaltung...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Benutzerverwaltung</h1>
            <p className="text-gray-500 mt-1">
              Verwalten Sie Kunden, Projekte und Redaktionspläne.
            </p>
          </div>
          <Link 
            href="/admin/register" 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
          >
            <PersonPlus size={18} />
            Neuen Benutzer anlegen
          </Link>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Suchen nach E-Mail oder Domain..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Users List */}
        <div className="grid gap-4">
          {filteredUsers.map((user) => (
            <div key={user.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                
                {/* Linke Spalte: Basis Infos & Status */}
                <div className="flex-grow">
                  <div className="flex items-start justify-between">
                    <div>
                      {/* Domain & Email */}
                      <h3 className="text-xl font-bold text-gray-900">{user.domain || 'Keine Domain'}</h3>
                      <div className="text-gray-500 font-medium mb-3">{user.email}</div>
                      
                      {/* ✅ NEU: Detaillierte Projekt-Infos */}
                      <div className="space-y-2 text-sm mt-4 pl-1 border-l-2 border-gray-100">
                        
                        {/* 1. Projekt-Timeline Status */}
                        <div className="flex items-center gap-2">
                           <ClockHistory size={14} className="text-gray-400" />
                           <span className="text-gray-600">Projekt-Timeline:</span>
                           {user.project_timeline_active ? (
                             <span className="text-green-600 font-medium flex items-center gap-1 text-xs bg-green-50 px-2 py-0.5 rounded-full"><CheckCircleFill size={10}/> Aktiv</span>
                           ) : (
                             <span className="text-gray-400 font-medium flex items-center gap-1 text-xs bg-gray-50 px-2 py-0.5 rounded-full"><XCircleFill size={10}/> Inaktiv</span>
                           )}
                        </div>

                        {/* 2. Redaktionsplan Status (Vorhanden wenn Pages > 0) */}
                        <div className="flex items-center gap-2">
                           <FileEarmarkText size={14} className="text-gray-400" />
                           <span className="text-gray-600">Redaktionsplan vorhanden:</span>
                           {(user.landingpages_count || 0) > 0 ? (
                             <span className="text-indigo-600 font-medium">Ja</span>
                           ) : (
                             <span className="text-gray-400">Nein</span>
                           )}
                        </div>

                        {/* 3. Landingpages Breakdown */}
                        {(user.landingpages_count || 0) > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                             <span className="font-semibold text-gray-700 w-full sm:w-auto flex items-center gap-1">
                               <ListCheck size={14} /> 
                               {user.landingpages_count} Landingpages:
                             </span>
                             <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">Offen: {user.landingpages_offen}</span>
                             <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">Prüfung: {user.landingpages_in_pruefung}</span>
                             <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-100">Freig.: {user.landingpages_freigegeben}</span>
                             <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">Gesperrt: {user.landingpages_gesperrt}</span>
                          </div>
                        )}

                        {/* 4. Admin / Ersteller */}
                        <div className="flex items-center gap-2 pt-1">
                           <ShieldLock size={14} className="text-gray-400" />
                           <span className="text-gray-600">Admin:</span>
                           <span className="text-gray-800 font-medium bg-gray-100 px-2 py-0.5 rounded text-xs">
                             {user.creator_email || 'System / Unbekannt'}
                           </span>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

                {/* Rechte Spalte: Buttons & Role Badge */}
                <div className="flex flex-col items-end gap-3 min-w-[140px]">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-700' :
                    user.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {user.role}
                  </span>
                  
                  <div className="flex items-center gap-2 mt-auto">
                    <Link 
                      href={`/admin/edit/${user.id}`}
                      className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Bearbeiten"
                    >
                      <PencilSquare size={20} />
                    </Link>
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Löschen"
                    >
                      <Trash size={20} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ))}
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500">
              Keine Benutzer gefunden.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
