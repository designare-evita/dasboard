'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { User } from '@/types';
import {
  Pencil,
  Trash,
  PersonPlus,
  ArrowRepeat,
  People,
  PersonVideo,
  Briefcase
} from 'react-bootstrap-icons'; 
import { toast } from 'sonner'; // ✅ Toast Import

import LogoManager from './LogoManager';
import LoginLogbook from './LoginLogbook'; 

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // "message" State entfernt -> wird durch Toast ersetzt
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [selectedRole, setSelectedRole] = useState<'BENUTZER' | 'ADMIN'>('BENUTZER');
  const [isSubmitting, setIsSubmitting] = useState(false); 

  const isSuperAdmin = session?.user?.role === 'SUPERADMIN';

  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-blue-100 text-blue-800';
      case 'BENUTZER': return 'bg-green-100 text-green-800';
      case 'SUPERADMIN': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const fetchUsers = async (): Promise<void> => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/users');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Laden der Benutzerliste.');
      }
      const data: User[] = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('[AdminPage] Fetch Users Error:', error);
      toast.error('Fehler beim Laden der Benutzer', {
        description: error instanceof Error ? error.message : 'Verbindungsfehler'
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      void fetchUsers();
    }
  }, [status]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const loadingToast = toast.loading('Erstelle Benutzer...'); // ✅ Lade-Toast starten
    setIsSubmitting(true); 

    const formData = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formData) as Record<string, unknown>;

    const permissionsString = (rawData.permissions as string) || '';
    const permissionsArray = permissionsString.split(',').map(p => p.trim()).filter(p => p.length > 0);

    const payload = { 
      ...rawData, 
      role: selectedRole,
      permissions: (isSuperAdmin && selectedRole === 'ADMIN') ? permissionsArray : [] 
    };

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.message || 'Ein unbekannter Fehler ist aufgetreten.');

      // ✅ Erfolg melden
      toast.dismiss(loadingToast); // Lade-Toast weg
      toast.success(`Benutzer "${result.email}" erstellt!`, {
        description: 'Der Account ist jetzt aktiv.'
      });

      (e.target as HTMLFormElement).reset();
      setSelectedRole('BENUTZER');
      await fetchUsers();
    } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('Fehler beim Erstellen', {
            description: error instanceof Error ? error.message : 'Unbekannter Fehler'
        });
    } finally {
      setIsSubmitting(false); 
    }
  };

  const handleDelete = async (userId: string): Promise<void> => {
    // Hier nutzen wir window.confirm, das ist für kritische Aktionen okay.
    // Alternativ könnte man einen Custom Dialog bauen.
    if (!window.confirm('Nutzer wirklich löschen?')) return;
    
    const loadingToast = toast.loading('Lösche Benutzer...');

    try {
      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Fehler beim Löschen');
      
      toast.dismiss(loadingToast);
      toast.success('Benutzer gelöscht');
      await fetchUsers(); 
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Löschen fehlgeschlagen', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    }
  };

  if (status === 'loading') {
    return (
        <div className="p-8 text-center flex items-center justify-center min-h-screen">
          <ArrowRepeat className="animate-spin text-indigo-600 mr-2" size={24} />
          Lade Sitzung...
        </div>
    );
  }
  
  if (status === 'unauthenticated' || !session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    router.push('/login');
    return null;
  }

  return (
  <div className="p-8 mt-8 max-w-full mx-auto bg-gray-50 min-h-screen">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin-Bereich</h1>
          <p className="text-gray-600 mt-2">Verwalten Sie Benutzer und Projekte</p>
        </div>
      </div>

      {/* ❌ ALTE MESSAGE BOX ENTFERNT */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        
        {/* CREATE FORMULAR */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md h-fit border border-gray-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <PersonPlus size={22} /> Neuen Nutzer anlegen
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
             {/* ... Formular Felder bleiben identisch ... */}
             {/* Um Platz zu sparen hier gekürzt, der Inhalt der Inputs bleibt exakt gleich wie vorher */}
             <div>
              <label className="block text-sm font-medium text-gray-700">Rolle</label>
              <select
                name="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'BENUTZER' | 'ADMIN')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isSubmitting}
              >
                <option value="BENUTZER">Kunde (Benutzer)</option>
                {isSuperAdmin && <option value="ADMIN">Admin</option>}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">E-Mail</label>
              <input name="email" type="email" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" disabled={isSubmitting} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Initial-Passwort</label>
              <input name="password" type="text" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" disabled={isSubmitting} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Mandant-ID (Label)</label>
              <input name="mandant_id" type="text" required readOnly={!isSuperAdmin} defaultValue={!isSuperAdmin ? session?.user?.mandant_id || '' : undefined} placeholder={isSuperAdmin ? "z.B. max-online" : "Wird geerbt"} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100" disabled={isSubmitting || !isSuperAdmin} />
            </div>

            {isSuperAdmin && selectedRole === 'ADMIN' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Berechtigungen</label>
                <input name="permissions" type="text" placeholder="z.B. label1, label2" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" disabled={isSubmitting} />
              </div>
            )}

            {selectedRole === 'BENUTZER' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Domain</label>
                  <input name="domain" type="text" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" disabled={isSubmitting} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Favicon URL</label>
                    <input name="favicon_url" type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" disabled={isSubmitting} />
                </div>
                {/* Weitere optionale Felder ... */}
                 <div><label className="block text-sm font-medium text-gray-700">GSC Site URL</label><input name="gsc_site_url" type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" disabled={isSubmitting} /></div>
                 <div><label className="block text-sm font-medium text-gray-700">GA4 ID</label><input name="ga4_property_id" type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" disabled={isSubmitting} /></div>
                 <div><label className="block text-sm font-medium text-gray-700">Semrush Project ID</label><input name="semrush_project_id" type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" disabled={isSubmitting} /></div>
              </>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2 font-normal text-white bg-[#188bdb] border-[3px] border-[#188bdb] rounded-[3px] hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <ArrowRepeat className="animate-spin" size={18} /> : <PersonPlus size={18} />}
              {isSubmitting ? 'Speichere...' : (selectedRole === 'BENUTZER' ? 'Kunden erstellen' : 'Admin erstellen')}
            </button>
          </form>
        </div>

        {/* LISTE */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <People size={22} /> Vorhandene Nutzer
          </h2>
          {isLoadingUsers ? (
            <div className="flex items-center text-gray-500">
              <ArrowRepeat className="animate-spin text-indigo-600 mr-2" size={18} /> Lade Benutzer...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center text-gray-400 p-8"><People size={32} className="mx-auto mb-2" /><p>Keine Benutzer gefunden.</p></div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map((user) => (
                  <li key={user.id} className="p-4 border rounded-lg flex flex-col justify-between gap-3 transition-colors hover:bg-gray-50 shadow-sm h-full">
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-gray-900 truncate" title={user.email}>{user.email}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${getRoleStyle(user.role)}`}>
                          {user.role}
                        </span>
                      </div>
                      
                      {user.mandant_id && <p className="text-xs text-indigo-600 font-medium truncate">Label: {user.mandant_id}</p>}
                      {user.domain && <p className="text-sm text-blue-600 font-medium truncate mt-1">{user.domain}</p>}

                      {user.role === 'BENUTZER' && user.assigned_admins && (
                        <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                          <PersonVideo size={12} /> <span className="font-medium">Betreuer:</span> {user.assigned_admins}
                        </div>
                      )}

                      {user.role === 'ADMIN' && user.assigned_projects && (
                        <div className="mt-2 text-xs text-gray-600 flex items-start gap-1">
                          <Briefcase size={12} className="mt-0.5 flex-shrink-0" />
                          <span className="text-gray-500 line-clamp-2">{user.assigned_projects}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-100 mt-2">
                      <Link href={`/admin/edit/${user.id}`} className="flex-1 justify-center bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50 text-sm flex items-center gap-1.5 transition-colors">
                        <Pencil size={14} /> Bearbeiten
                      </Link>
                      {isSuperAdmin && (
                        <button onClick={() => void handleDelete(user.id)} className="flex-1 justify-center bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded hover:bg-red-50 text-sm flex items-center gap-1.5 transition-colors">
                          <Trash size={14} /> Löschen
                        </button>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <LogoManager />
          <LoginLogbook />
        </div>
      )}
    </div>
  );
}
