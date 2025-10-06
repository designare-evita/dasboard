'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { User } from '@/types'; // Importieren des User-Typs

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Zustand für das Formular
  const [message, setMessage] = useState('');
  
  // Zustand für die Benutzerliste
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Effekt zum Laden der Benutzerliste
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        console.error('Fehler beim Laden der Benutzerliste');
      }
      setIsLoadingUsers(false);
    };

    if (status === 'authenticated') {
      fetchUsers();
    }
  }, [status]);


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
      // Benutzerliste nach dem Erstellen neu laden
      const userResponse = await fetch('/api/users');
      if(userResponse.ok) {
        const usersData = await userResponse.json();
        setUsers(usersData);
      }
    } else {
      setMessage(`Fehler: ${result.message}`);
    }
  };


  if (status === 'loading') {
    return <div className="p-8 text-center">Lade...</div>;
  }

  if (status === 'unauthenticated' || (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN')) {
    router.push('/');
    return null;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Header />
      
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
          {message && <p className="mt-4 text-center">{message}</p>}
        </div>

        {/* Liste der angelegten Kunden */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Verwaltete Kunden</h2>
          {isLoadingUsers ? (
            <p>Lade Kundenliste...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-Mail</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length > 0 ? (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.domain}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <a href="#" className="text-indigo-600 hover:text-indigo-900">Bearbeiten</a>
                          <a href="#" className="ml-4 text-red-600 hover:text-red-900">Löschen</a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">Noch keine Kunden angelegt.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

