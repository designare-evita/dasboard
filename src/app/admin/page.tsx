// src/app/admin/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { User } from '@/types';
import NotificationBell from '../../components/NotificationBell';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State management for the component
  const [message, setMessage] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [selectedRole, setSelectedRole] = useState<'BENUTZER' | 'ADMIN'>('BENUTZER');

  // Check if the current user is a Superadmin
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN';

  // Fetches the list of users from the API
  const fetchUsers = async (): Promise<void> => {
    setIsLoadingUsers(true);
    try {
      // The API endpoint handles permissions (Admins only see their assigned users)
      const response = await fetch('/api/users');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Laden der Benutzerliste.');
      }
      const data: User[] = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('[AdminPage] Fetch Users Error:', error);
      setMessage(error instanceof Error ? error.message : 'Fehler beim Verbinden mit der API.');
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
    
    const formData = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formData) as Record<string, unknown>;

    // Ensure the role from the state is used
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
      setSelectedRole('BENUTZER'); // Reset role selection
      await fetchUsers(); // Refresh the user list
    } catch (error) {
        setMessage(`Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
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
    return <div className="p-8 text-center">Lade...</div>;
  }
  if (status === 'unauthenticated' || !session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    router.push('/login');
    return null;
  }

  // Render the admin page UI
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin-Bereich</h1>
          <p className="text-gray-600 mt-2">Verwalten Sie Benutzer und Projekte</p>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <Link
            href="/admin/redaktionsplan"
            className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 font-medium flex items-center gap-2 transition-colors"
          >
            📋 Redaktionsplan
          </Link>
        </div>
      </div>

      {message && (
        <p className="my-4 text-center p-3 bg-yellow-100 border border-yellow-300 rounded-md">{message}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        {/* User Creation Form */}
        <div className="bg-white p-6 rounded-lg shadow-md h-fit">
          <h2 className="text-xl font-bold mb-4">Neuen Nutzer anlegen</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Rolle</label>
              <select
                name="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'BENUTZER' | 'ADMIN')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="BENUTZER">Kunde (Benutzer)</option>
                {/* Only Superadmins can see the option to create an Admin */}
                {isSuperAdmin && <option value="ADMIN">Admin</option>}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">E-Mail</label>
              <input
                name="email"
                type="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Initial-Passwort</label>
              <input
                name="password"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Fields only for "BENUTZER" (Customer) role */}
            {selectedRole === 'BENUTZER' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Domain (z. B. kundendomain.at)</label>
                  <input
                    name="domain"
                    type="text"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">GSC Site URL (z. B. https://kundendomain.at/)</label>
                  <input
                    name="gsc_site_url"
                    type="text"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">GA4 Property ID (nur die Nummer)</label>
                  <input
                    name="ga4_property_id"
                    type="text"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

            <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
              {selectedRole === 'BENUTZER' ? 'Kunden erstellen' : 'Admin erstellen'}
            </button>
          </form>
        </div>

        {/* Existing Users List */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Vorhandene Nutzer</h2>
          {isLoadingUsers ? (
            <p>Lade Benutzer...</p>
          ) : users.length === 0 ? (
            <p className="text-gray-500">Keine Benutzer gefunden.</p>
          ) : (
            <ul className="space-y-3">
              {users.map((user) => (
                  <li key={user.id} className="p-3 border rounded-md flex justify-between items-center">
                    <div className="flex-1 overflow-hidden">
                      <p className="font-semibold truncate" title={user.email}>{user.email}</p>
                      {user.domain && (
                        <p className="text-sm text-blue-600 font-medium truncate">{user.domain}</p>
                      )}
                      <p className="text-sm text-gray-500">{user.role}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <Link
                        href={`/admin/edit/${user.id}`}
                        className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 text-sm"
                      >
                        Bearbeiten
                      </Link>
                      <button
                        onClick={() => void handleDelete(user.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                      >
                        Löschen
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

