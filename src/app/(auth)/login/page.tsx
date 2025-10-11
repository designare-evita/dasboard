// src/app/(auth)/login/page.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react'; // Wichtig: Suspense importieren

// Die eigentliche Logik wird in eine separate Komponente ausgelagert.
function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">SEO-Dashboard</h1>
        <p className="mt-2 text-gray-600">Bitte melden Sie sich an, um fortzufahren.</p>
      </div>
      
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
        <span>Mit Google anmelden</span>
      </button>
    </div>
  );
}


// Die Haupt-Seitenkomponente umschließt das Formular mit <Suspense>.
export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Suspense fallback={<div className="text-center">Lade...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
