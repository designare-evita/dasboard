// src/app/admin/edit/[id]/EditUserForm.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';

type Props = {
  id: string;
  user: Partial<User>;
};

export default function EditUserForm({ id, user }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('Aktualisiere Benutzer...');
    setIsSuccess(false);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    // Entferne das Passwortfeld, wenn es leer ist, damit es nicht in der Datenbank überschrieben wird
    if (!data.password) {
      delete data.password;
    }

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || 'Update fehlgeschlagen');

      setMessage('Benutzer erfolgreich aktualisiert. Sie werden weitergeleitet...');
      setIsSuccess(true);
      setTimeout(() => router.push('/admin'), 1500);
    } catch (err: unknown) {
      setMessage(
        `Fehler: ${err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.'}`
      );
      setIsSuccess(false);
    }
  };

  // Prüfen, ob der Benutzer ein Admin oder Superadmin ist
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isAdmin ? (
        // Formular für Admins
        <>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={user.email}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
              Neues Passwort (optional)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Leer lassen, um das Passwort nicht zu ändern"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </>
      ) : (
        // Formular für normale Benutzer
        <>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
              Kunden E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={user.email}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
              Neues Passwort (optional)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Leer lassen, um das Passwort nicht zu ändern"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="domain" className="block text-sm font-semibold text-gray-700">
              Domain
            </label>
            <input
              id="domain"
              name="domain"
              type="text"
              defaultValue={user.domain}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="gsc_site_url" className="block text-sm font-semibold text-gray-700">
              GSC Site URL
            </label>
            <input
              id="gsc_site_url"
              name="gsc_site_url"
              type="text"
              defaultValue={user.gsc_site_url}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="ga4_property_id" className="block text-sm font-semibold text-gray-700">
              GA4 Property ID
            </label>
            <input
              id="ga4_property_id"
              name="ga4_property_id"
              type="text"
              defaultValue={user.ga4_property_id}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="bg-indigo-600 text-white py-2 px-6 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Änderungen speichern
        </button>
      </div>

      {message && (
        <p
          className={`mt-4 text-center text-sm p-3 rounded-md ${
            isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
