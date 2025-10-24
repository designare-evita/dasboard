// src/app/(auth)/login/page.tsx
'use client';

import Image from 'next/image';
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
          width="100" // Größe der Kacheln
          height="100"
          patternUnits="userSpaceOnUse"
          x="50%"
          y="50%"
        >
          {/* Ein subtiles Gitter */}
          <path d="M 0 100 V.5 M 100 0 H.5" fill="none" stroke="currentColor" strokeWidth="0.5" />
          {/* Die "Netzwerk"-Punkte */}
          <circle cx="50" cy="50" r="1.5" fill="currentColor" />
        </pattern>
      </defs>
      {/* Das Muster auf die gesamte Fläche anwenden */}
      <rect width="100%" height="100%" fill="url(#network-pattern)" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    // Der Hauptcontainer:
    // - relative: Dient als Anker für das absolute SVG
    // - overflow-hidden: Verhindert, dass das SVG übersteht
    // - bg-gray-50: Ein sehr helles, sauberes Grau statt reinweiß
    <div className="relative flex items-center justify-center min-h-screen bg-gray-50 overflow-hidden">
      
      {/* 1. Die Hintergrund-SVG-Komponente */}
      <AbstractNetworkBackground />

      {/* 2. Die Login-Box:
        - relative z-10: Stellt sicher, dass sie ÜBER dem Hintergrund (z-0) liegt
        - shadow-xl: Ein stärkerer Schatten für bessere Trennung
        - border: Ein subtiler Rand
      */}
      <div className="relative z-10 p-8 bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
        
        <div className="flex justify-center mb-6">
          {/* Logo bleibt unverändert */}
          <Image 
            src="/logo-data-peak.webp" 
            alt="Logo" 
            width={150} 
            height={40} 
            priority // Wichtig für LCP auf der Login-Seite
          />
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Login
        </h2>

        {/* Das Login-Formular bleibt unverändert */}
        <LoginForm />
      </div>
    </div>
  );
}
