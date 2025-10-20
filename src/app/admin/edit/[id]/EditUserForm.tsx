// src/app/admin/edit/[id]/EditUserForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';
// Icons hinzugefügt
import { Check2, ArrowRepeat, ExclamationTriangleFill, InfoCircleFill } from 'react-bootstrap-icons';

type Props = {
  id: string;
  user: Partial<User>;
};

export default function EditUserForm({ id, user }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Ladezustand

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('Aktualisiere Benutzer...');
    setIsSuccess(false);
    setIsLoading(true); // Ladevorgang starten

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    // Entferne das Passwortfeld, wenn es leer ist
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
      setTimeout(() => router.push('/admin'), 1500); // Weiterleitung nach 1.5s
    } catch (err: unknown) {
      setMessage(
        `Fehler: ${err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten.'}`
      );
      setIsSuccess(false);
    } finally {
      setIsLoading(false); // Ladevorgang beenden
    }
  };

  // Prüfen, ob der Benutzer ein Admin oder Superadmin ist
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* --- Eingabefelder --- */}
      {isAdmin ? (
        // Felder für Admins
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
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isLoading}
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
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isLoading}
            />
          </div>
        </>
      ) : (
        // Felder für normale Benutzer (Kunden)
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
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isLoading}
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
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isLoading}
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
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isLoading}
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
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isLoading}
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
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isLoading}
            />
          </div>
        </>
      )}

      {/* --- Button und Nachrichtenanzeige --- */}
      <div className="pt-4 border-t border-gray-100 flex flex-col items-end gap-4">
        {/* Angepasster Button "Änderungen speichern" */}
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 font-normal text-white bg-[#188bdb] border-[3px] border-[#188bdb] rounded-[3px] hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#188bdb] disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <ArrowRepeat className="animate-spin" size={18} />
              <span>Wird gespeichert...</span>
            </>
          ) : (
            <>
              <Check2 size={20} /> {/* Größeres Icon */}
              Änderungen speichern
            </>
          )}
        </button>

        {/* Nachrichtenanzeige */}
        {message && (
          <p
            className={`w-full text-center text-sm p-3 rounded-md flex items-center justify-center gap-2 ${
              isSuccess 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {isSuccess ? <InfoCircleFill size={16} /> : <ExclamationTriangleFill size={16} />}
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
