'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { User } from '@/types';
import Link from 'next/link';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Funktion zum Abrufen der Benutzerliste
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    const response = await fetch('/api/users');
    if (response.ok) {
      const data = await response.json();
      setUsers(data);
    } else {
      console.error('Fehler beim Laden der Benutzerliste');
      setMessage('Fehler beim Laden der Benutzerliste.');
    }
    setIsLoadingUsers(false);
  };

  // Benutzerliste beim ersten Laden der Seite abrufen
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

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage(`Erfolg! ${result.message}`);
      (e.target as HTMLFormElement).reset();
      fetchUsers(); // Liste nach dem Erstellen neu laden
    } else {
      setMessage(`Fehler: ${result.message}`);
    }
  };
  
  // Handler für das Löschen eines Benutzers
  const handleDelete = async (userId: string) => {
    // Sicherheitsabfrage im Browser
    if (window.confirm('Sind Sie sicher, dass Sie diesen Benutzer endgültig löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if(response.ok) {
        setMessage('Benutzer erfolgreich gelöscht.');
        fetchUsers(); // Liste nach dem Löschen neu laden
      } else {
        setMessage(`Fehler: ${result.message}`);
      }
    }
  };

  if (status === 'loading') {
    return <div className="p-8 text-center">Lade...</div>;
  }

  if (status === 'unauthenticated' || (session?.user?.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
    router.push('/');
    return null;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Header />
      
      {/* Globale Nachrichtenanzeige */}
      {message && <p className="my-4 text-center p-3 bg-yellow-100 border border-yellow-300 rounded-md">{message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        {/* Formular zum Anlegen */}
        <div className="bg-white p-6 rounded-lg shadow-md h-fit">
          <h2 className="text-xl font-bold mb-4">Neuen Kunden anlegen</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Kunden E-Mail</label>
              <input name="email" type="email" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Initial-Passwort</label>
              <input name="password" type="text" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Domain (z.B. kundendomain.at)</label>
              <input name="domain" type="text" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">GSC Site URL (z.B. https://kundendomain.at/)</label>
              <input name="gsc_site_url" type="text" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">GA4 Property ID (nur die Nummer)</label>
              <input name="ga4_property_id" type="text" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Kunden erstellen</button>
          </form>
        </div>

        {/* Liste der verwalteten Kunden */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Verwaltete Kunden</h2>
          {isLoadingUsers ? <p>Lade Kundenliste...</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">E-Mail</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{user.domain}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link href={`/admin/edit/${user.id}`} className="text-indigo-600 hover:text-indigo-900">
                          Bearbeiten
                        </Link>
                        <button onClick={() => handleDelete(user.id)} className="ml-4 text-red-600 hover:text-red-900 font-medium">
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

