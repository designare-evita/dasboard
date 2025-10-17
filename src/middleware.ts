export { default } from "next-auth/middleware"
export const config = { 
  matcher: [
    /*
     * Alles schützen, außer:
     * - Die API-Routen
     * - Interne Next.js-Pfade (_next/...)
     * - Statische Dateien (z.B. favicon.ico)
     * - Unsere Login-Seite
     */
    '/((?!api|_next/static|_next/image|favicon.ico|logo-data-peak.webp|login).*)',
  ] 
}
