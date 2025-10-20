// src/app/(auth)/login/LoginForm.tsx
'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
// Icons für den neuen Stil hinzugefügt
import { BoxArrowInRight, ExclamationTriangleFill } from 'react-bootstrap-icons';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Ladezustand für Feedback

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true); // Ladevorgang starten

    const result = await signIn('credentials', {
      redirect: true, // Behält die Weiterleitung bei Erfolg bei
      callbackUrl,
      email,
      password,
    });

    // signIn() mit redirect:true leitet bei Erfolg automatisch weiter.
    // Nur wenn ein Fehler auftritt (z.B. falsches Passwort), bleibt der Nutzer hier.
    if (result?.error) {
      setError('E-Mail oder Passwort ungültig.');
      setIsLoading(false); // Ladevorgang bei Fehler stoppen
    }
    // Bei Erfolg ist kein setIsLoading(false) nötig, da die Seite wechselt.
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      {/* KORREKTUR: Leichterer Rahmen für die Login-Box */}
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-xl border border-gray-200">
        <div className="text-center">
          <Image
            src="/logo-data-peak.webp"
            alt="Data Peak Logo"
            width={300}
            height={77}
            priority
            className="mx-auto mb-4"
            onError={(e) => {
              console.error('Logo konnte nicht geladen werden');
              }}
          />
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
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
              // ✨ HIER IST DIE KORREKTUR: (py-5 zu py-2 geändert) ✨
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50"
              disabled={isLoading} // Deaktivieren während des Ladevorgangs
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
              // (Dieses war korrekt mit py-2)
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50"
              disabled={isLoading} // Deaktivieren während des Ladevorgangs
            />
          </div>

          {error && (
            // KORREKTUR: Fehlermeldung mit Icon
            <div className="p-3 text-center text-red-800 bg-red-50 border border-red-200 rounded-md flex items-center justify-center gap-2">
              <ExclamationTriangleFill size={16} />
              <p>{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              className="w-full px-4 py-3 font-normal text-white bg-[#188bdb] border-[3px] border-[#188bdb] rounded-[3px] hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#188bdb] disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Wird angemeldet...</span> // Lade-Text
              ) : (
                <>
                  <BoxArrowInRight size={18} />
                  <span>Anmelden</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
