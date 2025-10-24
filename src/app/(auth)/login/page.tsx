// src/app/(auth)/login/page.tsx
import Image from 'next/image';
import { Suspense } from 'react';
import LoginForm from './LoginForm';

/**
 * Eine minimalistische SVG-Hintergrundkomponente,
 * die ein abstraktes Netzwerk darstellt (KI, SEO, GEO).
 */
function AbstractNetworkBackground() {
  return (
    <svg
      className="absolute inset-0 z-0 h-full w-full text-gray-300"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="network-pattern"
          width="80"
          height="80"
          patternUnits="userSpaceOnUse"
        >
          {/* Vertikale und horizontale Linien */}
          <path
            d="M 0 80 V 0 M 80 0 H 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.3"
          />
          {/* Netzwerk-Punkte an den Kreuzungen */}
          <circle cx="0" cy="0" r="2" fill="currentColor" opacity="0.4" />
          <circle cx="80" cy="0" r="2" fill="currentColor" opacity="0.4" />
          <circle cx="0" cy="80" r="2" fill="currentColor" opacity="0.4" />
          <circle cx="80" cy="80" r="2" fill="currentColor" opacity="0.4" />
          {/* Zentrale Punkte */}
          <circle cx="40" cy="40" r="1.5" fill="currentColor" opacity="0.3" />
        </pattern>
        
        {/* Gradient für Fade-Effekt an den Rändern */}
        <radialGradient id="fade-gradient">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0.8" />
        </radialGradient>
      </defs>
      
      {/* Das Muster auf die gesamte Fläche anwenden */}
      <rect width="100%" height="100%" fill="url(#network-pattern)" />
      
      {/* Overlay für Fade-Effekt */}
      <rect width="100%" height="100%" fill="url(#fade-gradient)" />
    </svg>
  );
}

// Verbesserte Loading-Komponente mit gleichem Layout wie LoginForm
function LoginLoading() {
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gray-50 overflow-hidden">
      <AbstractNetworkBackground />
      <div className="relative z-10 w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-xl border border-gray-200">
        <div className="text-center">
          <div className="mx-auto mb-4 h-[45px] w-[180px] bg-gray-200 animate-pulse rounded" />
          <p className="mt-2 text-gray-600">Wird geladen...</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gray-50 overflow-hidden">
      {/* Hintergrund SVG */}
      <AbstractNetworkBackground />
      
      {/* Content mit z-10 damit es über dem Hintergrund liegt */}
      <div className="relative z-10 w-full">
        <Suspense fallback={<LoginLoading />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
