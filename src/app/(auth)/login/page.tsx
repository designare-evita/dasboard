// src/app/(auth)/login/page.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const searchParams = useSearchParams();
  // Falls es einen Fehler beim Login gab (z.B. Zugriff verweigert), wird er hier aus der URL gelesen
  const error = searchParams.get('error');

  const handleGoogleSignIn = () => {
    // Diese Funktion startet den Google-Anmeldeprozess.
    // Nach Erfolg wird der Benutzer zur Hauptseite ('/') weitergeleitet.
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">SEO-Dashboard</h1>
          <p className="mt-2 text-gray-600">Bitte melden Sie sich an, um fortzufahren.</p>
        </div>
        
        {/* Zeigt eine Fehlermeldung an, wenn der Login fehlschlägt */}
        {error && (
          <div className="p-4 text-center text-red-800 bg-red-100 border border-red-300 rounded-md">
            <p className="font-semibold">Anmeldung fehlgeschlagen</p>
            <p className="text-sm">Bitte versuchen Sie es erneut. ({error})</p>
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          className="w-full px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 flex items-center justify-center gap-3 transition-all duration-300"
        >
          {/*  */}
          <span>Mit Google anmelden</span>
        </button>
      </div>
    </div>
  );
}
