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
      className="absolute inset-0 z-0 h-full w-full opacity-[0.08] [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="network-pattern"
          width="100"
          height="100"
          patternUnits="userSpaceOnUse"
          x="50%"
          y="50%"
        >
          {/* Ein subtiles Gitter */}
          <path
            d="M 0 100 V.5 M 100 0 H.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          {/* Die "Netzwerk"-Punkte */}
          <circle cx="50" cy="50" r="1.5" fill="currentColor" />
        </pattern>
      </defs>
      {/* Das Muster auf die gesamte Fläche anwenden */}
      <rect width="100%" height="100%" fill="url(#network-pattern)" />
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
    <Suspense fallback={<LoginLoading />}>
      {/* Der Hauptcontainer:
          - relative: Dient als Anker für das absolute SVG
          - overflow-hidden: Verhindert, dass das SVG übersteht
          - bg-gray-50: Ein sehr helles, sauberes Grau statt reinweiß */}
      <div className="relative flex items-center justify-center min-h-screen bg-gray-50 overflow-hidden">
        {/* 1. Die Hintergrund-SVG-Komponente */}
        <AbstractNetworkBackground />
        
        {/* 2. Die Login-Box:
            - relative z-10: Stellt sicher, dass sie ÜBER dem Hintergrund (z-0) liegt
            - shadow-xl: Ein stärkerer Schatten für bessere Trennung
            - border: Ein subtiler Rand */}
        <div className="relative z-10 p-8 bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </Suspense>
  );
}
