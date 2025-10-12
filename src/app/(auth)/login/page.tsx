// src/app/(auth)/login/page.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation'; // useSearchParams importieren
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams(); // searchParams für Callback-URL auslesen
  const callbackUrl = searchParams.get('callbackUrl') || '/'; // Standard-Weiterleitung zur Hauptseite

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = await signIn('credentials', {
      // ✅ KORREKTUR: Wir lassen NextAuth die Weiterleitung übernehmen
      redirect: true,
      callbackUrl, // Wir geben die URL an, zu der nach dem Login weitergeleitet werden soll
      email,
      password,
    });

    // Dieser Teil wird nur ausgeführt, wenn `redirect: false` wäre oder ein Fehler auftritt, der die Weiterleitung verhindert.
    if (result?.error) {
      setError('E-Mail oder Passwort ungültig.');
    }
    // Der `else`-Block mit `router.push` ist nicht mehr nötig.
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">SEO-Dashboard</h1>
          <p className="mt-2 text-gray-600">Bitte melden Sie sich an.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-gray-700"
            >
              E-Mail-Adresse
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-gray-700"
            >
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="p-3 text-center text-red-800 bg-red-100 border border-red-300 rounded-md">
              <p>{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              className="w-full px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              Anmelden
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
