// src/app/admin/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { User } from '@/types';
// KEIN Import für die globale 'Button' Komponente mehr
import {
  Pencil,
  Trash,
  PersonPlus,
  ArrowRepeat,
  InfoCircleFill,
  ExclamationTriangleFill,
  People,
  FileText // Icon für Redaktionsplan
} from 'react-bootstrap-icons'; // Icons importiert

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State management for the component
  const [message, setMessage] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [selectedRole, setSelectedRole] = useState<'BENUTZER' | 'ADMIN'>('BENUTZER');
  const [isSubmitting, setIsSubmitting] = useState(false); // Ladezustand für Formular

  // Check if the current user is a Superadmin
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN';

  // Fetches the list of users from the API
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
      setMessage(error instanceof Error ? `Fehler: ${error.message}` : 'Fehler: Beim Verbinden mit der API.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Load users when the component mounts and the session is authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      void fetchUsers();
    }
  }, [status]);

  // Handles the form submission for creating a new user
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setMessage('Erstelle Benutzer...');
    setIsSubmitting(true); // Ladevorgang starten

    const formData = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formData) as Record<string, unknown>;
    const payload = { ...rawData, role: selectedRole };

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Ein unbekannter Fehler ist aufgetreten.');
      }

      setMessage(`Benutzer "${result.email}" erfolgreich erstellt.`);
      (e.target as HTMLFormElement).reset();
      setSelectedRole('BENUTZER');
      await fetchUsers();
    } catch (error) {
        setMessage(`Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setIsSubmitting(false); // Ladevorgang beenden
    }
  };

  // Handles deleting a user
  const handleDelete = async (userId: string): Promise<void> => {
    if (!window.confirm('Sind Sie sicher, dass Sie diesen Nutzer endgültig löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
        return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Fehler beim Löschen');
      }

      setMessage('Benutzer erfolgreich gelöscht.');
      await fetchUsers(); // Refresh the user list
    } catch (error) {
      setMessage(`Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  };

  // Authentication and authorization check
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

  // Render the admin page UI
  return (
  <div className="p-8 mt-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin-Bereich</h1>
          <p className="text-gray-600 mt-2">Verwalten Sie Benutzer und Projekte</p>
        </div>
      </div>

      {/* Überarbeitete Nachrichtenanzeige */}
      {message && (
        <div className={`my-4 p-4 border rounded-md flex items-center gap-2 ${
          message.startsWith('Fehler:')
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message.startsWith('Fehler:') ? <ExclamationTriangleFill size={18}/> : <InfoCircleFill size={18}/>}
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        {/* User Creation Form */}
        <div className="bg-white p-6 rounded-lg shadow-md h-fit border border-gray-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <PersonPlus size={22} /> Neuen Nutzer anlegen
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Rolle</label>
              <select
                name="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'BENUTZER' | 'ADMIN')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                <option value="BENUTZER">Kunde (Benutzer)</option>
                {isSuperAdmin && <option value="ADMIN">Admin</option>}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">E-Mail</label>
              <input
                name="email"
                type="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Initial-Passwort</label>
              <input
                name="password"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              />
            </div>

            {selectedRole === 'BENUTZER' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Domain (z. B. kundendomain.at)</label>
                  <input
                    name="domain"
                    type="text"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">GSC Site URL (z. B. https://kundendomain.at/)</label>
                  <input
                    name="gsc_site_url"
                    type="text"
                    placeholder="Optional"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">GA4 Property ID (nur die Nummer)</label>
                  <input
                    name="ga4_property_id"
                    type="text"
                    placeholder="Optional"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Semrush Projekt ID</label>
                  <input
                    name="semrush_project_id"
                    type="text"
                    placeholder="Optional"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Semrush Tracking ID</label>
                  <input
                    name="semrush_tracking_id"
                    type="text"
                    placeholder="Optional"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400"
                    disabled={isSubmitting}
                  />
                </div>
              </>
            )}

            {/* Angepasster Button "Kunden/Admin erstellen" */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2 font-normal text-white bg-[#188bdb] border-[3px] border-[#188bdb] rounded-[3px] hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#188bdb] disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <ArrowRepeat className="animate-spin" size={18} />
                  <span>Wird erstellt...</span>
                </>
              ) : (
                <>
                  <PersonPlus size={18} />
                  {selectedRole === 'BENUTZER' ? 'Kunden erstellen' : 'Admin erstellen'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Existing Users List */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <People size={22} /> Vorhandene Nutzer
          </h2>
          {isLoadingUsers ? (
            <div className="flex items-center text-gray-500">
              <ArrowRepeat className="animate-spin text-indigo-600 mr-2" size={18} />
              Lade Benutzer...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center text-gray-400 p-8">
              <People size={32} className="mx-auto mb-2" />
              <p>Keine Benutzer gefunden.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {users.map((user) => (
                  <li key={user.id} className="p-3 border rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors hover:bg-gray-50">
                    {/* User Info */}
                    <div className="flex-1 overflow-hidden">
                      <p className="font-semibold truncate" title={user.email}>{user.email}</p>
                      {user.domain && (
                        <p className="text-sm text-blue-600 font-medium truncate">{user.domain}</p>
                      )}
                      <p className="text-xs uppercase font-medium text-gray-500">{user.role}</p>
                    </div>

                    {/* Action Buttons - KORREKTUR: Globale Button-Komponente entfernt */}
                    <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                      <Link
                        href={`/admin/edit/${user.id}`}
                        className="flex-1 sm:flex-none justify-center bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300 text-sm flex items-center gap-1.5 transition-colors"
                      >
                        <Pencil size={14} /> Bearbeiten
                      </Link>
                      <button
                        onClick={() => void handleDelete(user.id)}
                        className="flex-1 sm:flex-none justify-center bg-red-500 text-white px-3 py-1.5 rounded hover:bg-red-600 text-sm flex items-center gap-1.5 transition-colors"
                      >
                        <Trash size={14} /> Löschen
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
