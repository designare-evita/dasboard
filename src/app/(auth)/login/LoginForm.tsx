// src/app/(auth)/login/LoginForm.tsx
'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { 
  BoxArrowInRight, 
  ExclamationTriangleFill, 
  Eye, 
  EyeSlash, 
  Envelope, 
  Lock 
} from 'react-bootstrap-icons';
import { motion } from 'framer-motion';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const router = useRouter(); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(0);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError('');
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError('');
    setPassword(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await signIn('credentials', {
      redirect: false,
      callbackUrl,
      email,
      password,
    });

    setIsLoading(false);

    if (result?.error) {
      setError("Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihre Daten.");
      setShake(prev => prev + 1);
    } else if (result?.ok) {
      router.push(callbackUrl);
    }
  };

  const brandColorClass = "focus:ring-[#188bdb] focus:border-[#188bdb]";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      
      <motion.div 
        className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg border border-gray-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          x: error ? [-10, 10, -10, 10, 0] : 0 
        }}
        key={shake} 
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="text-center">
          {/* Logo ohne Text darunter */}
          <div className="relative w-[260px] h-[78px] mx-auto mb-2">
             <Image
                src="/logo-data-peak.webp"
                alt="Data Peak Logo"
                fill
                className="object-contain"
                priority
                sizes="260px"
             />
          </div>
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          
          {/* E-MAIL FELD */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail Adresse
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Envelope size={18} />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                required
                className={`block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none ${brandColorClass} transition-colors sm:text-sm disabled:bg-gray-50 disabled:text-gray-500`}
                disabled={isLoading}
                placeholder="name@firma.at"
              />
            </div>
          </div>

          {/* PASSWORT FELD */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Passwort
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                required
                className={`block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none ${brandColorClass} transition-colors sm:text-sm disabled:bg-gray-50 disabled:text-gray-500`}
                disabled={isLoading}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* FEHLERMELDUNG */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2"
            >
              <ExclamationTriangleFill size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* SUBMIT BUTTON */}
          <div>
            <button
              type="submit"
              className="w-full relative flex justify-center py-3 px-4 border border-transparent rounded-lg text-white bg-[#188bdb] hover:bg-[#1479BF] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#188bdb] font-medium shadow-sm transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Anmeldung...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Anmelden</span>
                  <BoxArrowInRight size={18} />
                </div>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
