// src/app/admin/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Header from '@/components/layout/Header'; // Importieren Sie die neue Komponente

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [message, setMessage] = useState('');

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
    } else {
      setMessage(`Fehler: ${result.message}`);
    }
  };


  if (status === 'loading') {
    return <div>Lade...</div>;
  }

  // @ts-ignore
  if (status === 'unauthenticated' || (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPERADMIN')) {
    router.push('/');
    return null;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Header /> {/* Verwenden Sie hier die neue Header-Komponente */}
      
      <div className="bg-white p-6 rounded-lg shadow-md mt-6">
        <h2 className="text-xl font-bold mb-4">Neuen Kunden anlegen</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ... Ihr Formular-Code bleibt unverändert ... */}
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
            <label className="block text-sm font-medium text-gray-700">GSC Site URL (z.B. https://www.kundendomain.at/)</label>
            <input name="gsc_site_url" type="text" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">GA4 Property ID (nur die Nummer, z.B. 123456789)</label>
            <input name="ga4_property_id" type="text" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"/>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Kunden erstellen</button>
        </form>
        {message && <p className="mt-4 text-center">{message}</p>}
      </div>
    </div>
  );
}
