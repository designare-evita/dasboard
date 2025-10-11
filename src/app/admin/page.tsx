// src/app/admin/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { User } from '@/types';
import Link from 'next/link';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'BENUTZER' | 'ADMIN'>('BENUTZER');

  // Funktion zum Abrufen der Benutzerliste
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setMessage('Fehler beim Laden der Benutzerliste.');
      }
    } catch (error) {
      setMessage('Fehler beim Verbinden mit der API.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchUsers();
    }
  }, [status]);

  // Handler für das Erstellen eines neuen Benutzers
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('Erstelle Benutzer...');
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    data.role = selectedRole;

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage(`Erfolg! ${result.message}`);
      (e.target as HTMLFormElement).reset();
      setSelectedRole('BENUTZER'); // Setzt die Auswahl zurück
      fetchUsers(); // Lädt die Benutzerliste neu
    } else {
      setMessage(`Fehler: ${result.message}`);
    }
  };
  
  // Handler für das Löschen eines Benutzers
  const handleDelete = async (userId: string) => {
    if (window.confirm('Sind Sie sicher, dass Sie diesen Nutzer endgültig löschen möchten?')) {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if(response.ok) {
        setMessage('Benutzer erfolgreich gelöscht.');
        fetchUsers();
      } else {
        setMessage(`Fehler: ${result.message}`);
      }
    }
  };

  // Authentifizierungs-Check
  if (status === 'loading') return <div className="p-8 text-center">Lade...</div>;
  if (status === 'unauthenticated' || (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN')) {
    router.push('/');
    return null;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {message && <p className="my-4 text-center p-3 bg-yellow-100 border border-yellow-300 rounded-md">{message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        {/* === FORMULAR ZUM ANLEGEN VON BENUTZERN === */}
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
                <option value="BENUTZER">Kunde</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">E-Mail</label>
              <input name="email" type="email" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Initial-Passwort</label>
              <input name="password" type="text" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
            </div>
            
            {selectedRole === 'BENUTZER' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Domain (z.B. kundendomain.at)</label>
                  <input name="domain" type="text" required={selectedRole === 'BENUTZER'} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">GSC Site URL (z.B. https://kundendomain.at/)</label>
                  <input name="gsc_site_url" type="text" required={selectedRole === 'BENUTZER'} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">GA4 Property ID (nur die Nummer)</label>
                  <input name="ga4_property_id" type="text" required={selectedRole === 'BENUTZER'} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
                </div>
              </>
            )}

            <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
              {selectedRole === 'BENUTZER' ? 'Kunden erstellen' : 'Admin erstellen'}
            </button>
          </form>
        </div>

        {/* === BENUTZERLISTE === */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Vorhandene Nutzer</h2>
          {isLoadingUsers ? (
            <p>Lade Benutzer...</p>
          ) : (
            <ul className="space-y-3">
              {users.map((user) => (
                <li key={user.id} className="p-3 border rounded-md flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{user.email}</p>
                    <p className="text-sm text-gray-500">{user.role}</p>
                  </div>
                  <div className="flex gap-2">
                    {/* === HIER IST DER NEUE BEARBEITEN-LINK === */}
                    <Link href={`/admin/edit/${user.id}`} className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 text-sm">
                      Bearbeiten
                    </Link>
                    <button
                      onClick={() => handleDelete(user.id)}
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
