// src/middleware.ts
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth'; // Importiere das reine Konfig-Objekt

// Erzeuge die Middleware und exportiere die .auth-Eigenschaft
export default NextAuth(authConfig).auth;

// Die config bleibt gleich
export const config = { 
  matcher: [
    /*
     * Schütze alle Routen AUSSER:
     * - /login (Login-Seite)
     * - /api/* (API-Routen)
     * - /_next/* (Next.js interne Pfade)
     * - /favicon.ico und statische Assets
     */
    '/((?!login|api|_next/static|_next/image|favicon.ico|logo-data-peak.webp).*)',
  ] 
}
