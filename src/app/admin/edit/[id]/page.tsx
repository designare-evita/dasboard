'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { User } from '@/types';
import Link from 'next/link';

export default function EditUserPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [user, setUser] = useState<Partial<User> | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      const response = await fetch(`/api/users/${id}`);
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        const result = await response.json();
        setMessage(`Fehler beim Laden der Benutzerdaten: ${result.message}`);
      }
      setIsLoading(false);
    };
    if (id) {
      fetchUser();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('Aktualisiere Benutzer...');
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    const response = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Benutzer erfolgreich aktualisiert. Sie werden weitergeleitet...');
      setTimeout(() => router.push('/admin'), 2000); // Zurück zur Admin-Übersicht nach 2s
    } else {
      setMessage(`Fehler: ${result.message}`);
    }
  };

  if (isLoading) {
    return (
        <div className="p-8 max-w-2xl mx-auto">
            <Header />
            <div className="p-8 text-center bg-white mt-6 rounded-lg shadow-md">Lade Benutzerdaten...</div>
        </div>
    );
  }

  if (!user) {
    return (
        <div className="p-8 max-w-2xl mx-auto">
            <Header />
            <div className="p-8 text-center text-red-500 bg-white mt-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold">Benutzer nicht gefunden</h2>
                <p>{message}</p>
                <Link href="/admin" className="text-blue-500 hover:underline mt-4 inline-block">Zurück zur Übersicht</Link>
            </div>
        </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Header />
      <div className="bg-white p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-xl font-bold mb-4">Benutzer <span className="text-blue-600">{user.email}</span> bearbeiten</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Kunden E-Mail</label>
            <input name="email" type="email" defaultValue={user.email} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Domain</label>
            <input name="domain" type="text" defaultValue={user.domain} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">GSC Site URL</label>
            <input name="gsc_site_url" type="text" defaultValue={user.gsc_site_url} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">GA4 Property ID</label>
            <input name="ga4_property_id" type="text" defaultValue={user.ga4_property_id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
          </div>
          <p className="text-xs text-gray-500">Das Passwort kann aus Sicherheitsgründen hier nicht geändert werden.</p>
          <button type="submit" className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700">Änderungen speichern</button>
        </form>
        {message && <p className="mt-4 text-center">{message}</p>}
      </div>
    </div>
  );
}

