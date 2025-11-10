// src/app/(auth)/login/LoginForm.tsx
'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';
// KORREKTUR 1: useRouter importieren
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
// Icons für den neuen Stil hinzugefügt
import { BoxArrowInRight, ExclamationTriangleFill } from 'react-bootstrap-icons';
// ✅ NEU: Framer Motion importieren
import { motion } from 'framer-motion';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  
  // KORREKTUR 2: router initialisieren
  const router = useRouter(); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Ladezustand für Feedback

  // KORREKTUR 3: Handler, um Fehler beim Tippen zu löschen
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError(''); // Fehler löschen
    setEmail(e.target.value);
  };
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError(''); // Fehler löschen
    setPassword(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true); // Ladevorgang starten

    // KORREKTUR 4: redirect: false verwenden, um Fehler abzufangen
    const result = await signIn('credentials', {
      redirect: false, // WICHTIG: Nicht automatisch weiterleiten
      callbackUrl,
      email,
      password,
    });

    setIsLoading(false); // Ladevorgang stoppen

    // KORREKTUR 5: Spezifischen Fehler anzeigen oder manuell weiterleiten
    if (result?.error) {
      // result.error enthält jetzt die Meldung aus auth.ts
      // z.B. "Das Passwort ist nicht korrekt"
      setError(result.error);
    } else if (result?.ok) {
      // Login war erfolgreich, jetzt manuell weiterleiten
      router.push(callbackUrl);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      
      {/* ✅ KORREKTUR: Wrapper in motion.div geändert + Animations-Props */}
      <motion.div 
        className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-xl border border-gray-200"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
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
              // KORREKTUR 6: Neuen Handler verwenden
              onChange={handleEmailChange}
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
              // KORREKTUR 7: Neuen Handler verwenden
              onChange={handlePasswordChange}
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
              {/* Zeigt jetzt den dynamischen Fehler an */}
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
      </motion.div>
      {/* ✅ ENDE KORREKTUR */}

    </div>
  );
}
