// src/app/(auth)/login/LoginForm.tsx
'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = await signIn('credentials', {
      redirect: true,
      callbackUrl,
      email,
      password,
    });

    if (result?.error) {
      setError('E-Mail oder Passwort ungültig.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-xl">
        <div className="text-center">
          
          {/* Logo mit Error-Handling */}
          <Image
            src="/public/logo-data-peak.webp"
            alt="Data Peak Logo"
            width={180}
            height={45}
            priority
            unoptimized
            className="mx-auto mb-4"
            onError={(e) => {
              console.error('Logo konnte nicht geladen werden');
              // Fallback: Zeige Text statt Bild
              e.currentTarget.style.display = 'none';
            }}
          />
          {/* Fallback-Text falls Bild nicht lädt */}
          <h1 className="text-2xl font-bold text-gray-900">Data Peak</h1>
          
          <p className="mt-2 text-gray-600">Bitte melden Sie sich an.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-gray-700"
            >
              E-Mail
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
