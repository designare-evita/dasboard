'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { User } from '@/types';
import Link from 'next/link';

// Dies ist die standardmäßige und korrekte Methode, um die Props
// für eine dynamische Seite im Next.js App Router zu typisieren.
type PageProps = {
  params: { id: string };
};

export default function EditUserPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = params;
  const [user, setUser] = useState<Partial<User> | null>(null);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/users/${id}`);
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.message || 'Benutzer konnte nicht geladen werden.');
        }
        const data = await response.json();
        setUser(data);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) {
      fetchUser();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('Aktualisiere Benutzer...');
    setIsSuccess(false);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message);
      }
      
      setMessage('Benutzer erfolgreich aktualisiert. Sie werden weitergeleitet...');
      setIsSuccess(true);
      setTimeout(() => router.push('/admin'), 2000);
    } catch (err) {
      setMessage(`Fehler: ${err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.'}`);
      setIsSuccess(false);
    }
  };
  
  const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Header />
        <main className="mt-6">{children}</main>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="p-8 text-center bg-white rounded-lg shadow-md">Lade Benutzerdaten...</div>
      </PageWrapper>
    );
  }

  if (!user) {
    return (
      <PageWrapper>
        <div className="p-8 text-center bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-600">Benutzer nicht gefunden</h2>
          {message && <p className="mt-2 text-gray-600">{message}</p>}
          <Link href="/admin" className="mt-4 inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
            Zurück zur Übersicht
          </Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6">
          Benutzer <span className="text-indigo-600">{user.email}</span> bearbeiten
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Kunden E-Mail</label>
            <input id="email" name="email" type="email" defaultValue={user.email} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
          </div>
          <div>
            <label htmlFor="domain" className="block text-sm font-semibold text-gray-700">Domain</label>
            <input id="domain" name="domain" type="text" defaultValue={user.domain} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
          </div>
          <div>
            <label htmlFor="gsc_site_url" className="block text-sm font-semibold text-gray-700">GSC Site URL</label>
            <input id="gsc_site_url" name="gsc_site_url" type="text" defaultValue={user.gsc_site_url} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
          </div>
          <div>
            <label htmlFor="ga4_property_id" className="block text-sm font-semibold text-gray-700">GA4 Property ID</label>
            <input id="ga4_property_id" name="ga4_property_id" type="text" defaultValue={user.ga4_property_id} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
          </div>
          <p className="text-sm text-gray-500 pt-2">Das Passwort kann aus Sicherheitsgründen hier nicht geändert werden.</p>
          <div className="flex justify-end">
            <button type="submit" className="bg-indigo-600 text-white py-2 px-6 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Änderungen speichern
            </button>
          </div>
        </form>
        {message && (
          <p className={`mt-4 text-center text-sm p-3 rounded-md ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </p>
        )}
      </div>
    </PageWrapper>
  );
}
