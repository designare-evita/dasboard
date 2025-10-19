// src/middleware.ts
export { default } from "next-auth/middleware"

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
